import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { createDashboardService } from "../src/modules/reporting/dashboard.service.js";
import { createRevenueExportService } from "../src/modules/reporting/revenue-export.service.js";

const oid = (suffix) => `0000000000000000000000${suffix}`.slice(-24);

const transactionSession = () => ({
  async withTransaction(callback) { return callback(); },
  async endSession() {},
});

test("movie-filtered revenue uses inclusive Vietnam dates and nets successful refunds", async () => {
  const branchId = oid("01");
  const movieId = oid("02");
  let reportArgs;
  const repository = {
    async findBranch(id) { return { _id: new mongoose.Types.ObjectId(id), branchName: "F-Cinema Central" }; },
    async getReport(args) {
      reportArgs = args;
      return {
        items: [],
        total: 2,
        series: [{ date: "2026-10-01", grossAmount: 1000000, refundedAmount: 250000 }],
        totals: {
          grossAmount: 1000000,
          ticketGrossAmount: 1000000,
          concessionGrossAmount: 0,
          refundedAmount: 250000,
          ticketRefundAmount: 250000,
          concessionRefundAmount: 0,
          soldTicketCount: 5,
          completedConcessionSales: 0,
          paymentCount: 2,
          refundCount: 1,
        },
      };
    },
  };
  const connection = {
    async startSession() { return transactionSession(); },
    collection(name) {
      assert.equal(name, "movies");
      return { async findOne({ _id }) { return { _id, title: "Interstellar" }; } };
    },
  };
  const service = createRevenueExportService({
    repository,
    connection,
    clock: () => new Date("2026-10-02T00:00:00.000Z"),
  });

  const report = await service.getReport({
    account: { id: oid("03"), employeeProfile: { branchId } },
    query: { fromDate: "2026-10-01", toDate: "2026-10-01", movieId, category: "ALL" },
    page: 1,
    limit: 20,
  });

  assert.equal(report.period.fromAt, "2026-09-30T17:00:00.000Z");
  assert.equal(report.period.toAt, "2026-10-01T17:00:00.000Z");
  assert.equal(report.filters.movieId, movieId);
  assert.equal(report.filters.movieTitle, "Interstellar");
  assert.equal(report.summary.totalGrossRevenue, 1000000);
  assert.equal(report.summary.totalRefundedAmount, 250000);
  assert.equal(report.summary.netRevenue, 750000);
  assert.equal(String(reportArgs.branchId), branchId);
  assert.equal(String(reportArgs.movieId), movieId);
  assert.equal(reportArgs.fromAt.toISOString(), "2026-09-30T17:00:00.000Z");
  assert.equal(reportArgs.toAt.toISOString(), "2026-10-01T17:00:00.000Z");
});

test("invalid report pagination is rejected before querying the repository", async () => {
  let queried = false;
  const service = createRevenueExportService({
    repository: { async getReport() { queried = true; } },
  });

  await assert.rejects(
    service.getReport({
      account: { id: oid("01"), employeeProfile: { branchId: oid("02") } },
      query: { fromDate: "2026-10-01", toDate: "2026-10-01", category: "ALL" },
      page: Number.NaN,
      limit: 20,
    }),
    (error) => error.statusCode === 400 && error.code === "INVALID_REPORT_PAGINATION",
  );
  assert.equal(queried, false);
});

test("dashboard local-day boundary uses Vietnam midnight and nets same-day refunds", async () => {
  const branchId = oid("01");
  const now = new Date("2026-10-27T17:00:00.000Z"); // 2026-10-28 00:00 in Vietnam
  let queryRange;
  const repository = {
    async revenueByTransactionDate(args) {
      queryRange = args;
      return {
        payments: [{ _id: "2026-10-28", amount: 900000 }],
        refunds: [{ _id: "2026-10-28", amount: 200000 }],
      };
    },
    async completedShowtimeOccupancy() { return []; },
    async trendingShowtimes() { return { items: [], ticketsSold: 0 }; },
  };
  const service = createDashboardService({
    repository,
    connection: { async startSession() { return transactionSession(); } },
    clock: () => now,
  });

  const dashboard = await service.getManagerDashboard({
    account: { employeeProfile: { branchId } },
    period: "TODAY",
  });

  assert.equal(queryRange.fromAt.toISOString(), "2026-10-27T17:00:00.000Z");
  assert.equal(queryRange.toAt.toISOString(), now.toISOString());
  assert.equal(dashboard.period.fromAt, "2026-10-27T17:00:00.000Z");
  assert.deepEqual(dashboard.revenue.series, [{
    date: "2026-10-28",
    grossAmount: 900000,
    refundedAmount: 200000,
    netAmount: 700000,
  }]);
  assert.equal(dashboard.revenue.netAmount, 700000);
});
