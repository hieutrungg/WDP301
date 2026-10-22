export const catalogPrice = (price) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);

export function catalogBadges(item) {
  return [
    ...(item.available
      ? []
      : [{ key: "unavailable", label: "Unavailable" }]),
    ...(item.isSpecialOffer
      ? [{ key: "special", label: "Special offer" }]
      : []),
  ];
}

export function readCatalogFilters(params) {
  const kind = params.get("kind") === "combos" ? "combos" : "items";
  const category = params.get("categoryId") || "";
  const rawPage = params.get("page") || "1";
  const page =
    /^[1-9]\d*$/.test(rawPage) && Number(rawPage) <= 100000
      ? Number(rawPage)
      : 1;
  return {
    kind,
    categoryId:
      kind === "items" && /^[a-f\d]{24}$/i.test(category)
        ? category.toLowerCase()
        : "",
    page,
  };
}
