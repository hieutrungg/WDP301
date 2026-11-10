import assert from "node:assert/strict";
import test from "node:test";
import { uniqueAvailableCatalogItems } from "../src/features/concessions/utils/catalogDisplay.js";

test("Browse F&B hides unavailable and exact duplicate catalog records", () => {
  const items = [
    { id: "1", name: "Cheddar Cheese Popcorn", size: "M", price: 59000, available: true },
    { id: "2", name: " cheddar cheese popcorn ", size: "M", price: 59000, available: true },
    { id: "3", name: "Caramel Popcorn", size: "M", price: 65000, available: true },
    { id: "4", name: "Sold out", size: "M", price: 35000, available: false },
  ];

  assert.deepEqual(
    uniqueAvailableCatalogItems(items).map(({ id }) => id),
    ["1", "3"],
  );
});

test("products with a different size or price remain distinct", () => {
  const items = [
    { id: "1", name: "Popcorn", size: "M", price: 59000, available: true },
    { id: "2", name: "Popcorn", size: "L", price: 59000, available: true },
    { id: "3", name: "Popcorn", size: "M", price: 69000, available: true },
  ];

  assert.equal(uniqueAvailableCatalogItems(items).length, 3);
});

test("similarly pictured products with different names remain visible", () => {
  const items = [
    {
      id: "1",
      name: "Dasani Mineral Water",
      size: "500ml",
      price: 22000,
      imageUrl: "/images/dasani.png",
      available: true,
    },
    {
      id: "2",
      name: "Dasani Pure Mineral Water",
      size: "500ml",
      price: 22000,
      imageUrl: "/images/dasani.png",
      available: true,
    },
  ];

  assert.deepEqual(
    uniqueAvailableCatalogItems(items).map(({ id }) => id),
    ["1", "2"],
  );
});
