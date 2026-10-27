import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONCESSION_IMAGE_MAPPINGS,
  applyConcessionCatalogImages,
} from "../src/migrations/20261027-concession-catalog-images.js";

test("concession image migration uses exact-name, project-local image mappings", async () => {
  const updates = [];
  const db = {
    collection(name) {
      assert.equal(name, "concessions");
      return {
        async updateMany(filter, update) {
          updates.push({ filter, update });
          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
    },
  };

  const results = await applyConcessionCatalogImages(db);
  assert.equal(results.length, CONCESSION_IMAGE_MAPPINGS.length);
  assert.equal(results.length, 10);
  assert.equal(updates.length, 10);
  for (const { filter, update } of updates) {
    assert.ok(Array.isArray(filter.name.$in));
    assert.ok(filter.name.$in.every((name) => typeof name === "string"));
    assert.match(
      update.$set.imageUrl,
      /^\/images\/concessions\/[a-z0-9-]+\.png$/,
    );
  }
});
