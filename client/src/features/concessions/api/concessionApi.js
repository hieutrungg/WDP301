import httpClient from "../../../lib/api/httpClient";
import { getPublicCinemas } from "../../../lib/api/publicCinemaApi";

const getPage = async (path, params, signal) => {
  const { data } = await httpClient.get(path, { params, signal });
  return { items: data.data, meta: data.meta };
};
export const getCatalogPage = ({ kind, ...params }, signal) =>
  getPage(kind === "combos" ? "/combos" : "/concessions", params, signal);

// Picker data is paginated too; do not silently drop categories/branches after page one.
const collectPages = async (load, signal) => {
  const items = [];
  for (let page = 1; ; page += 1) {
    const result = await load(page, signal);
    items.push(...result.items);
    if (page >= result.meta.totalPages) return items;
  }
};
export const getCatalogCategories = (signal) =>
  collectPages(
    (page) => getPage("/concession-categories", { page, limit: 100 }, signal),
    signal,
  );
export const getCatalogBranches = (signal) =>
  collectPages((page) => getPublicCinemas({ page, limit: 50 }, signal), signal);
