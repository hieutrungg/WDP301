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
        column: number,
        type: "STANDARD",
        status: "ENABLED",
        isAccessible: false,
      });
    }
  }

  const rowLabels = Array.from({ length: rows }, (_, rowIndex) => String.fromCharCode(65 + rowIndex));
  return { seats, seatLayout: { rowLabels, columnCount: seatsPerRow } };
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
  ...[
    ["landmark-81", 3],
    ["crescent-mall", 2],
    ["west-lake", 2],
    ["da-nang-riverside", 1],
    ["saigon-centre", 2],
  ].flatMap(([branchKey, roomTotal]) =>
    Array.from({ length: roomTotal }, (_, index) => {
      const roomNumber = String(index + 1).padStart(2, "0");

      return {
        seedKey: `room:${branchKey}:${roomNumber}`,
        branchSeedKey: `branch:f-cinema-${branchKey}`,
        roomName: `Room ${roomNumber}`,
        roomType: "STANDARD",
      };
    }),
  ),
].map((room) => {
  const { seats, seatLayout } = createStandardLayout(room.seedKey);
  return { ...room, layoutVersion: 1, seatLayout, seats, capacity: seats.length, status: "ACTIVE" };
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
    const { layoutVersion, seatLayout, seats, capacity, ...identity } = room;

    return {
      updateOne: {
        filter: { _id },
        update: {
          $set: { ...identity, branchId, updatedAt: now },
          // Layout fields are written on insert only: re-seeding must not overwrite a layout a
          // Manager has since versioned through UC41 (A-14).
          $setOnInsert: { _id, createdAt: now, layoutVersion, seatLayout, seats, capacity },
        },
        upsert: true,
      },
    };
  });

  const result = await database.collection("rooms").bulkWrite(operations, { ordered: true });
  return summarizeBulkWrite(result);
};
