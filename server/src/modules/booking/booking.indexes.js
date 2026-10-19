export const BOOKING_INDEXES = Object.freeze([
  {
    fields: { bookingCode: 1 },
    options: { unique: true, name: "bookingCode_1" },
  },
  {
    fields: { payableReference: 1 },
    options: {
      unique: true,
      name: "uniq_booking_payable_reference",
      partialFilterExpression: { payableReference: { $type: "string" } },
    },
  },
  {
    fields: { holdId: 1 },
    options: {
      unique: true,
      name: "uniq_booking_hold",
      partialFilterExpression: { holdId: { $type: "objectId" } },
    },
  },
  {
    fields: { customerAccountId: 1, requestKey: 1 },
    options: {
      unique: true,
      name: "uniq_booking_customer_request",
      partialFilterExpression: { requestKey: { $type: "string" } },
    },
  },
  {
    fields: { customerAccountId: 1, bookingTime: -1, _id: -1 },
    options: { name: "idx_booking_customer_history" },
  },
]);
