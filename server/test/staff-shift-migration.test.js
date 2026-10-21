import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureStaffShiftIndexes } from "../src/migrations/20261020-staff-shift-monitoring.js";
import { STAFF_SHIFT_INDEXES } from "../src/modules/staff-shift/staff-shift.indexes.js";

const expectedNames = Object.entries(STAFF_SHIFT_INDEXES).flatMap(([collection, definitions]) =>
  definitions.map(({ options }) => `${collection}.${options.name}`),
);

const fixture = (indexesByCollection = {}) => {
  const indexWrites = [];

  const database = {
    collection(name) {
      return {
        listIndexes() {
          return {
            async toArray() {
              if (!(name in indexesByCollection)) {
                throw Object.assign(new Error("ns does not exist"), { code: 26 });
              }
              return indexesByCollection[name];
            },
          };
        },
        async createIndex(fields, options) {
          indexWrites.push({ collection: name, fields, options });
          indexesByCollection[name] = [...(indexesByCollection[name] ?? []), { key: fields, ...options }];
          return options.name;
        },
      };
    },
  };

  return { database, indexWrites };
};

test("migration creates every staff shift index on a database that has none", async () => {
  const { database, indexWrites } = fixture();

  assert.deepEqual(await ensureStaffShiftIndexes(database), expectedNames);
  assert.equal(indexWrites.length, expectedNames.length);
  assert.deepEqual(Object.keys(STAFF_SHIFT_INDEXES), ["staff_shifts"], "no attendance or review collections");
});

test("migration is safe to re-run: existing indexes are reused without writes", async () => {
  const { database, indexWrites } = fixture();
  await ensureStaffShiftIndexes(database);
  const writesOnce = indexWrites.length;

  assert.deepEqual(await ensureStaffShiftIndexes(database), expectedNames);
  assert.equal(indexWrites.length, writesOnce);
});

test("migration stops without writing when an existing index has the same name but another key", async () => {
  const { database, indexWrites } = fixture({
    staff_shifts: [{ key: { startTime: 1 }, name: "idx_staff_shift_branch_start" }],
  });

  await assert.rejects(() => ensureStaffShiftIndexes(database), /Incompatible index idx_staff_shift_branch_start/);
  assert.equal(indexWrites.length, 0, "nothing was created or replaced");
});
