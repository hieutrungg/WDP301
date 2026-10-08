import { deterministicObjectId, summarizeBulkWrite } from "./seed-utils.js";

export const branchSeeds = [
  {
    seedKey: "branch:f-cinema-central",
    branchName: "F-Cinema Central",
    address: "123 Nguyen Hue, Ho Chi Minh City",
    email: "central.dev@f-cinema.example",
    hotline: "19001001",
    status: "ACTIVE",
  },
  {
    seedKey: "branch:f-cinema-east",
    branchName: "F-Cinema East",
    address: "456 Vo Nguyen Giap, Ho Chi Minh City",
    email: "east.dev@f-cinema.example",
    hotline: "19001002",
    status: "ACTIVE",
  },
];

export const seedBranches = async (database) => {
  const now = new Date();
  const operations = branchSeeds.map(({ seedKey, ...branch }) => {
    const _id = deterministicObjectId(seedKey);

    return {
      updateOne: {
        filter: { _id },
        update: {
          $set: { ...branch, updatedAt: now },
          $setOnInsert: { _id, createdAt: now },
        },
        upsert: true,
      },
    };
  });

  const result = await database.collection("branches").bulkWrite(operations, { ordered: true });
  return summarizeBulkWrite(result);
};
