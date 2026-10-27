import { dashboardService } from "./reporting.module.js";

export const getManagerDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getManagerDashboard({
      account: req.auth.account,
      period: req.validated.query.period,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
