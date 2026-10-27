import { AppError } from "../../utils/AppError.js";
import { PAYMENT_ERROR_CODE, PAYMENT_METHOD, PAYMENT_PROVIDER } from "./payment.constants.js";
import { createMockPaymentGateway } from "./mock-payment-gateway.js";

// Routes BANK_TRANSFER to payOS when it is configured. Without credentials, development keeps the
// deterministic mock (so local runs and E2E-001 work offline); production refuses instead of
// silently taking an unpayable mock attempt.
export const createPaymentGatewayRouter = ({
  mock = createMockPaymentGateway(),
  payos = null,
  isProduction = () => process.env.NODE_ENV === "production",
} = {}) => {
  const forAttempt = (attempt) =>
    attempt?.provider === PAYMENT_PROVIDER.PAYOS ? payos : null;

  return {
    hasPayos: Boolean(payos),

    async createAttemptInstruction(input) {
      if (input.method === PAYMENT_METHOD.BANK_TRANSFER) {
        if (payos) return payos.createAttemptInstruction(input);
        if (isProduction()) {
          throw new AppError(
            503,
            "Bank transfer is not available right now",
            [],
            PAYMENT_ERROR_CODE.PAYMENT_PROVIDER_UNAVAILABLE,
          );
        }
      }
      return mock.createAttemptInstruction(input);
    },

    async getAttemptStatus(attempt) {
      const gateway = forAttempt(attempt);
      if (!gateway) {
        throw new AppError(
          409,
          "This payment attempt is not handled by an external provider",
          [],
          PAYMENT_ERROR_CODE.INVALID_PAYMENT,
        );
      }
      return gateway.getAttemptStatus(attempt);
    },

    async cancelAttempt(attempt, reason) {
      const gateway = forAttempt(attempt);
      if (gateway) await gateway.cancelAttempt(attempt, reason);
    },

    verifyProviderWebhook(body) {
      if (!payos) {
        throw new AppError(
          503,
          "payOS is not configured",
          [],
          PAYMENT_ERROR_CODE.PAYMENT_PROVIDER_UNAVAILABLE,
        );
      }
      return payos.verifyWebhook(body);
    },
  };
};
