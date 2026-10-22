import assert from "node:assert/strict";
import { test } from "node:test";
import {
  catalogBadges,
  catalogPrice,
  readCatalogFilters,
} from "../src/features/concessions/utils/catalogPresentation.js";

test("unavailable and zero-price labels are independent", () => {
  assert.deepEqual(
    catalogBadges({ available: false, isSpecialOffer: true }).map(
      (b) => b.label,
    ),
    ["Unavailable", "Special offer"],
  );
  assert.deepEqual(
    catalogBadges({ available: true, isSpecialOffer: false }),
    [],
  );
  assert.match(catalogPrice(0), /^0/);
  assert.match(catalogPrice(65000), /65\.000/);
});
test("catalog navigation normalizes invalid filters and clears category for combos", () => {
  assert.deepEqual(
    readCatalogFilters(
      new URLSearchParams(
        "kind=combos&categoryId=111111111111111111111111&page=2",
      ),
    ),
    { kind: "combos", categoryId: "", page: 2 },
  );
  for (const page of ["-1", "0", "1e2", "1.5", "NaN", "999999999999999"])
    assert.equal(readCatalogFilters(new URLSearchParams({ page })).page, 1);
  assert.equal(
    readCatalogFilters(new URLSearchParams("categoryId=bad")).categoryId,
    "",
  );
});
