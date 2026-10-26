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
    fields: { customerAccountId: 1, createdAt: -1 },
    options: {
      name: "idx_payment_customer_history",
    },
  },
]);
