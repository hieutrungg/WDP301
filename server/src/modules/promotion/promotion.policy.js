import { AppError } from "../../utils/AppError.js";

export const promoError = (code, message, status = 409) =>
  new AppError(status, message, [], code);
export const normalizeCode = (code) => String(code).trim().toUpperCase();
export function percentageBasisPoints(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 20 ||
    Math.round(value * 100) / 100 !== value
  ) {
    throw promoError(
      "INVALID_PROMOTION",
      "Enter a percentage greater than 0 and at most 20, with up to two decimals",
      400,
    );
  }
  return Math.round(value * 100);
}
export function discountForTickets(ticketAmount, percentage) {
  if (!Number.isSafeInteger(ticketAmount) || ticketAmount < 0)
    throw promoError("INVALID_VOUCHER", "Invalid ticket amount", 400);
  return Number(
    (BigInt(ticketAmount) * BigInt(percentageBasisPoints(percentage))) / 10000n,
  );
}
export const displayStatus = (promotion, now = new Date()) =>
  promotion.status !== "ACTIVE"
    ? "Disabled"
    : new Date(promotion.startDate) > now
      ? "Scheduled"
      : new Date(promotion.endDate) <= now
        ? "Expired"
        : "Active";
export const promotionDto = (p, now) => ({
  id: String(p._id),
  name: p.name,
  discountType: p.discountType,
  discountValue: p.discountValue,
  startDate: p.startDate,
  endDate: p.endDate,
  status: p.status,
  displayStatus: displayStatus(p, now),
  version: p.version,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});
export const voucherDto = (v) => ({
  id: String(v._id),
  promotionId: String(v.promotionId),
  code: v.code,
  usageLimit: v.usageLimit,
  usedCount: v.usedCount,
  reservedCount: v.reservedCount,
  remainingUses:
    v.usageLimit === null
      ? null
      : Math.max(0, v.usageLimit - v.usedCount - v.reservedCount),
  validFrom: v.validFrom,
  validTo: v.validTo,
  status: v.status,
  version: v.version,
});
