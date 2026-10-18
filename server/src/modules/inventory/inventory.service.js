import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import {
  CONCESSION_STATUS,
  DEFAULT_UNIT,
  INVENTORY_ERROR,
  RECEIVED_AT_FUTURE_SKEW_MS,
  STOCK_STATUS,
} from "./inventory.constants.js";
import {
  countStockLevelsByStatus,
  findConcessionsByIds,
  findStockInHistory,
  findStockLevels,
  findSupplierById,
  listCategories as findCategories,
  listSuppliers as findSuppliers,
  receiveStock,
} from "./inventory.repository.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });

// Stock is branch-scoped: staff only see and change the branch they are assigned to. The branch
// comes from the authenticated account, never from the request, so it cannot be spoofed.
const requireBranchId = (account) => {
  const branchId = account?.employeeProfile?.branchId;

  if (!branchId) {
    throw new AppError(
      403,
      "Your account is not assigned to a branch",
      [],
      INVENTORY_ERROR.BRANCH_NOT_ASSIGNED,
    );
  }

  return branchId.toString();
};

const buildStockMatch = ({ q, categoryId, status }) => {
  const match = {};
  if (q) match.name = new RegExp(escapeRegex(q), "i");
  if (categoryId) match.categoryId = new mongoose.Types.ObjectId(categoryId);
  if (status) match.stockStatus = status;
  return match;
};

const serializeStockLevel = (item) => ({
  id: item._id.toString(),
  name: item.name,
  size: item.size ?? null,
  unit: item.unit ?? DEFAULT_UNIT,
  category: item.category ? { id: item.category._id.toString(), name: item.category.name } : null,
  quantity: item.quantity,
  minThreshold: item.minThreshold,
  stockStatus: item.stockStatus,
  updatedAt: item.inventoryUpdatedAt ?? null,
});

// UC39. Zero quantity is out of stock; at or below the threshold is low stock.
export const listStockLevels = async (account, { q, categoryId, status, page, limit }) => {
  const branchId = requireBranchId(account);
  const { items, total } = await findStockLevels(branchId, {
    match: buildStockMatch({ q, categoryId, status }),
    skip: (page - 1) * limit,
    limit,
  });

  return { items: items.map(serializeStockLevel), meta: buildMeta(page, limit, total) };
};

// Counts ignore the list filters so the summary always describes the whole branch.
export const getStockSummary = async (account) => {
  const counts = await countStockLevelsByStatus(requireBranchId(account));
  const inStock = counts[STOCK_STATUS.IN_STOCK] ?? 0;
  const lowStock = counts[STOCK_STATUS.LOW_STOCK] ?? 0;
  const outOfStock = counts[STOCK_STATUS.OUT_OF_STOCK] ?? 0;

  return { total: inStock + lowStock + outOfStock, inStock, lowStock, outOfStock };
};

export const listCategories = async () =>
  (await findCategories()).map(({ _id, name }) => ({ id: _id.toString(), name }));

export const listSuppliers = async () =>
  (await findSuppliers()).map(({ _id, name, phone }) => ({
    id: _id.toString(),
    name,
    phone: phone ?? null,
  }));

const generateReceiptCode = (now) => {
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `RC-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
};

const assertReceivedAtNotInFuture = (receivedAt, now) => {
  if (receivedAt.getTime() > now.getTime() + RECEIVED_AT_FUTURE_SKEW_MS) {
    throw new AppError(
      400,
      "Validation failed",
      [{ field: "receivedAt", message: "Received date cannot be in the future" }],
      INVENTORY_ERROR.VALIDATION_FAILED,
    );
  }
};

const assertSupplierExists = async (supplierId) => {
  if (!supplierId) return;

  if (!(await findSupplierById(supplierId))) {
    throw new AppError(
      404,
      "Supplier not found",
      [{ field: "supplierId", message: "Supplier not found" }],
      INVENTORY_ERROR.SUPPLIER_NOT_FOUND,
    );
  }
};

// Every line must reference an existing, active item. The check happens before any write so a bad
// line is reported together with the others, not after part of the receipt was applied.
const assertConcessionsReceivable = async (items) => {
  const found = new Map(
    (await findConcessionsByIds(items.map(({ concessionId }) => concessionId))).map((concession) => [
      concession._id.toString(),
      concession,
    ]),
  );

  const missing = [];
  const inactive = [];

  items.forEach(({ concessionId }, index) => {
    const concession = found.get(concessionId.toLowerCase());
    if (!concession) missing.push({ field: `items.${index}.concessionId`, message: "Item not found" });
    else if (concession.status !== CONCESSION_STATUS.ACTIVE) {
      inactive.push({ field: `items.${index}.concessionId`, message: `${concession.name} is inactive` });
    }
  });

  if (missing.length > 0) {
    throw new AppError(404, "Item not found", missing, INVENTORY_ERROR.CONCESSION_NOT_FOUND);
  }
  if (inactive.length > 0) {
    throw new AppError(409, "Inactive items cannot be stocked", inactive, INVENTORY_ERROR.CONCESSION_INACTIVE);
  }

  return found;
};

// UC40. BR-49 (quantity > 0) is enforced by the request schema and again by the
// `stock_transactions` model; BR-50 holds because stock only changes inside this confirmed call.
export const stockIn = async (account, { items, supplierId, receivedAt, note }) => {
  const branchId = requireBranchId(account);
  const now = new Date();
  const receivedDate = receivedAt ? new Date(receivedAt) : now;

  assertReceivedAtNotInFuture(receivedDate, now);
  await assertSupplierExists(supplierId);
  const concessions = await assertConcessionsReceivable(items);

  const receiptCode = generateReceiptCode(now);
  let levels;

  try {
    levels = await receiveStock({
      branchId,
      recordedBy: account.id,
      supplierId,
      receiptCode,
      receivedAt: receivedDate,
      note,
      lines: items,
    });
  } catch (error) {
    // The transaction rolled back, so previous quantities are unchanged (UC40 step 9 alt.).
    console.error("Stock-in failed", error);
    throw new AppError(
      500,
      "Stock update failed. Stock quantities were not changed.",
      [],
      INVENTORY_ERROR.STOCK_UPDATE_FAILED,
    );
  }

  return {
    receiptCode,
    receivedAt: receivedDate,
    items: levels.map(({ concessionId, quantityAdded, quantityAfter }) => ({
      concessionId,
      name: concessions.get(concessionId.toLowerCase()).name,
      quantityAdded,
      quantityAfter,
    })),
  };
};

const serializeReceiptLine = (row) => ({
  id: row._id.toString(),
  receiptCode: row.receiptCode ?? null,
  concession: row.concession
    ? { id: row.concession._id.toString(), name: row.concession.name, unit: row.concession.unit ?? DEFAULT_UNIT }
    : null,
  supplier: row.supplier ? { id: row.supplier._id.toString(), name: row.supplier.name } : null,
  quantity: row.quantity,
  receivedAt: row.transactionDate,
  recordedBy: row.recorder
    ? { id: row.recorder._id.toString(), name: row.recorder.profile?.fullName ?? row.recorder.username }
    : null,
  note: row.note ?? null,
});

export const listStockInHistory = async (account, { page, limit }) => {
  const { items, total } = await findStockInHistory(requireBranchId(account), {
    skip: (page - 1) * limit,
    limit,
  });

  return { items: items.map(serializeReceiptLine), meta: buildMeta(page, limit, total) };
};
