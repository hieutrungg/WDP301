import { useEffect, useState } from "react";
import {
  getCatalogBranches,
  getCatalogCategories,
  getCatalogPage,
} from "../api/concessionApi";

function useCatalogResource(key, load, enabled = true) {
  const [result, setResult] = useState({ key: null, data: null, error: null });
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ key, data: null, error });
      });
    return () => controller.abort();
    // The key includes every request input. Never show another branch's settled response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return {
    data: enabled && result.key === key ? result.data : null,
    error: enabled && result.key === key ? result.error : null,
    loading: enabled && result.key !== key,
  };
}
export const useCatalogBranches = (refresh) =>
  useCatalogResource(`branches:${refresh}`, getCatalogBranches);
export const useCatalogCategories = (refresh) =>
  useCatalogResource(`categories:${refresh}`, getCatalogCategories);
export const useCatalogPage = (params, refresh, enabled) =>
  useCatalogResource(
    JSON.stringify({ ...params, refresh }),
    (signal) => getCatalogPage(params, signal),
    enabled,
  );
