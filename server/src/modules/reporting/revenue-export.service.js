import mongoose from "mongoose";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { AppError } from "../../utils/AppError.js";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const localMidnight = (date) => new Date(`${date}T00:00:00+07:00`);
const plusDays = (date, days) => {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};
const fail = (status, message, code, errors = []) => new AppError(status, message, errors, code);
const validDate = (value) => {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const amount = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const formatMoney = (value) => `${new Intl.NumberFormat("en-US").format(value)} VND`;

const resolveFilters = ({ fromDate, toDate, movieId, category = "ALL" } = {}) => {
  if (!validDate(fromDate) || !validDate(toDate) || fromDate > toDate) {
    throw fail(400, "Choose a valid reporting date range", "INVALID_REPORT_PERIOD");
  }
  if (plusDays(fromDate, 365) < toDate) {
    throw fail(400, "Reporting periods cannot exceed 366 days", "REPORT_PERIOD_TOO_LONG");
  }
  if (movieId && !mongoose.isValidObjectId(movieId)) {
    throw fail(400, "Movie ID is invalid", "INVALID_REPORT_FILTER");
  }
  if (!["ALL", "TICKETS", "CONCESSIONS"].includes(category)) {
    throw fail(400, "Revenue category is invalid", "INVALID_REPORT_FILTER");
  }
  return {
    fromDate,
    toDate,
    fromAt: localMidnight(fromDate),
    toAt: localMidnight(plusDays(toDate, 1)),
    movieId: movieId ? new mongoose.Types.ObjectId(movieId) : undefined,
    category,
  };
};

const selectTotals = (totals, category) => {
  const gross = category === "TICKETS" ? amount(totals.ticketGrossAmount)
    : category === "CONCESSIONS" ? amount(totals.concessionGrossAmount)
      : amount(totals.grossAmount);
  const refunded = category === "TICKETS" ? amount(totals.ticketRefundAmount)
    : category === "CONCESSIONS" ? amount(totals.concessionRefundAmount)
      : amount(totals.refundedAmount);
  return {
    grossTicketRevenue: amount(totals.ticketGrossAmount),
    grossConcessionRevenue: amount(totals.concessionGrossAmount),
    totalGrossRevenue: amount(totals.grossAmount),
    totalRefundedAmount: amount(totals.refundedAmount),
    netRevenue: amount(totals.grossAmount) - amount(totals.refundedAmount),
    soldTicketCount: amount(totals.soldTicketCount),
    completedConcessionSales: amount(totals.completedConcessionSales),
    filteredGrossRevenue: gross,
    filteredRefundedAmount: refunded,
    filteredNetRevenue: gross - refunded,
    paymentCount: amount(totals.paymentCount),
    refundCount: amount(totals.refundCount),
  };
};

const makeWorkbook = async (report) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "F-Cinema";
  workbook.created = new Date(report.generatedAt);
  const summary = workbook.addWorksheet("Revenue Summary");
  summary.addRows([
    ["F-Cinema Revenue Report"],
    ["Reporting period", `${report.filters.fromDate} to ${report.filters.toDate} (${TIME_ZONE})`],
    ["Branch", report.branch.branchName],
    ["Movie", report.filters.movieTitle || "All movies"],
    ["Revenue category", report.filters.category],
    ["Generated at (UTC)", report.generatedAt],
    ["Data cutoff (UTC)", report.generatedAt],
    [],
    ["Metric", "Amount / count", "Currency"],
    ["Ticket component before discount allocation", report.summary.grossTicketRevenue, "VND"],
    ["Concession component before discount allocation", report.summary.grossConcessionRevenue, "VND"],
    ["Filtered gross revenue (collected)", report.summary.filteredGrossRevenue, "VND"],
    ["Filtered successfully refunded", report.summary.filteredRefundedAmount, "VND"],
    ["Filtered net revenue", report.summary.filteredNetRevenue, "VND"],
    ["Successfully sold tickets", report.summary.soldTicketCount, "tickets"],
    ["Completed concession sales", report.summary.completedConcessionSales, "sales"],
  ]);
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  summary.getRow(9).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE50914" } };
  summary.columns = [{ width: 38 }, { width: 28 }, { width: 14 }];

  const journal = workbook.addWorksheet("Transaction Journal");
  journal.columns = [
    { header: "Transaction date (UTC)", key: "transactionAt", width: 28 },
    { header: "Type", key: "type", width: 16 },
    { header: "Reference", key: "reference", width: 38 },
    { header: "Movie", key: "movieTitle", width: 32 },
    { header: "Payment method", key: "method", width: 22 },
    { header: "Amount (VND)", key: "amount", width: 20 },
    { header: "Ticket component (VND)", key: "ticketAmount", width: 24 },
    { header: "Concession component (VND)", key: "concessionAmount", width: 28 },
  ];
  journal.addRows(report.items.map((row) => ({ ...row, transactionAt: row.transactionAt.toISOString() })));
  journal.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  journal.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF292A2E" } };
  return workbook.xlsx.writeBuffer();
};

const makePdf = (report) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true, layout: "landscape" });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("error", reject);
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.fontSize(20).fillColor("#e50914").text("F-Cinema Revenue Report");
  doc.moveDown(0.5).fontSize(10).fillColor("#343439");
  doc.text(`Period: ${report.filters.fromDate} to ${report.filters.toDate} (${TIME_ZONE})`);
  doc.text(`Branch: ${report.branch.branchName}  |  Movie: ${report.filters.movieTitle || "All movies"}  |  Category: ${report.filters.category}`);
  doc.text(`Generated at: ${report.generatedAt}  |  Data cutoff: ${report.generatedAt}`);
  doc.moveDown().fontSize(12).fillColor("#111111").text("Financial summary", { underline: true });
  const rows = [
    ["Ticket component before discount allocation", report.summary.grossTicketRevenue],
    ["Concession component before discount allocation", report.summary.grossConcessionRevenue],
    ["Filtered gross revenue (collected)", report.summary.filteredGrossRevenue],
    ["Filtered successfully refunded", report.summary.filteredRefundedAmount],
    ["Filtered net revenue", report.summary.filteredNetRevenue],
    ["Successfully sold tickets", report.summary.soldTicketCount, "count"],
    ["Completed concession sales", report.summary.completedConcessionSales, "count"],
  ];
  rows.forEach(([label, value, unit]) => doc.fontSize(10).text(`${label}: ${unit === "count" ? new Intl.NumberFormat("en-US").format(value) : formatMoney(value)}`));
  doc.moveDown().fontSize(12).text("Audited transaction journal", { underline: true });
  const columns = [42, 170, 245, 475, 590, 710];
  const drawHeader = () => {
    const y = doc.y;
    doc.fontSize(8).fillColor("#5e3f3b");
    ["Date (UTC)", "Type", "Reference", "Movie", "Method", "Amount (VND)"].forEach((text, index) => doc.text(text, columns[index], y, { width: (columns[index + 1] || 800) - columns[index] - 6, ellipsis: true }));
    doc.moveDown(0.6);
  };
  drawHeader();
  report.items.forEach((row) => {
    if (doc.y > 520) { doc.addPage(); drawHeader(); }
    const y = doc.y;
    const values = [row.transactionAt.toISOString().slice(0, 19) + "Z", row.type, row.reference, row.movieTitle || "Concessions", row.method || "—", formatMoney(row.amount)];
    doc.fontSize(7).fillColor("#111111");
    values.forEach((text, index) => doc.text(String(text), columns[index], y, { width: (columns[index + 1] || 800) - columns[index] - 6, ellipsis: true }));
    doc.moveDown(0.45);
  });
  if (!report.items.length) doc.fontSize(9).fillColor("#555555").text("No transactions matched these filters.");
  doc.end();
});

export const createRevenueExportService = ({ repository, connection = mongoose.connection, clock = () => new Date() } = {}) => {
  const generate = async ({ account, query, page, limit }) => {
    const branchId = account?.employeeProfile?.branchId;
    if (!mongoose.isValidObjectId(branchId)) throw fail(403, "Manager account is not assigned to a cinema branch", "REPORT_BRANCH_REQUIRED");
    const filters = resolveFilters(query);
    const generatedAt = clock();
    if (!(generatedAt instanceof Date) || !Number.isFinite(generatedAt.getTime())) throw new TypeError("Revenue report clock must return a valid Date");
    filters.toAt = filters.toAt > generatedAt ? generatedAt : filters.toAt;
    const session = await connection.startSession();
    try {
      let data;
      await session.withTransaction(async () => {
        const branch = await repository.findBranch(branchId, session);
        if (!branch) throw fail(403, "Manager branch could not be resolved", "REPORT_BRANCH_REQUIRED");
        const movie = filters.movieId
          ? await connection.collection("movies").findOne({ _id: filters.movieId }, { projection: { title: 1 }, session })
          : null;
        const result = filters.toAt <= filters.fromAt
          ? { items: [], totals: {}, total: 0, series: [] }
          : await repository.getReport({ branchId: new mongoose.Types.ObjectId(branchId), ...filters, page, limit, session });
        const totals = selectTotals(result.totals, filters.category);
        data = {
          branch: { id: String(branch._id), branchName: branch.branchName },
          filters: { fromDate: filters.fromDate, toDate: filters.toDate, category: filters.category, movieId: filters.movieId ? String(filters.movieId) : null, movieTitle: movie?.title || null, timeZone: TIME_ZONE },
          period: { fromAt: filters.fromAt.toISOString(), toAt: filters.toAt.toISOString() },
          generatedAt: generatedAt.toISOString(),
          summary: totals,
          items: result.items.map((row) => ({
            ...row,
            amount: filters.category === "TICKETS" ? amount(row.ticketAmount)
              : filters.category === "CONCESSIONS" ? amount(row.concessionAmount)
                : amount(row.amount),
          })),
          series: result.series ?? [],
          meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
        };
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      if (!data) throw new Error("Revenue report snapshot was not produced");
      return data;
    } finally {
      await session.endSession();
    }
  };

  return {
  async listOptions({ account } = {}) {
    const branchId = account?.employeeProfile?.branchId;
    if (!mongoose.isValidObjectId(branchId)) throw fail(403, "Manager account is not assigned to a cinema branch", "REPORT_BRANCH_REQUIRED");
    const [branch, movies] = await Promise.all([repository.findBranch(branchId), repository.listMovies()]);
    if (!branch) throw fail(403, "Manager branch could not be resolved", "REPORT_BRANCH_REQUIRED");
    return { branch: { id: String(branch._id), branchName: branch.branchName }, movies: movies.map((movie) => ({ id: String(movie._id), title: movie.title })) };
  },

  async getReport({ account, query, page = 1, limit = 20 } = {}) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 100 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw fail(400, "Report pagination is invalid", "INVALID_REPORT_PAGINATION");
    }
    return generate({ account, query, page, limit });
  },

  async exportReport({ account, query, format } = {}) {
    if (!["xlsx", "pdf"].includes(format)) throw fail(400, "Choose Excel or PDF export", "UNSUPPORTED_REPORT_FORMAT");
    const actorId = account?.id || account?._id;
    if (!mongoose.isValidObjectId(actorId)) throw fail(403, "Authenticated Manager could not be resolved", "REPORT_ACTOR_REQUIRED");
    const report = await generate({ account, query, page: 1, limit: 10001 });
    if (report.meta.total > 10000) throw fail(413, "This export contains too many transactions; narrow the reporting period", "REPORT_EXPORT_TOO_LARGE");
    const buffer = format === "xlsx" ? Buffer.from(await makeWorkbook(report)) : await makePdf(report);
    const exportedAt = clock();
    if (!(exportedAt instanceof Date) || !Number.isFinite(exportedAt.getTime())) throw new TypeError("Revenue report clock must return a valid Date");
    await repository.recordExport({
      actorId: new mongoose.Types.ObjectId(actorId),
      branchId: new mongoose.Types.ObjectId(report.branch.id),
      format,
      filters: { fromDate: report.filters.fromDate, toDate: report.filters.toDate, movieId: report.filters.movieId || null, category: report.filters.category },
      generatedAt: new Date(report.generatedAt),
      dataCutoffAt: new Date(report.generatedAt),
      createdAt: exportedAt,
      transactionCount: report.meta.total,
    });
    return { buffer, report };
  },
  };
};
