import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { getBranchSummariesByIds } from "../branch/branch.service.js";
import {
  CATALOG_READ_BATCH_SIZE,
  catalogCategoryExists,
  listCatalogCategories,
  listCatalogConcessions,
  getCatalogConcession,
  readCatalogConcessionsByIds,
} from "../inventory/concession-catalog.read-service.js";
import { readSellableStock } from "../inventory/stock-read.service.js";
import { getCatalogCombo, listCatalogCombos } from "./concession.repository.js";

const textOrNull = (value) =>
  typeof value === "string" && value.trim() ? value : null;
const priced = (value) => Number.isSafeInteger(value) && value >= 0;
const pageInput = ({ page, limit }) => ({ skip: (page - 1) * limit, limit });
const pageResult = (items, total, { page, limit }) => ({
  items,
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
});

const requireBranch = async (branchId) => {
  const branches = await getBranchSummariesByIds([branchId]);
  if (branches.get(branchId)?.status !== "ACTIVE") {
    throw new AppError(404, "Branch not found", [], "BRANCH_NOT_FOUND");
  }
};

const serializeItem = (item, branchId, stock) => ({
  id: item._id.toString(),
  category: item.category
    ? { id: item.category._id.toString(), name: textOrNull(item.category.name) }
    : null,
  name: textOrNull(item.name),
  description: null,
  size: textOrNull(item.size),
  imageUrl: textOrNull(item.imageUrl),
  price: item.price,
  branchId,
  available: (stock.get(item._id.toString())?.quantity ?? 0) > 0,
  isSpecialOffer: item.price === 0,
});

export const listCategories = async (query) => {
  const { items, total } = await listCatalogCategories(pageInput(query));
  return pageResult(
    items.map((item) => ({
      id: item._id.toString(),
      name: textOrNull(item.name),
      description: textOrNull(item.description),
    })),
    total,
    query,
  );
};

export const listConcessions = async (query) => {
  await requireBranch(query.branchId);
  if (query.categoryId && !(await catalogCategoryExists(query.categoryId))) {
    throw new AppError(
      404,
      "Category not found",
      [],
      "CONCESSION_CATEGORY_NOT_FOUND",
    );
  }
  const { items, total } = await listCatalogConcessions({
    categoryId: query.categoryId,
    ...pageInput(query),
  });
  const stock = await readSellableStock({
    branchId: query.branchId,
    concessionIds: items.map((item) => item._id.toString()),
  });
  return pageResult(
    items.map((item) => serializeItem(item, query.branchId, stock)),
    total,
    query,
  );
};

export const getConcession = async (id, { branchId }) => {
  await requireBranch(branchId);
  const item = await getCatalogConcession(id);
  if (!item)
    throw new AppError(404, "Concession not found", [], "CONCESSION_NOT_FOUND");
  const stock = await readSellableStock({ branchId, concessionIds: [id] });
  return serializeItem(item, branchId, stock);
};

// Read-time validation is necessary: existing/imported documents bypass Mongoose validation.
export const parseComboRecipe = (items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const seen = new Set();
  const recipe = [];
  for (const item of items) {
    if (
      !item ||
      !mongoose.isObjectIdOrHexString(item.concessionId) ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1
    )
      return null;
    const concessionId = item.concessionId.toString().toLowerCase();
    if (seen.has(concessionId)) return null;
    seen.add(concessionId);
    recipe.push({ concessionId, quantity: item.quantity });
  }
  return recipe;
};

const serializeCombos = async (items, branchId) => {
  const recipes = items.map((item) => parseComboRecipe(item.items));
  const ids = [
    ...new Set(
      recipes.flatMap(
        (recipe) => recipe?.map((line) => line.concessionId) ?? [],
      ),
    ),
  ];
  const components = new Map();
  const stock = new Map();
  // Each provider call is bounded even when 100 combos reference many distinct components.
  for (let offset = 0; offset < ids.length; offset += CATALOG_READ_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + CATALOG_READ_BATCH_SIZE);
    const [rows, levels] = await Promise.all([
      readCatalogConcessionsByIds(batch),
      readSellableStock({ branchId, concessionIds: batch }),
    ]);
    for (const row of rows) components.set(row._id.toString(), row);
    for (const [id, level] of levels) stock.set(id, level);
  }
  return items.map((item, index) => {
    const recipe = recipes[index];
    const eligible =
      recipe !== null &&
      recipe.every((line) => {
        const component = components.get(line.concessionId);
        return component?.status === "ACTIVE" && priced(component.price);
      });
    return {
      id: item._id.toString(),
      name: textOrNull(item.name),
      description: textOrNull(item.description),
      imageUrl: textOrNull(item.imageUrl),
      price: item.price,
      branchId,
      available:
        eligible &&
        recipe.every(
          (line) =>
            (stock.get(line.concessionId)?.quantity ?? 0) >= line.quantity,
        ),
      isSpecialOffer: item.price === 0,
      // Do not expose inactive/missing/non-priced component details or malformed legacy recipes.
      items: eligible
        ? recipe.map((line) => ({
            ...line,
            name: textOrNull(components.get(line.concessionId).name),
            size: textOrNull(components.get(line.concessionId).size),
          }))
        : [],
    };
  });
};

export const listCombos = async (query) => {
  await requireBranch(query.branchId);
  const { items, total } = await listCatalogCombos(pageInput(query));
  return pageResult(await serializeCombos(items, query.branchId), total, query);
};

export const getCombo = async (id, { branchId }) => {
  await requireBranch(branchId);
  const item = await getCatalogCombo(id);
  if (!item) throw new AppError(404, "Combo not found", [], "COMBO_NOT_FOUND");
  return (await serializeCombos([item], branchId))[0];
};
