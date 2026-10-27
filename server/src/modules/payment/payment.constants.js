export const PAYMENT_CURRENCY = "VND";

export const PAYMENT_STATUS = Object.freeze({
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
});

export const PAYMENT_STATUSES = Object.freeze(Object.values(PAYMENT_STATUS));

export const PAYMENT_ATTEMPT_STATUS = Object.freeze({
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  LATE_SUCCEEDED: "LATE_SUCCEEDED",
});

export const PAYMENT_ATTEMPT_STATUSES = Object.freeze(
  Object.values(PAYMENT_ATTEMPT_STATUS),
);

export const PAYMENT_METHOD = Object.freeze({
  BANK_TRANSFER: "BANK_TRANSFER",
  CASH: "CASH",
  MOMO_WALLET: "MOMO_WALLET",
  VNPAY_QR: "VNPAY_QR",
  CREDIT_DEBIT_CARD: "CREDIT_DEBIT_CARD",
  ZALOPAY_APPLE_PAY: "ZALOPAY_APPLE_PAY",
});

export const PAYMENT_METHODS = PAYMENT_METHOD;
export const PAYMENT_METHOD_VALUES = Object.freeze(
  Object.values(PAYMENT_METHOD).filter((method) => method !== PAYMENT_METHOD.CASH),
);
export const PAYMENT_ACCEPTED_METHOD_VALUES = Object.freeze(Object.values(PAYMENT_METHOD));

export const PAYMENT_PROVIDER = Object.freeze({
  MOCK: "INTERNAL_MOCK_GATEWAY",
  PAYOS: "PAYOS",
});

export const PAYMENT_METHOD_META = Object.freeze({
  [PAYMENT_METHOD.BANK_TRANSFER]: Object.freeze({
    id: PAYMENT_METHOD.BANK_TRANSFER,
    label: "Bank transfer (VietQR)",
    gatewayName: "payOS — VietQR bank transfer",
    subtitle: "Scan with any Vietnamese banking app",
    badge: "QR",
    prefix: "PAYOS",
    provider: "PAYOS",
  }),
  [PAYMENT_METHOD.CASH]: Object.freeze({
    id: PAYMENT_METHOD.CASH,
    label: "Cash at counter",
    gatewayName: "F-Cinema Counter Cash",
    subtitle: "Staff-confirmed counter settlement",
    badge: "CASH",
    prefix: "CASH",
    provider: "COUNTER",
  }),
  [PAYMENT_METHOD.MOMO_WALLET]: Object.freeze({
    id: PAYMENT_METHOD.MOMO_WALLET,
    label: "MoMo E-Wallet",
    gatewayName: "MoMo E-Wallet Payment Gateway",
    subtitle: "Official Partner • Instant Refund",
    badge: "MoMo",
    prefix: "MOMO",
    provider: "MOCK",
  }),
  [PAYMENT_METHOD.VNPAY_QR]: Object.freeze({
    id: PAYMENT_METHOD.VNPAY_QR,
    label: "VNPAY-QR / VietQR",
    gatewayName: "VNPay — QR / MomoQR Gateway",
    subtitle: "30+ Vietnam Banking Apps",
    badge: "VNPAY",
    prefix: "VNPAY",
    provider: "MOCK",
  }),
  [PAYMENT_METHOD.CREDIT_DEBIT_CARD]: Object.freeze({
    id: PAYMENT_METHOD.CREDIT_DEBIT_CARD,
    label: "Credit / Debit Card",
    gatewayName: "International Card Payment Gateway",
    subtitle: "Visa, Mastercard, JCB, Amex",
    badge: "CARD",
    prefix: "CARD",
    provider: "MOCK",
  }),
  [PAYMENT_METHOD.ZALOPAY_APPLE_PAY]: Object.freeze({
    id: PAYMENT_METHOD.ZALOPAY_APPLE_PAY,
    label: "ZaloPay / Apple Pay",
    gatewayName: "ZaloPay / Apple Pay Bridge",
    subtitle: "1-Touch Biometric checkout",
    badge: "Zalo",
    prefix: "ZALO",
    provider: "MOCK",
  }),
});

export const PAYMENT_SIMULATION_OUTCOME = Object.freeze({
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
});

export const PAYMENT_OUTCOME = PAYMENT_SIMULATION_OUTCOME;
export const PAYMENT_OUTCOMES = Object.freeze(
  Object.values(PAYMENT_SIMULATION_OUTCOME),
);
export const PAYMENT_SIMULATION_OUTCOME_VALUES = PAYMENT_OUTCOMES;

export const PAYMENT_RECONCILIATION_REASON = Object.freeze({
  LATE_PAYMENT_AFTER_EXPIRY: "LATE_PAYMENT_AFTER_EXPIRY",
  // A second real transfer arrived after another attempt had already settled the booking.
  DUPLICATE_PROVIDER_PAYMENT: "DUPLICATE_PROVIDER_PAYMENT",
});

export const PAYMENT_ERROR_CODE = Object.freeze({
  INVALID_PAYMENT: "INVALID_PAYMENT",
  BOOKING_NOT_FOUND: "BOOKING_NOT_FOUND",
  BOOKING_FORBIDDEN: "BOOKING_FORBIDDEN",
  BOOKING_EXPIRED: "BOOKING_EXPIRED",
  BOOKING_ALREADY_EXPIRED: "BOOKING_ALREADY_EXPIRED",
  BOOKING_ALREADY_CONFIRMED: "BOOKING_ALREADY_CONFIRMED",
  PAYMENT_NOT_FOUND: "PAYMENT_NOT_FOUND",
  PAYMENT_FORBIDDEN: "PAYMENT_FORBIDDEN",
  PAYMENT_ALREADY_SETTLED: "PAYMENT_ALREADY_SETTLED",
  PAYMENT_REVIEW_REQUIRED: "PAYMENT_REVIEW_REQUIRED",
  PAYMENT_ATTEMPT_NOT_FOUND: "PAYMENT_ATTEMPT_NOT_FOUND",
  ATTEMPT_NOT_FOUND: "PAYMENT_ATTEMPT_NOT_FOUND",
  PAYMENT_ATTEMPT_NOT_PENDING: "PAYMENT_ATTEMPT_NOT_PENDING",
  INVALID_ATTEMPT_STATE: "PAYMENT_ATTEMPT_NOT_PENDING",
  PAYMENT_IDEMPOTENCY_KEY_REUSED: "PAYMENT_IDEMPOTENCY_KEY_REUSED",
  IDEMPOTENCY_KEY_REUSED: "PAYMENT_IDEMPOTENCY_KEY_REUSED",
  PAYMENT_AMOUNT_MISMATCH: "PAYMENT_AMOUNT_MISMATCH",
  AMOUNT_MISMATCH: "PAYMENT_AMOUNT_MISMATCH",
  MOCK_SIMULATION_DISABLED: "MOCK_SIMULATION_DISABLED",
  PAYMENT_PROVIDER_UNAVAILABLE: "PAYMENT_PROVIDER_UNAVAILABLE",
  PAYMENT_PROVIDER_ERROR: "PAYMENT_PROVIDER_ERROR",
  INVALID_PROVIDER_SIGNATURE: "INVALID_PROVIDER_SIGNATURE",
});

export const PAYMENT_ERROR = PAYMENT_ERROR_CODE;

// SRS 5.3 standard messages used by the UC30 payment flow. Messages are display text only;
// clients must branch on `code`.
export const PAYMENT_MESSAGE = Object.freeze({
  MSG14_SEAT_HOLD_EXPIRED: "Your seat hold has expired. Please select your seats again.",
  MSG18_PAYMENT_FAILED: "Payment failed. Please try again.",
  MSG19_BOOKING_CONFIRMED: "Booking confirmed successfully.",
});
