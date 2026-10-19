import assert from "node:assert/strict";
import { test } from "node:test";
import dns from "node:dns";
import { configureMongoDns } from "../src/config/mongo-dns.js";

test("Mongo DNS override trims servers and ignores empty entries", (t) => {
  const setter = t.mock.method(dns, "setServers", () => {});
  configureMongoDns(" 1.1.1.1, ,8.8.8.8 ");
  assert.deepEqual(setter.mock.calls[0].arguments, [["1.1.1.1", "8.8.8.8"]]);
  assert.equal(setter.mock.callCount(), 1);
});

test("empty Mongo DNS configuration preserves system DNS", (t) => {
  const setter = t.mock.method(dns, "setServers", () => {});
  configureMongoDns("");
  configureMongoDns(" , ");
  assert.equal(setter.mock.callCount(), 0);
});
