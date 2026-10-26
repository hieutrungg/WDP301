import { createHash } from "node:crypto";

const results = new Map();

export const mockRefundProvider = {
  async refund({ idempotencyKey, amount, method }) {
    if (results.has(idempotencyKey)) return results.get(idempotencyKey);
    const result = {
      provider: method === "CASH" ? "MANUAL_CASH" : "INTERNAL_MOCK_REFUND",
      reference: `RFD-${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 16).toUpperCase()}`,
      amount,
      manuallySettled: method === "CASH",
    };
    results.set(idempotencyKey, result);
    return result;
  },
};
