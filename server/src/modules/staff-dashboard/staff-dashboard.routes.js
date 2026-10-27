import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requireRole } from "../../middlewares/permissionMiddleware.js";
import { getStaffDashboard } from "./staff-dashboard.service.js";

const router = Router();
router.get("/", requireAuth, requireRole("STAFF"), async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await getStaffDashboard({ staffId: req.auth.accountId }),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
