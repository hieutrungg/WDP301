import mongoose from "mongoose";
import { env } from "./env.js";
import { configureMongoDns } from "./mongo-dns.js";

export const connectDatabase = async () => {
  configureMongoDns();

  await mongoose.connect(env.mongodbUri);

  console.log("MongoDB connected");
};
