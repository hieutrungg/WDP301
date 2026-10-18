import * as inventoryService from "./inventory.service.js";

// `req.auth.account` is loaded by requirePermission on every request, so status and permissions
// are always current.
export const listStockLevels = async (req, res, next) => {
  try {
    const { items, meta } = await inventoryService.listStockLevels(req.auth.account, req.validated.query);
    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};

export const getStockSummary = async (req, res, next) => {
  try {
    res.json({ success: true, data: await inventoryService.getStockSummary(req.auth.account) });
  } catch (error) {
    next(error);
  }
};

export const listCategories = async (_req, res, next) => {
  try {
    res.json({ success: true, data: await inventoryService.listCategories() });
  } catch (error) {
    next(error);
  }
};

export const listSuppliers = async (_req, res, next) => {
  try {
    res.json({ success: true, data: await inventoryService.listSuppliers() });
  } catch (error) {
    next(error);
  }
};

export const stockIn = async (req, res, next) => {
  try {
    const receipt = await inventoryService.stockIn(req.auth.account, req.body);
    res.status(201).json({ success: true, message: "Stock updated", data: receipt });
  } catch (error) {
    next(error);
  }
};

export const listStockInHistory = async (req, res, next) => {
  try {
    const { items, meta } = await inventoryService.listStockInHistory(req.auth.account, req.validated.query);
    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};
