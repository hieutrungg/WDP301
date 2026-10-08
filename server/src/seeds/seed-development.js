import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { seedBranches } from "./seed-branches.js";
import { seedMovies } from "./seed-movies.js";
import { seedRooms } from "./seed-rooms.js";
import { assertDevelopmentSeedTarget } from "./seed-utils.js";

const runDevelopmentSeed = async () => {
  assertDevelopmentSeedTarget(env.mongodbUri);
  await mongoose.connect(env.mongodbUri);

  const database = mongoose.connection.db;
  console.log(`Seeding development database: ${mongoose.connection.name}`);

  const movies = await seedMovies(database);
  const branches = await seedBranches(database);
  const rooms = await seedRooms(database);

  console.table({ movies, branches, rooms });
  console.log("Development seed completed without deleting unrelated data.");
};

try {
  await runDevelopmentSeed();
} catch (error) {
  console.error("Development seed failed:", error.message);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
