const normalize = (value) =>
  typeof value === "string" ? value.trim().toLocaleLowerCase("en-US") : "";

export function uniqueAvailableCatalogItems(items = []) {
  const seenProducts = new Set();
  return items.filter((item) => {
    if (!item?.available) return false;
    const productIdentity = [
      normalize(item.name),
      normalize(item.size),
      normalize(item.category?.name),
      Number.isSafeInteger(item.price) ? item.price : "invalid-price",
    ].join("|");
    if (seenProducts.has(productIdentity)) return false;
    seenProducts.add(productIdentity);
    return true;
  });
}
