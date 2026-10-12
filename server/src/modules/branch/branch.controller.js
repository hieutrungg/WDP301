import * as branchService from "./branch.service.js";

export const listBranches = async (req, res, next) => {
  try {
    const { items, meta } = await branchService.listBranches(req.validated.query);

    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};

export const getBranchSummary = async (_req, res, next) => {
  try {
    res.json({ success: true, data: await branchService.getBranchSummary() });
  } catch (error) {
    next(error);
  }
};

export const getBranch = async (req, res, next) => {
  try {
    res.json({ success: true, data: await branchService.getBranch(req.validated.params.branchId) });
  } catch (error) {
    next(error);
  }
};

export const createBranch = async (req, res, next) => {
  try {
    const branch = await branchService.createBranch(req.body);

    res.status(201).json({ success: true, message: "Branch created", data: branch });
  } catch (error) {
    next(error);
  }
};

export const updateBranch = async (req, res, next) => {
  try {
    const branch = await branchService.updateBranch(req.validated.params.branchId, req.body);

    res.json({ success: true, message: "Branch updated", data: branch });
  } catch (error) {
    next(error);
  }
};

export const changeBranchStatus = async (req, res, next) => {
  try {
    const branch = await branchService.changeBranchStatus(
      req.validated.params.branchId,
      req.body.status,
    );

    res.json({ success: true, message: "Branch status updated", data: branch });
  } catch (error) {
    next(error);
  }
};
