import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { configureMongoDns } from "../config/mongo-dns.js";
import { readReviewRating } from "../modules/movie/movie-review.rating.js";
import { isReviewUniqueIndex, REVIEW_UNIQUE_INDEX_KEYS, REVIEW_UNIQUE_INDEX_NAME } from "../modules/movie/movie-review.indexes.js";

const fields = new Set(["_id", "movieId", "customerAccountId", "rating", "content", "createdAt", "updatedAt", "__v"]);
const stop = () => { throw new Error("Review index preflight blocked: legacy/invalid data requires owner review; no documents were changed"); };
const inspectedValidator = { $jsonSchema: { bsonType: "object", properties: {
  movieId: { bsonType: "objectId" }, customerAccountId: { bsonType: "objectId" },
  rating: { bsonType: ["int", "long", "double", "decimal"] }, content: { bsonType: "string" },
  createdAt: { bsonType: "date" }, updatedAt: { bsonType: "date" },
} } };

export const migrateMovieReviewIndex = async (database, { apply = false } = {}) => {
  const info = await database.listCollections({ name: "movie_reviews" }).toArray();
  if (info.length !== 1 || info[0].type !== "collection") throw new Error("Existing movie_reviews collection is required; no collection was created");
  const validator = info[0].options?.validator;
  if (validator && Object.keys(validator).length && !isDeepStrictEqual(validator, inspectedValidator)) {
    throw new Error("Review validator differs from the inspected legacy schema; owner review required; validator was not changed");
  }
  const reviews = database.collection("movie_reviews");
  const indexes = await reviews.listIndexes().toArray();
  const collision = indexes.find(index => index.name === REVIEW_UNIQUE_INDEX_NAME && !isReviewUniqueIndex(index));
  if (collision) throw new Error("Review index name has incompatible options; owner review required");
  // Check all rows. No normalization, deletion, backfill or moderation-status guessing.
  let checked = 0;
  for await (const review of reviews.find()) {
    if (Object.keys(review).some(key => !fields.has(key)) ||
        [review._id, review.movieId, review.customerAccountId].some(id => id?._bsontype !== "ObjectId") ||
        !(review.createdAt instanceof Date) || !Number.isFinite(review.createdAt.getTime()) ||
        (review.content !== undefined && typeof review.content !== "string")) stop();
    readReviewRating(review.rating);
    const account = await database.collection("accounts").findOne({ _id: review.customerAccountId }, { projection: { "profile.fullName": 1 } });
    if (typeof account?.profile?.fullName !== "string" || !account.profile.fullName.trim() ||
        !await database.collection("movies").findOne({ _id: review.movieId }, { projection: { _id: 1 } })) stop();
    checked++;
  }
  const duplicates = await reviews.aggregate([
    { $group: { _id: { movieId: "$movieId", customerAccountId: "$customerAccountId" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }, { $limit: 1 },
  ]).toArray();
  if (duplicates.length) throw new Error("Duplicate customer/movie reviews require owner review; no records were merged or deleted");
  const existing = indexes.find(isReviewUniqueIndex);
  if (apply && !existing) await reviews.createIndex(REVIEW_UNIQUE_INDEX_KEYS, { unique: true, name: REVIEW_UNIQUE_INDEX_NAME, collation: { locale: "simple" } });
  return { database: database.databaseName, applied: apply && !existing, alreadyReady: Boolean(existing), checked, index: existing?.name ?? REVIEW_UNIQUE_INDEX_NAME };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const apply = process.argv.includes("--apply");
    const dbFlag = process.argv.indexOf("--database");
    const dbName = dbFlag < 0 ? undefined : process.argv[dbFlag + 1];
    if (apply && (!dbName || dbName.startsWith("--"))) throw new Error("Apply requires an explicitly approved --database <name>");
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
    configureMongoDns();
    await mongoose.connect(process.env.MONGODB_URI, { ...(dbName ? { dbName } : {}), autoIndex: false, autoCreate: false });
    if (dbName && mongoose.connection.db.databaseName !== dbName) throw new Error("Database target mismatch");
    console.log(await migrateMovieReviewIndex(mongoose.connection.db, { apply }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
