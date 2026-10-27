import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import {
  promoError,
  normalizeCode,
  percentageBasisPoints,
} from "./promotion.policy.js";

const integer = {
  bsonType: ["int", "long", "double"],
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
  multipleOf: 1,
};
const oid = { bsonType: "objectId" };
const date = { bsonType: "date" };
const status = { enum: ["ACTIVE", "INACTIVE"] };
const schema = (required, properties) => ({
  $jsonSchema: {
    bsonType: "object",
    description: "PROMO-101/v1",
    required,
    properties,
  },
});
export const PROMOTION_VALIDATORS = {
  promotions: schema(
    [
      "name",
      "discountType",
      "discountValue",
      "startDate",
      "endDate",
      "status",
      "version",
    ],
    {
      name: { bsonType: "string", minLength: 1, maxLength: 150 },
      discountType: { enum: ["PERCENTAGE"] },
      discountValue: {
        bsonType: ["int", "long", "double"],
        minimum: 0.01,
        maximum: 20,
      },
      startDate: date,
      endDate: date,
      status,
      version: integer,
    },
  ),
  vouchers: schema(
    [
      "promotionId",
      "code",
      "usageLimit",
      "usedCount",
      "reservedCount",
      "validFrom",
      "validTo",
      "status",
      "version",
    ],
    {
      promotionId: oid,
      code: { bsonType: "string", pattern: "^[A-Z0-9_-]{3,40}$" },
      usageLimit: { anyOf: [{ bsonType: "null" }, { ...integer, minimum: 1 }] },
      usedCount: integer,
      reservedCount: integer,
      validFrom: date,
      validTo: date,
      status,
      version: integer,
    },
  ),
  voucher_redemptions: schema(
    [
      "bookingId",
      "customerAccountId",
      "voucherId",
      "state",
      "blocking",
      "expiresAt",
      "snapshot",
    ],
    {
      bookingId: oid,
      customerAccountId: oid,
      voucherId: oid,
      state: { enum: ["RESERVED", "CONSUMED", "RELEASED"] },
      blocking: { bsonType: "bool" },
      expiresAt: date,
      snapshot: {
        bsonType: "object",
        required: [
          "voucherId",
          "reservationId",
          "code",
          "promotionName",
          "discountValue",
          "discountAmount",
        ],
        properties: {
          voucherId: oid,
          reservationId: oid,
          discountAmount: integer,
        },
      },
      paymentId: oid,
    },
  ),
  voucher_commands: schema(
    ["bookingId", "requestKey", "fingerprint", "result"],
    {
      bookingId: oid,
      requestKey: { bsonType: "string" },
      fingerprint: { bsonType: "string" },
      result: { bsonType: "object" },
    },
  ),
};
export const PROMOTION_INDEXES = [
  ["vouchers", { code: 1 }, { name: "uniq_voucher_code", unique: true }],
  [
    "voucher_redemptions",
    { customerAccountId: 1, voucherId: 1 },
    {
      name: "uniq_customer_voucher_claim",
      unique: true,
      partialFilterExpression: { blocking: true },
    },
  ],
  [
    "voucher_redemptions",
    { bookingId: 1 },
    {
      name: "uniq_booking_voucher_claim",
      unique: true,
      partialFilterExpression: { blocking: true },
    },
  ],
  [
    "voucher_redemptions",
    { voucherId: 1, state: 1, expiresAt: 1 },
    { name: "idx_voucher_expiry" },
  ],
  [
    "voucher_commands",
    { bookingId: 1, requestKey: 1 },
    { name: "uniq_voucher_command", unique: true },
  ],
];
export const indexMatches = (index, key, options) =>
  isDeepStrictEqual(index.key, key) &&
  Boolean(index.unique) === Boolean(options.unique) &&
  isDeepStrictEqual(
    index.partialFilterExpression,
    options.partialFilterExpression,
  ) &&
  !index.sparse &&
  !index.collation &&
  index.expireAfterSeconds === undefined;
export const storageUnavailable = () =>
  promoError(
    "VOUCHER_STORAGE_NOT_READY",
    "Voucher storage requires review or migration. You can continue without a voucher.",
    503,
  );

export async function inspectPromotionStorage(db) {
  const collections = await db
    .listCollections({}, { nameOnly: false })
    .toArray();
  const missing = [];
  for (const [name, validator] of Object.entries(PROMOTION_VALIDATORS)) {
    const current = collections.find((c) => c.name === name);
    if (
      !current ||
      !isDeepStrictEqual(current.options?.validator, validator) ||
      current.options?.validationLevel !== "strict" ||
      current.options?.validationAction !== "error"
    )
      missing.push(`${name}: validator`);
  }
  for (const [name, key, options] of PROMOTION_INDEXES) {
    const indexes = collections.some((c) => c.name === name)
      ? await db.collection(name).listIndexes().toArray()
      : [];
    if (!indexes.some((i) => indexMatches(i, key, options)))
      missing.push(`${name}: ${options.name}`);
  }
  return { missing };
}
export async function assertPromotionStorage(db = mongoose.connection.db) {
  if (!db || (await inspectPromotionStorage(db)).missing.length)
    throw storageUnavailable();
}
export function validPromotion(p) {
  try {
    percentageBasisPoints(p.discountValue);
  } catch {
    return false;
  }
  return (
    p.discountType === "PERCENTAGE" &&
    typeof p.name === "string" &&
    p.name.trim().length > 0 &&
    p.name.length <= 150 &&
    ["ACTIVE", "INACTIVE"].includes(p.status) &&
    Number.isSafeInteger(p.version) &&
    p.version >= 0 &&
    p.startDate instanceof Date &&
    p.endDate instanceof Date &&
    p.startDate < p.endDate
  );
}
export function validVoucher(v) {
  return (
    typeof v.code === "string" &&
    v.code === normalizeCode(v.code) &&
    /^[A-Z0-9_-]{3,40}$/.test(v.code) &&
    (v.usageLimit === null ||
      (Number.isSafeInteger(v.usageLimit) && v.usageLimit > 0)) &&
    [v.usedCount, v.reservedCount, v.version].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) &&
    Number.isSafeInteger(v.usedCount + v.reservedCount) &&
    (v.usageLimit === null || v.usedCount + v.reservedCount <= v.usageLimit) &&
    ["ACTIVE", "INACTIVE"].includes(v.status) &&
    v.validFrom instanceof Date &&
    v.validTo instanceof Date &&
    v.validFrom < v.validTo
  );
}

// Inspect every legacy row without casting or repairing it. Counters alone cannot identify Customers.
export async function auditPromotionData(db) {
  const errors = [];
  const promotions = new Map();
  for await (const p of db.collection("promotions").find({})) {
    if (!validPromotion(p)) errors.push(`Invalid promotion ${p._id}`);
    promotions.set(String(p._id), p);
  }
  const codes = new Set();
  for await (const v of db.collection("vouchers").find({})) {
    const p = promotions.get(String(v.promotionId));
    if (
      !validVoucher(v) ||
      !p ||
      +v.validFrom !== +p.startDate ||
      +v.validTo !== +p.endDate
    )
      errors.push(`Invalid voucher/parent/window ${v._id}`);
    const code = normalizeCode(v.code);
    if (codes.has(code))
      errors.push(`Duplicate canonical voucher code at ${v._id}`);
    codes.add(code);
    const [held, used] = await Promise.all([
      db
        .collection("voucher_redemptions")
        .countDocuments({ voucherId: v._id, state: "RESERVED" }),
      db
        .collection("voucher_redemptions")
        .countDocuments({ voucherId: v._id, state: "CONSUMED" }),
    ]);
    if (held !== v.reservedCount || used !== v.usedCount)
      errors.push(`Unreconciled counters/history ${v._id}`);
  }
  for (const [name, validator] of Object.entries(PROMOTION_VALIDATORS)) {
    if (await db.collection(name).countDocuments({ $nor: [validator] }))
      errors.push(`${name}: rows incompatible with validator`);
  }
  for await (const row of db.collection("voucher_redemptions").find({})) {
    const booking = await db
      .collection("bookings")
      .findOne({ _id: row.bookingId });
    const voucher = await db
      .collection("vouchers")
      .findOne({ _id: row.voucherId });
    if (
      !voucher ||
      !booking ||
      String(booking.customerAccountId) !== String(row.customerAccountId) ||
      row.blocking !== (row.state !== "RELEASED") ||
      (row.state === "CONSUMED" &&
        (!row.paymentId ||
          !["CONFIRMED", "REFUNDED"].includes(booking.status))) ||
      (row.state === "RESERVED" &&
        String(booking.voucherSnapshot?.reservationId) !== String(row._id))
    )
      errors.push(`Incompatible redemption links/state ${row._id}`);
  }
  for (const [name, key, options] of PROMOTION_INDEXES.filter(
    (i) => i[2].unique,
  )) {
    const stages = options.partialFilterExpression
      ? [{ $match: options.partialFilterExpression }]
      : [];
    const duplicates = await db
      .collection(name)
      .aggregate([
        ...stages,
        {
          $group: {
            _id: Object.fromEntries(Object.keys(key).map((k) => [k, `$${k}`])),
            n: { $sum: 1 },
          },
        },
        { $match: { n: { $gt: 1 } } },
        { $limit: 1 },
      ])
      .toArray();
    if (duplicates.length) errors.push(`${name}: duplicate ${options.name}`);
  }
  for await (const booking of db
    .collection("bookings")
    .find({
      $or: [
        { voucherId: { $type: "objectId" } },
        { discountAmount: { $gt: 0 } },
      ],
    })) {
    const snapshot = booking.voucherSnapshot;
    if (
      !snapshot ||
      String(snapshot.voucherId) !== String(booking.voucherId) ||
      !snapshot.reservationId ||
      !(await db
        .collection("voucher_redemptions")
        .findOne({
          _id: snapshot.reservationId,
          bookingId: booking._id,
          customerAccountId: booking.customerAccountId,
        }))
    )
      errors.push(`Untraceable discounted booking ${booking._id}`);
  }
  return errors;
}
