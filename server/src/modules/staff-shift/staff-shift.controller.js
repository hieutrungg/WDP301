import * as staffShiftService from "./staff-shift.service.js";

// `req.auth.account` is loaded by requirePermission on every request, so status, permissions and
// the employee profile (the branch) are always current.
export const getDashboard = async (req, res, next) => {
  try {
    res.json({ success: true, data: await staffShiftService.getDashboard(req.auth.account) });
  } catch (error) {
    next(error);
  }
};

export const listShifts = async (req, res, next) => {
  try {
    const { items, meta } = await staffShiftService.listShifts(req.auth.account, req.validated.query);
    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};

export const getShift = async (req, res, next) => {
  try {
    res.json({ success: true, data: await staffShiftService.getShift(req.auth.account, req.validated.params.shiftId) });
  } catch (error) {
    next(error);
  }
};

export const listStations = async (req, res, next) => {
  try {
    res.json({ success: true, data: await staffShiftService.listStations(req.auth.account) });
  } catch (error) {
    next(error);
  }
};

export const listEmployees = async (req, res, next) => {
  try {
    res.json({ success: true, data: await staffShiftService.listEmployees(req.auth.account, req.validated.query) });
  } catch (error) {
    next(error);
  }
};

export const createShift = async (req, res, next) => {
  try {
    const shift = await staffShiftService.createShift(req.auth.account, req.body);
    res.status(201).json({ success: true, message: "Shift assigned", data: shift });
  } catch (error) {
    next(error);
  }
};

export const cancelShift = async (req, res, next) => {
  try {
    const shift = await staffShiftService.cancelShift(req.auth.account, req.validated.params.shiftId);
    res.json({ success: true, message: "Shift cancelled", data: shift });
  } catch (error) {
    next(error);
  }
};

export const approveShift = async (req, res, next) => {
  try {
    const shift = await staffShiftService.approveShift(req.auth.account, req.validated.params.shiftId, req.body);
    res.json({ success: true, message: "Shift approved", data: shift });
  } catch (error) {
    next(error);
  }
};
