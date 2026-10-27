export const PAYMENT_INDEXES = Object.freeze([
  {
    fields: { orderId: 1 },
    options: {
      unique: true,
      name: "uniq_payment_order",
      partialFilterExpression: { orderId: { $type: "objectId" } },
    },
  },
  {
    fields: { bookingId: 1 },
    options: {
      unique: true,
      name: "uniq_payment_booking",
      partialFilterExpression: { bookingId: { $type: "objectId" } },
    },
  },
  {
    fields: { payableReference: 1 },
    options: {
      unique: true,
      name: "uniq_payment_payable_reference",
      partialFilterExpression: { payableReference: { $type: "string" } },
    },
  },
  {
    fields: { "attempts.attemptId": 1 },
    options: {
      unique: true,
      sparse: true,
      name: "uniq_payment_attempt_id",
    },
  },
  {
    // Webhook lookup by payOS orderCode. Not unique: payOS itself rejects a reused orderCode,
    // and a unique multikey index would collide on attempts that have no provider code.
    fields: { "attempts.providerOrderCode": 1 },
    options: {
      sparse: true,
      name: "idx_payment_provider_order_code",
    },
  },
  {
    fields: { customerAccountId: 1, createdAt: -1 },
    options: {
      name: "idx_payment_customer_history",
    },
  },
]);
