import assert from "node:assert/strict";
import { test } from "node:test";
import { branchSeeds } from "../src/seeds/seed-branches.js";
import { movieSeeds } from "../src/seeds/seed-movies.js";
import { roomSeeds } from "../src/seeds/seed-rooms.js";
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
  const allowedStatuses = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

  assert.ok(movieSeeds.length >= 6);
  assert.ok(movieSeeds.every(({ status }) => allowedStatuses.has(status)));
  assert.deepEqual(new Set(movieSeeds.map(({ status }) => status)), allowedStatuses);
});

test("branch and room fixtures satisfy the approved M0 invariants", () => {
  const branchKeys = new Set(branchSeeds.map(({ seedKey }) => seedKey));
  const normalizedBranchNames = branchSeeds.map(({ branchName }) => branchName.trim().toLowerCase());

  assert.equal(new Set(normalizedBranchNames).size, branchSeeds.length);
  assert.ok(branchSeeds.every(({ branchName, address }) => branchName && address));
  assert.ok(branchSeeds.every(({ status }) => status === "ACTIVE"));

  for (const room of roomSeeds) {
    assert.ok(branchKeys.has(room.branchSeedKey));
    assert.equal(room.layoutVersion, 1);
    assert.equal(room.capacity, room.seats.filter(({ status }) => status === "ENABLED").length);
    assert.equal(new Set(room.seats.map(({ _id }) => _id.toString())).size, room.seats.length);
    assert.equal(new Set(room.seats.map(({ row, number }) => `${row}:${number}`)).size, room.seats.length);
    assert.ok(room.seats.every((seat) => !("isBooked" in seat)));
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
