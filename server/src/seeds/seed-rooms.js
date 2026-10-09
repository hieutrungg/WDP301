import { branchSeeds } from "./seed-branches.js";
import { deterministicObjectId, summarizeBulkWrite } from "./seed-utils.js";

const createStandardLayout = (roomSeedKey, rows = 5, seatsPerRow = 8) => {
  const seats = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = String.fromCharCode(65 + rowIndex);

    for (let number = 1; number <= seatsPerRow; number += 1) {
      seats.push({
        _id: deterministicObjectId(`${roomSeedKey}:seat:${row}${number}`),
        row,
        number,
        type: "STANDARD",
        status: "ENABLED",
      });
    }
  }

  return seats;
};

export const roomSeeds = [
  {
    seedKey: "room:central:01",
    branchSeedKey: "branch:f-cinema-central",
    roomName: "Room 01",
    roomType: "STANDARD",
  },
  {
    seedKey: "room:central:02",
    branchSeedKey: "branch:f-cinema-central",
    roomName: "Room 02",
    roomType: "STANDARD",
  },
  {
    seedKey: "room:east:01",
    branchSeedKey: "branch:f-cinema-east",
    roomName: "Room 01",
    roomType: "STANDARD",
  },
  {
    seedKey: "room:east:02",
    branchSeedKey: "branch:f-cinema-east",
    roomName: "Room 02",
    roomType: "STANDARD",
  },
].map((room) => {
  const seats = createStandardLayout(room.seedKey);
  return { ...room, layoutVersion: 1, seats, capacity: seats.length, status: "ACTIVE" };
});

export const seedRooms = async (database) => {
  const knownBranchKeys = new Set(branchSeeds.map(({ seedKey }) => seedKey));
  const now = new Date();
  const operations = roomSeeds.map(({ seedKey, branchSeedKey, ...room }) => {
    if (!knownBranchKeys.has(branchSeedKey)) {
      throw new Error(`Unknown branch seed key for room: ${branchSeedKey}`);
    }

    const _id = deterministicObjectId(seedKey);
    const branchId = deterministicObjectId(branchSeedKey);

    return {
      updateOne: {
        filter: { _id },
        update: {
          $set: { ...room, branchId, updatedAt: now },
          $setOnInsert: { _id, createdAt: now },
        },
        upsert: true,
      },
    };
  });

  const result = await database.collection("rooms").bulkWrite(operations, { ordered: true });
  return summarizeBulkWrite(result);
};
