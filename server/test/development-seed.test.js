import assert from "node:assert/strict";
import { test } from "node:test";
import { MOVIE_STATUSES } from "../src/modules/movie/movie.constants.js";
import { branchSeeds } from "../src/seeds/seed-branches.js";
import { movieSeeds, seedMovies } from "../src/seeds/seed-movies.js";
import { roomSeeds, seedRooms } from "../src/seeds/seed-rooms.js";
import {
  assertDevelopmentSeedTarget,
  deterministicObjectId,
} from "../src/seeds/seed-utils.js";

test("development seed fixtures use stable unique identities", () => {
  const allKeys = [
    ...movieSeeds.map(({ seedKey }) => seedKey),
    ...branchSeeds.map(({ seedKey }) => seedKey),
    ...roomSeeds.map(({ seedKey }) => seedKey),
  ];

  assert.equal(new Set(allKeys).size, allKeys.length);
  assert.equal(
    deterministicObjectId("movie:aurora-station").toString(),
    deterministicObjectId("movie:aurora-station").toString(),
  );
});

test("movie fixtures cover the approved lifecycle", () => {
  const allowedStatuses = new Set(Object.values(MOVIE_STATUSES));

  assert.ok(movieSeeds.length >= 6);
  assert.ok(movieSeeds.every(({ status }) => allowedStatuses.has(status)));
  assert.deepEqual(new Set(movieSeeds.map(({ status }) => status)), allowedStatuses);
});

test("movie seed uses deterministic upserts and is safe to run repeatedly", async () => {
  const calls = [];
  const database = {
    collection(name) {
      assert.equal(name, "movies");

      return {
        async bulkWrite(operations, options) {
          calls.push({ operations, options });
          return {
            matchedCount: calls.length === 1 ? 0 : movieSeeds.length,
            modifiedCount: calls.length === 1 ? 0 : movieSeeds.length,
            upsertedCount: calls.length === 1 ? movieSeeds.length : 0,
          };
        },
      };
    },
  };

  const firstResult = await seedMovies(database);
  const secondResult = await seedMovies(database);

  assert.deepEqual(firstResult, { matched: 0, modified: 0, upserted: movieSeeds.length });
  assert.deepEqual(secondResult, {
    matched: movieSeeds.length,
    modified: movieSeeds.length,
    upserted: 0,
  });
  assert.equal(calls.length, 2);

  for (const { operations, options } of calls) {
    assert.deepEqual(options, { ordered: true });
    assert.equal(operations.length, movieSeeds.length);

    operations.forEach(({ updateOne }, index) => {
      const fixture = movieSeeds[index];
      const expectedId = deterministicObjectId(fixture.seedKey);

      assert.equal(updateOne.filter._id.toString(), expectedId.toString());
      assert.equal(updateOne.update.$setOnInsert._id.toString(), expectedId.toString());
      assert.equal(updateOne.upsert, true);
      assert.ok(updateOne.update.$set.releaseDate instanceof Date);
      assert.ok(updateOne.update.$set.createdAt === undefined);
      assert.ok(updateOne.update.$set.seedKey === undefined);
    });
  }
});

test("branch and room fixtures satisfy the approved M0 invariants", () => {
  const branchKeys = new Set(branchSeeds.map(({ seedKey }) => seedKey));
  const normalizedBranchNames = branchSeeds.map(({ branchName }) => branchName.trim().toLowerCase());

  assert.equal(new Set(normalizedBranchNames).size, branchSeeds.length);
  assert.ok(branchSeeds.every(({ branchName, address }) => branchName && address));
  assert.deepEqual(new Set(branchSeeds.map(({ status }) => status)), new Set(["ACTIVE", "INACTIVE"]));
  assert.ok(branchSeeds.every(({ hotline }) => !hotline || /^\+?\d{4,15}$/.test(hotline)));

  const inactiveBranchKeys = new Set(
    branchSeeds.filter(({ status }) => status === "INACTIVE").map(({ seedKey }) => seedKey),
  );
  assert.ok(roomSeeds.every(({ branchSeedKey }) => !inactiveBranchKeys.has(branchSeedKey)));

  for (const room of roomSeeds) {
    assert.ok(branchKeys.has(room.branchSeedKey));
    assert.equal(room.layoutVersion, 1);
    assert.equal(room.capacity, room.seats.filter(({ status }) => status === "ENABLED").length);
    assert.equal(new Set(room.seats.map(({ _id }) => _id.toString())).size, room.seats.length);
    assert.equal(new Set(room.seats.map(({ row, number }) => `${row}:${number}`)).size, room.seats.length);
    assert.ok(room.seats.every((seat) => !("isBooked" in seat)));
    assert.deepEqual(room.seatLayout.rowLabels, [...new Set(room.seats.map(({ row }) => row))]);
    assert.ok(room.seats.every(({ column }) => column >= 1 && column <= room.seatLayout.columnCount));
  }
});

test("room seed never overwrites a layout versioned after insert", async () => {
  let operations;
  const database = {
    collection(name) {
      assert.equal(name, "rooms");
      return {
        async bulkWrite(ops) {
          operations = ops;
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: ops.length };
        },
      };
    },
  };

  await seedRooms(database);

  for (const { updateOne } of operations) {
    for (const field of ["layoutVersion", "seatLayout", "seats", "capacity"]) {
      assert.equal(updateOne.update.$set[field], undefined, `${field} must not be in $set`);
      assert.notEqual(updateOne.update.$setOnInsert[field], undefined, `${field} must be in $setOnInsert`);
    }
  }
});

test("remote development seed requires an explicit opt-in", () => {
  assert.doesNotThrow(() =>
    assertDevelopmentSeedTarget("mongodb://localhost:27017/cinema_management", {}),
  );
  assert.throws(
    () => assertDevelopmentSeedTarget("mongodb+srv://user:pass@example.mongodb.net/dev", {}),
    /Remote database seed blocked/,
  );
  assert.doesNotThrow(() =>
    assertDevelopmentSeedTarget("mongodb+srv://user:pass@example.mongodb.net/dev", {
      ALLOW_REMOTE_DEVELOPMENT_SEED: "true",
    }),
  );
  assert.throws(
    () =>
      assertDevelopmentSeedTarget("mongodb://localhost:27017/cinema_management", {
        NODE_ENV: "production",
      }),
    /NODE_ENV=production/,
  );
});
