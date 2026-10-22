import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ROOM_NAME_INDEX,
  ensureRoomIndexes,
  findDuplicateRoomNames,
} from "../src/migrations/20261021-room-management-indexes.js";

const fixture = ({ rooms = [], indexes } = {}) => {
  const writes = [];
  let stored = indexes;

  const collection = {
    listIndexes() {
      return {
        async toArray() {
          if (!stored) throw Object.assign(new Error("ns does not exist"), { code: 26 });
          return stored;
        },
      };
    },
    find() {
      return (async function* () {
        yield* rooms;
      })();
    },
    async createIndex(fields, options) {
      writes.push({ fields, options });
      stored = [...(stored ?? []), { key: fields, ...options }];
      return options.name;
    },
  };

  return { database: { collection: () => collection }, writes };
};

test("creates the unique normalized name index on a database that has none", async () => {
  const { database, writes } = fixture();

  assert.deepEqual(await ensureRoomIndexes(database), ["rooms.uniq_room_branch_name_normalized"]);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].fields, { branchId: 1, roomName: 1 });
  assert.equal(writes[0].options.unique, true);
  assert.deepEqual(writes[0].options.collation, { locale: "en", strength: 2 });
});

test("is safe to run twice", async () => {
  const { database, writes } = fixture();

  await ensureRoomIndexes(database);
  await ensureRoomIndexes(database);
  assert.equal(writes.length, 1);
});

test("refuses to build over names that collide ignoring case and spacing", async () => {
  const rooms = [
    { _id: "a", branchId: "b1", roomName: "Room 01" },
    { _id: "b", branchId: "b1", roomName: " room   01 " },
    { _id: "c", branchId: "b2", roomName: "Room 01" },
  ];
  const { database, writes } = fixture({ rooms });

  assert.equal((await findDuplicateRoomNames(database.collection())).length, 1);
  await assert.rejects(() => ensureRoomIndexes(database), /Duplicate room names/);
  assert.equal(writes.length, 0);
});

test("never replaces an existing index with the same name but different options", async () => {
  const { database, writes } = fixture({
    indexes: [{ name: ROOM_NAME_INDEX.options.name, key: ROOM_NAME_INDEX.fields }],
  });

  await assert.rejects(() => ensureRoomIndexes(database), /Incompatible index/);
  assert.equal(writes.length, 0);
});
