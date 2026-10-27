import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { AppError } from "../../utils/AppError.js";
import {
  PAYMENT_ERROR_CODE,
  PAYMENT_METHOD_META,
  PAYMENT_PROVIDER,
} from "./payment.constants.js";

// payOS payment-link statuses (GET /v2/payment-requests/{orderCode}).
export const PAYOS_LINK_STATUS = Object.freeze({
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
});

const providerError = (message) =>
  new AppError(502, message, [], PAYMENT_ERROR_CODE.PAYMENT_PROVIDER_ERROR);

const hmac = (checksumKey, text) =>
  createHmac("sha256", checksumKey).update(text).digest("hex");

// Payment-link request signature defined by payOS: fixed field order, raw values.
export const signPaymentRequest = (checksumKey, { amount, cancelUrl, description, orderCode, returnUrl }) =>
  hmac(
    checksumKey,
    `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`,
  );

// Webhook data signature: keys sorted alphabetically, null/undefined as empty strings,
// arrays serialized as JSON of key-sorted objects.
export const signWebhookData = (checksumKey, data) => {
  const normalize = (value) => {
    if (value === null || value === undefined || value === "null" || value === "undefined") return "";
    if (Array.isArray(value)) {
      return JSON.stringify(
        value.map((item) =>
          item && typeof item === "object"
            ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
            : item,
        ),
      );
    }
    return String(value);
  };
  const text = Object.keys(data)
    .sort()
    .map((key) => `${key}=${normalize(data[key])}`)
    .join("&");
  return hmac(checksumKey, text);
};

const safeEqualHex = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
};

// orderCode must be a positive safe integer and unique per payOS merchant; payOS itself rejects
// a reused orderCode, so time + randomness is enough here.
const defaultOrderCodeFactory = () => Date.now() * 1000 + randomInt(0, 1000);

/**
 * payOS adapter (owner approval recorded in REQUIREMENTS_STATUS, 2026-10-27). Server-to-server
 * calls use the client id / API key over TLS and are
 * treated as authoritative; only the inbound webhook is signature-verified.
 */
export const createPayosGateway = ({
  clientId,
  apiKey,
  checksumKey,
  baseUrl = "https://api-merchant.payos.vn",
  fetchImpl = globalThis.fetch,
  orderCodeFactory = defaultOrderCodeFactory,
}) => {
  if (!clientId || !apiKey || !checksumKey) {
    throw new TypeError("payOS clientId, apiKey and checksumKey are required");
  }

  const call = async (method, path, body) => {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId,
          "x-api-key": apiKey,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw providerError("Could not reach the payOS payment service");
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw providerError("payOS returned an unreadable response");
    }
    if (!response.ok || payload?.code !== "00" || !payload?.data) {
      throw providerError(`payOS rejected the request: ${payload?.desc || response.status}`);
    }
    return payload.data;
  };

  const meta = PAYMENT_METHOD_META.BANK_TRANSFER;

  return {
    provider: PAYMENT_PROVIDER.PAYOS,

    async createAttemptInstruction({ method, amount, expiresAt, returnUrl, cancelUrl }) {
      const orderCode = orderCodeFactory();
      // Some banks only carry 9 characters of transfer content for non-linked accounts.
      const description = `FC${String(orderCode).slice(-7)}`;
      const request = {
        orderCode,
        amount,
        description,
        returnUrl,
        cancelUrl,
        expiredAt: Math.floor(new Date(expiresAt).getTime() / 1000),
      };
      const data = await call("POST", "/v2/payment-requests", {
        ...request,
        signature: signPaymentRequest(checksumKey, request),
      });
      if (Number(data.amount) !== Number(amount) || !data.qrCode) {
        throw providerError("payOS returned a payment link that does not match the booking amount");
      }
      const reference = `PAYOS-${orderCode}`;
      return {
        provider: PAYMENT_PROVIDER.PAYOS,
        isDemo: false,
        method,
        methodLabel: meta.label,
        gatewayName: meta.gatewayName,
        subtitle: meta.subtitle,
        badge: meta.badge,
        gatewayReference: reference,
        gatewayTransactionRef: reference,
        providerOrderCode: orderCode,
        paymentLinkId: data.paymentLinkId ?? null,
        checkoutUrl: data.checkoutUrl ?? null,
        qrPayload: data.qrCode,
        bankAccount: {
          bin: data.bin ?? null,
          accountNumber: data.accountNumber ?? null,
          accountName: data.accountName ?? null,
        },
        transferContent: data.description ?? description,
        amount,
        expiresAt: new Date(expiresAt).toISOString(),
      };
    },

    async getAttemptStatus(attempt) {
      const data = await call("GET", `/v2/payment-requests/${attempt.providerOrderCode}`);
      return {
        status: data.status,
        amount: Number(data.amount),
        amountPaid: Number(data.amountPaid ?? 0),
        transactions: (data.transactions ?? []).map((item) => ({
          reference: item.reference ?? null,
          amount: Number(item.amount ?? 0),
          transactionDateTime: item.transactionDateTime ?? null,
        })),
      };
    },

    async cancelAttempt(attempt, reason) {
      await call("POST", `/v2/payment-requests/${attempt.providerOrderCode}/cancel`, {
        cancellationReason: reason,
      });
    },

    // Returns the verified webhook `data` or throws 400 for a missing/forged signature.
    verifyWebhook(body) {
      const data = body?.data;
      if (!data || typeof data !== "object" || !safeEqualHex(body.signature, signWebhookData(checksumKey, data))) {
        throw new AppError(400, "Invalid payOS webhook signature", [], PAYMENT_ERROR_CODE.INVALID_PROVIDER_SIGNATURE);
      }
      return data;
    },
  };
};
