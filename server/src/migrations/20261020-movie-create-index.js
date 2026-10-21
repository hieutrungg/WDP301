// Run after team review. Defaults to a read-only preflight; --apply writes the backfill/index.
import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { configureMongoDns } from "../config/mongo-dns.js";

export async function migrateMovieCreateIndex(database, { apply = false } = {}) {
  const movies = database.collection("movies");
  const invalid = await movies.countDocuments({ $or: [
    { title: { $not: { $type: "string" } } },
    { releaseDate: { $not: { $type: "date" } } },
  ] });
  if (invalid) throw new Error("Movie migration blocked: invalid title/releaseDate; review existing records");
  const duplicates = await movies.aggregate([
    { $group: { _id: { title: "$title", year: { $year: "$releaseDate" } }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]).toArray();
  if (duplicates.length) throw new Error("Movie migration blocked: duplicate title/release year; review existing records");
  if (!apply) return { applied: false };
  await movies.updateMany({}, [{ $set: { releaseYear: { $year: "$releaseDate" } } }]);
  await movies.createIndex({ title: 1, releaseYear: 1 }, {
    unique: true, name: "movie_title_release_year_unique",
    partialFilterExpression: { releaseYear: { $type: "number" } },
  });
  return { applied: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
    configureMongoDns();
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    console.log(await migrateMovieCreateIndex(mongoose.connection.db, { apply: process.argv.includes("--apply") }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
