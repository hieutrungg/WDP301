import assert from "node:assert/strict";
import { test } from "node:test";
import { createRefundService } from "../src/modules/refund/refund.service.js";

const oid = (suffix) => `0000000000000000000000${suffix}`.slice(-24);
const now = new Date("2026-10-27T08:00:00.000Z");

const harness = ({ pickupStatus = "AWAITING_PICKUP", checkedIn = false, providerFails = false } = {}) => {
  let stored = null;
  let finalized = 0;
  const repository = {
    async loadEligibility() { return {
      booking: { _id: oid("01"), customerAccountId: oid("02"), status: "CONFIRMED", subtotal: 200000 },
      payment: { _id: oid("03"), status: "PAID", amount: 280000, method: "VNPAY_QR" },
      showtime: { startAt: new Date(now.getTime() + 120 * 60_000) },
      order: { totalAmount: 80000, pickupStatus }, checkedIn,
    }; },
    async findByBookingId() { return stored; },
    async create(doc) { stored = { _id: oid("04"), ...doc }; return stored; },
    async listForCustomer() { return stored ? [stored] : []; },
    async listForManager() { return stored ? [stored] : []; },
    async findById() { return stored; },
    async claimForProcessing(_id, actorId) { if (!["REQUESTED", "FAILED"].includes(stored.status)) return null; stored = { ...stored, status: "PROCESSING", processedBy: actorId }; return stored; },
    async markFailed(_id, reason) { stored = { ...stored, status: "FAILED", failureReason: reason }; return stored; },
    async reject(_id, actorId, reason) { if (stored.status !== "REQUESTED") return null; stored = { ...stored, status: "REJECTED", rejectedBy: actorId, rejectionReason: reason }; return stored; },
    async finalize(_refund, result) { finalized += 1; stored = { ...stored, status: "REFUNDED", providerRefundReference: result.reference }; return stored; },
  };
  const provider = { async refund() { if (providerFails) throw new Error("gateway down"); return { reference: "RFD-001" }; } };
  return { service: createRefundService({ repository, provider, clock: () => now }), repository, getStored: () => stored, getFinalized: () => finalized };
};

test("refund snapshots ticket plus unfulfilled F&B and processes idempotently", async () => {
  const h = harness();
  const requested = await h.service.request({ bookingId: oid("01"), customerAccountId: oid("02"), reason: "Cannot attend the screening" });
  assert.equal(requested.refundAmount, 280000);
  assert.equal(requested.concessionAmount, 80000);
  const processed = await h.service.process({ refundId: requested.refundId, managerId: oid("09") });
  assert.equal(processed.status, "REFUNDED");
  const duplicate = await h.service.process({ refundId: requested.refundId, managerId: oid("09") });
  assert.equal(duplicate.status, "REFUNDED");
  assert.equal(h.getFinalized(), 1);
});

test("fulfilled F&B is excluded from the refund", async () => {
  const h = harness({ pickupStatus: "FULFILLED" });
  const requested = await h.service.request({ bookingId: oid("01"), customerAccountId: oid("02"), reason: "Cannot attend the screening" });
  assert.equal(requested.refundAmount, 200000);
  assert.equal(requested.concessionAmount, 0);
});

test("cutoff and checked-in bookings are rejected", async () => {
  const checked = harness({ checkedIn: true });
  await assert.rejects(() => checked.service.request({ bookingId: oid("01"), customerAccountId: oid("02"), reason: "Cannot attend the screening" }), /Checked-in/);
  const h = harness();
  h.repository.loadEligibility = async () => ({ booking: { _id: oid("01"), customerAccountId: oid("02"), status: "CONFIRMED", subtotal: 1 }, payment: { _id: oid("03"), status: "PAID", amount: 1, method: "VNPAY_QR" }, showtime: { startAt: new Date(now.getTime() + 30 * 60_000) }, order: null, checkedIn: false });
  await assert.rejects(() => h.service.request({ bookingId: oid("01"), customerAccountId: oid("02"), reason: "Cannot attend the screening" }), /45 minutes/);
});

test("provider failure records FAILED and keeps the request retryable", async () => {
  const h = harness({ providerFails: true });
  const requested = await h.service.request({ bookingId: oid("01"), customerAccountId: oid("02"), reason: "Cannot attend the screening" });
  await assert.rejects(() => h.service.process({ refundId: requested.refundId, managerId: oid("09") }), /can be retried/);
  assert.equal(h.getStored().status, "FAILED");
  assert.equal(h.getFinalized(), 0);
});
