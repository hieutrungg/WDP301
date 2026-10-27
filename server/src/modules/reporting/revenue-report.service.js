import mongoose from "mongoose";

const parseUtcInstant = (value, field) => {
  if (value == null) return undefined;
  if (value instanceof Date) return new Date(value);
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new TypeError(`${field} must include an explicit UTC offset`);
  }
  return new Date(value);
};

const parsePeriod = ({ fromAt, toAt } = {}) => {
  const from = parseUtcInstant(fromAt, "fromAt");
  const to = parseUtcInstant(toAt, "toAt");
  if (
    (from && !Number.isFinite(from.getTime())) ||
    (to && !Number.isFinite(to.getTime())) ||
    (from && to && from >= to)
  ) {
    throw new TypeError("Revenue report period must contain valid UTC instants with fromAt before toAt");
  }
  return { fromAt: from, toAt: to };
};

const requireVndInteger = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Revenue report ${field} is outside the supported VND integer range`);
  }
  return value;
};

export const createRevenueReportService = ({
  paymentReadPort,
  refundReadPort,
  connection = mongoose.connection,
  clock = () => new Date(),
} = {}) => ({
  async getRevenueSummary(period = {}) {
    if (typeof paymentReadPort?.getSuccessfulRevenueTotals !== "function") {
      throw new TypeError("Payment revenue read port is required");
    }
    if (typeof refundReadPort?.getSuccessfulRevenueTotals !== "function") {
      throw new TypeError("Refund revenue read port is required");
    }

    const range = parsePeriod(period);
    const generatedAt = clock();
    if (!(generatedAt instanceof Date) || !Number.isFinite(generatedAt.getTime())) {
      throw new TypeError("Revenue report clock must return a valid Date");
    }

    const session = await connection.startSession();
    try {
      let amounts;
      await session.withTransaction(async () => {
        const collected = await paymentReadPort.getSuccessfulRevenueTotals({
          ...range,
          session,
        });
        const refunded = await refundReadPort.getSuccessfulRevenueTotals({
          ...range,
          session,
        });
        amounts = {
          totalCollectedAmount: requireVndInteger(collected.amount, "collected amount"),
          totalRefundedAmount: requireVndInteger(refunded.amount, "refunded amount"),
        };
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      if (!amounts) throw new Error("Revenue report snapshot was not produced");

      return {
        currency: "VND",
        totalCollectedAmount: amounts.totalCollectedAmount,
        totalRefundedAmount: amounts.totalRefundedAmount,
        netRevenueAmount: amounts.totalCollectedAmount - amounts.totalRefundedAmount,
        period: {
          fromAt: range.fromAt?.toISOString() ?? null,
          toAt: range.toAt?.toISOString() ?? null,
        },
        generatedAt: generatedAt.toISOString(),
      };
    } finally {
      await session.endSession();
    }
  },
});
