import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";

export const CONCESSION_IMAGE_MAPPINGS = [
  [["Smoked Sausage Hotdog"], "/images/concessions/smoked-sausage-hotdog.png"],
  [
    ["Popcorn Paper Bucket 85oz"],
    "/images/concessions/popcorn-paper-bucket-85oz.png",
  ],
  [
    ["Cheddar Cheese Popcorn"],
    "/images/concessions/cheddar-cheese-popcorn.png",
  ],
  [
    ["Steamed Sweet Corn Cup"],
    "/images/concessions/steamed-sweet-corn-cup.png",
  ],
  [
    ["Milo Chocolate Malt Drink"],
    "/images/concessions/milo-chocolate-malt-drink.png",
  ],
  [["Caramel Popcorn"], "/images/concessions/caramel-popcorn.png"],
  [
    ["Nacho Supreme with Cheese Dip", "Nacho Supreme with Warm Cheese Dip"],
    "/images/concessions/nachos-with-cheese-dip.png",
  ],
  [["Fountain Soda (Coca-Cola)"], "/images/concessions/fountain-soda-cola.png"],
  [
    ["Dasani Mineral Water", "Dasani Pure Mineral Water"],
    "/images/concessions/mineral-water.png",
  ],
  [
    ["Churros Cinnamon Sticks"],
    "/images/concessions/churros-cinnamon-sticks.png",
  ],
];

export async function applyConcessionCatalogImages(db) {
  const results = [];
  for (const [names, imageUrl] of CONCESSION_IMAGE_MAPPINGS) {
    const result = await db
      .collection("concessions")
      .updateMany({ name: { $in: names } }, { $set: { imageUrl } });
    results.push({
      names,
      imageUrl,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  }
  return results;
}

export async function runMigration(args = process.argv.slice(2)) {
  const apply = args.includes("--apply");
  const dbIndex = args.indexOf("--db");
  const dbName = dbIndex >= 0 ? args[dbIndex + 1] : null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(dbName ?? ""))
    throw new Error("Explicit --db DATABASE is required");
  if (!apply) {
    console.log(
      `DRY RUN: ${dbName}; planned ${CONCESSION_IMAGE_MAPPINGS.length} concession image mappings; no connection or writes.`,
    );
    return;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("Production migration requires deployment owner workflow");
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is required");
  const local = /^mongodb:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(uri);
  if (!local && !args.includes("--allow-remote"))
    throw new Error("Remote apply requires --allow-remote");
  configureMongoDns();
  try {
    await mongoose.connect(uri, {
      dbName,
      autoCreate: false,
      autoIndex: false,
    });
    if (mongoose.connection.db.databaseName !== dbName)
      throw new Error("Database target mismatch");
    console.table(await applyConcessionCatalogImages(mongoose.connection.db));
  } finally {
    await mongoose.disconnect();
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  runMigration().catch((error) => {
    console.error(
      `Concession image migration failed (${error.code ?? error.name}).`,
    );
    process.exitCode = 1;
  });
}
