import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { dashboardRepository } from "./dashboard.repository.js";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const localDateKey = (date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);
const dateAtLocalMidnight = (dateKey) => new Date(`${dateKey}T00:00:00+07:00`);
const shiftDateKey = (dateKey, amount) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const resolvePeriod = (period, cutoff) => {
  const today = localDateKey(cutoff);
  let firstDay = today;
  if (period === "WTD") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    firstDay = shiftDateKey(today, -(weekday === 0 ? 6 : weekday - 1));
  } else if (period === "QTD") {
    const month = Number(today.slice(5, 7));
    firstDay = `${today.slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
  }
  return { fromAt: dateAtLocalMidnight(firstDay), toAt: cutoff, firstDay, lastDay: today };
};

const buildSeries = (firstDay, lastDay, paymentRows, refundRows) => {
  const payments = new Map(paymentRows.map(({ _id, amount }) => [_id, amount]));
  const refunds = new Map(refundRows.map(({ _id, amount }) => [_id, amount]));
  const series = [];
  for (let day = firstDay; day <= lastDay; day = shiftDateKey(day, 1)) {
    const grossAmount = payments.get(day) ?? 0;
    const refundedAmount = refunds.get(day) ?? 0;
    series.push({ date: day, grossAmount, refundedAmount, netAmount: grossAmount - refundedAmount });
  }
  return series;
};

export const createDashboardService = ({
  repository = dashboardRepository,
  connection = mongoose.connection,
  clock = () => new Date(),
} = {}) => ({
  async getManagerDashboard({ account, period = "TODAY" } = {}) {
    const branchId = account?.employeeProfile?.branchId;
    if (!branchId || !mongoose.isValidObjectId(branchId)) {
      throw new AppError(403, "Manager account is not assigned to a cinema branch", [], "DASHBOARD_BRANCH_REQUIRED");
    }
    const generatedAt = clock();
    if (!(generatedAt instanceof Date) || !Number.isFinite(generatedAt.getTime())) {
      throw new TypeError("Dashboard clock must return a valid Date");
    }
    const range = resolvePeriod(period, generatedAt);
    const session = await connection.startSession();
    try {
      let data;
      await session.withTransaction(async () => {
        const revenueRows = await repository.revenueByTransactionDate({ branchId: new mongoose.Types.ObjectId(branchId), ...range, session });
        const occupancyRows = await repository.completedShowtimeOccupancy({ branchId: new mongoose.Types.ObjectId(branchId), ...range, session });
        const trendingShowtimes = await repository.trendingShowtimes({ branchId: new mongoose.Types.ObjectId(branchId), ...range, session });
        const series = buildSeries(range.firstDay, range.lastDay, revenueRows.payments, revenueRows.refunds);
        const grossAmount = series.reduce((total, day) => total + day.grossAmount, 0);
        const refundedAmount = series.reduce((total, day) => total + day.refundedAmount, 0);
        const occupancy = occupancyRows[0] ?? { availableSeatCapacity: 0, validTickets: 0, completedShowtimes: 0 };
        data = {
          period: { key: period, timeZone: TIME_ZONE, fromAt: range.fromAt.toISOString(), toAt: generatedAt.toISOString() },
          generatedAt: generatedAt.toISOString(),
          revenue: { currency: "VND", grossAmount, refundedAmount, netAmount: grossAmount - refundedAmount, series },
          occupancy: {
            validTickets: occupancy.validTickets,
            availableSeatCapacity: occupancy.availableSeatCapacity,
            completedShowtimes: occupancy.completedShowtimes,
            ratePercent: occupancy.availableSeatCapacity > 0
              ? Math.round((occupancy.validTickets / occupancy.availableSeatCapacity) * 10000) / 100
              : null,
          },
          ticketsSold: trendingShowtimes.ticketsSold,
          trendingShowtimes: trendingShowtimes.items,
        };
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      if (!data) throw new Error("Dashboard snapshot was not produced");
      return data;
    } finally {
      await session.endSession();
    }
  },
});

export const dashboardService = createDashboardService();
