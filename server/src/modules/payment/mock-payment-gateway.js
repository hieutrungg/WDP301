import { createHash, randomBytes } from "node:crypto";
import { PAYMENT_METHOD_META, PAYMENT_OUTCOME } from "./payment.constants.js";

export const DEMO_PAYMENT_DISCLAIMER =
  "DEMO PAYMENT — NOT A REAL TRANSACTION";

const defaultReferenceFactory = (prefix, attemptNumber) =>
  `${prefix}-MOCK-${attemptNumber}-${randomBytes(4).toString("hex").toUpperCase()}`;

export const buildMockQrPayload = ({
  attemptId,
  payableReference,
  method,
  amount,
  currency = "VND",
}) => {
  const checksum = createHash("sha256")
    .update(`${attemptId}:${payableReference}:${method}:${amount}:${currency}:MOCK`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();

  return `FCINEMA-MOCK://payment/${encodeURIComponent(attemptId)}?ref=${encodeURIComponent(
    payableReference,
  )}&method=${encodeURIComponent(method)}&amount=${amount}&currency=${encodeURIComponent(
    currency,
  )}&sig=${checksum}&mode=DEMO_NOT_REAL`;
};

export const createMockPaymentGateway = ({
  referenceFactory = defaultReferenceFactory,
} = {}) => {
  const buildInstruction = ({
    attemptId,
    attemptNumber = 1,
    payableReference,
    method,
    amount,
    currency = "VND",
    expiresAt,
  }) => {
    const meta = PAYMENT_METHOD_META[method] ?? {
      id: method,
      label: method,
      prefix: "MOCK",
      gatewayName: "F-Cinema Internal Mock Gateway",
      subtitle: "Internal Mock Gateway",
      badge: "MOCK",
    };
    const gatewayReference = referenceFactory(meta.prefix, attemptNumber);
    const qrPayload = buildMockQrPayload({
      attemptId,
      payableReference,
      method,
      amount,
      currency,
    });

    return {
      provider: "INTERNAL_MOCK_GATEWAY",
      isDemo: true,
      method,
      methodLabel: meta.label,
      gatewayName: meta.gatewayName,
      subtitle: meta.subtitle,
      badge: meta.badge,
      gatewayReference,
      gatewayTransactionRef: gatewayReference,
      qrPayload,
      disclaimer: DEMO_PAYMENT_DISCLAIMER,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  };

  return {
    createPayment: buildInstruction,
    createAttemptInstruction: buildInstruction,

    verifyWebhook(envelope = {}) {
      const outcome =
        envelope.outcome === PAYMENT_OUTCOME.FAILED
          ? PAYMENT_OUTCOME.FAILED
          : PAYMENT_OUTCOME.SUCCESS;

      return {
        provider: "INTERNAL_MOCK_GATEWAY",
        paymentId: String(envelope.paymentId ?? ""),
        attemptId: String(envelope.attemptId ?? ""),
        notificationKey: String(envelope.notificationKey ?? ""),
        outcome,
        failureReason: envelope.failureReason
          ? String(envelope.failureReason)
          : undefined,
        occurredAt: envelope.occurredAt
          ? new Date(envelope.occurredAt)
          : new Date(),
      };
    },
  };
};

export const mockPaymentGateway = createMockPaymentGateway();
