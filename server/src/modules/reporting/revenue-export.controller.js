import { revenueExportService } from "./reporting.module.js";

export const getRevenueReportOptions = async (req, res, next) => {
  try {
    res.json({ success: true, data: await revenueExportService.listOptions({ account: req.auth.account }) });
  } catch (error) { next(error); }
};

export const getRevenueReport = async (req, res, next) => {
  try {
    const { page, limit, ...filters } = req.validated.query;
    const data = await revenueExportService.getReport({ account: req.auth.account, query: filters, page, limit });
    res.json({ success: true, data, meta: data.meta });
  } catch (error) { next(error); }
};

export const exportRevenueReport = async (req, res, next) => {
  try {
    const { format, ...query } = req.validated.query;
    const { buffer, report } = await revenueExportService.exportReport({ account: req.auth.account, query, format });
    const isExcel = format === "xlsx";
    const fileName = `f-cinema-revenue-${query.fromDate}-to-${query.toDate}.${format}`;
    res.set({
      "Content-Type": isExcel ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(buffer.length),
      "X-Report-Cutoff": report.generatedAt,
    });
    res.send(buffer);
  } catch (error) { next(error); }
};
