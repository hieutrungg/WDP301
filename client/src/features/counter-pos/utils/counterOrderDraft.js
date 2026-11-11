const prefix = "fcinema:counter-order:v1:";
const key = (accountId) => `${prefix}${accountId}`;

const validFoodLine = (line) =>
  ["CONCESSION", "COMBO"].includes(line?.itemType) &&
  typeof line.itemId === "string" &&
  Number.isSafeInteger(line.quantity) &&
  line.quantity > 0;

export function readCounterOrderDraft(storage, accountId) {
  if (!accountId) return null;
  try {
    const value = JSON.parse(storage.getItem(key(accountId)));
    if (
      value?.accountId !== accountId ||
      typeof value.movieId !== "string" ||
      typeof value.showtimeId !== "string" ||
      typeof value.date !== "string" ||
      !Array.isArray(value.selectedIds) ||
      !value.selectedIds.length ||
      !value.selectedIds.every((id) => typeof id === "string") ||
      !Array.isArray(value.foodItems) ||
      !value.foodItems.every(validFoodLine)
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export function writeCounterOrderDraft(storage, draft) {
  storage.setItem(key(draft.accountId), JSON.stringify(draft));
  return draft;
}

export function clearCounterOrderDraft(storage, accountId) {
  if (accountId) storage.removeItem(key(accountId));
}
