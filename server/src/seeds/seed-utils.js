import { createHash } from "node:crypto";
import mongoose from "mongoose";

export const deterministicObjectId = (seedKey) => {
  const hex = createHash("sha256").update(seedKey).digest("hex").slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
};

export const summarizeBulkWrite = (result) => ({
  matched: result.matchedCount,
  modified: result.modifiedCount,
  upserted: result.upsertedCount,
});

export const assertDevelopmentSeedTarget = (mongodbUri, environment = process.env) => {
  if (!mongodbUri?.trim()) {
    throw new Error("MONGODB_URI is required to run the development seed");
  }

  if (environment.NODE_ENV === "production") {
    throw new Error("Development seed is disabled when NODE_ENV=production");
  }

  const parsedUri = new URL(mongodbUri);
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const isLocalDatabase = localHosts.has(parsedUri.hostname);

  if (!isLocalDatabase && environment.ALLOW_REMOTE_DEVELOPMENT_SEED !== "true") {
    throw new Error(
      "Remote database seed blocked. Set ALLOW_REMOTE_DEVELOPMENT_SEED=true only for the shared development Atlas database.",
    );
  }
};
