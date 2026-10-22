import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Layers,
  MapPin,
  Popcorn,
  RefreshCw,
  UtensilsCrossed,
} from "lucide-react";
import { useSelectedBranchStore } from "../../../lib/store/selectedBranchStore";
import { useAuth } from "../../auth/hooks/useAuth";
import {
  useCatalogBranches,
  useCatalogCategories,
  useCatalogPage,
} from "../hooks/useConcessionCatalog";
import { readCatalogFilters } from "../utils/catalogPresentation";
import CatalogCard from "../components/CatalogCard";
import CatalogDetail from "../components/CatalogDetail";

const button =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-semibold text-white hover:bg-surface-container-highest disabled:pointer-events-none disabled:opacity-40";
function Message({ title, children, retry }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-container-low p-10 text-center">
      <Popcorn className="mx-auto size-10 text-secondary/70" />
      <h2 className="mt-4 font-heading text-xl font-bold text-white">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-on-surface/60">
        {children}
      </p>
      {retry && (
        <button type="button" onClick={retry} className={`${button} mt-5`}>
          Try again
        </button>
      )}
    </div>
  );
}
function CatalogContent({
  branchId,
  branchName,
  categories,
  refresh,
  filters,
  setFilters,
}) {
  const [selected, setSelected] = useState(null);
  const request = useCatalogPage(
    {
      kind: filters.kind,
      branchId,
      categoryId: filters.categoryId || undefined,
      page: filters.page,
      limit: 12,
    },
    refresh,
    true,
  );
  const combo = filters.kind === "combos";
  const meta = request.data?.meta;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-bold text-white">
          {combo
            ? "Combos"
            : categories.find((c) => c.id === filters.categoryId)?.name ||
              "All Items"}
        </h2>
        <span aria-live="polite" className="text-xs text-on-surface/50">
          {request.loading
            ? "Loading menu…"
            : meta
              ? `${meta.total} ${combo ? "combos" : "items"} · ${branchName}`
              : ""}
        </span>
      </div>
      {request.loading ? (
        <div
          aria-label="Loading menu"
          aria-busy="true"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-96 animate-pulse rounded-2xl bg-surface-container-low"
            />
          ))}
        </div>
      ) : request.error ? (
        <Message title="Menu could not be loaded" retry={() => setFilters({})}>
          {request.error.response?.data?.code === "BRANCH_NOT_FOUND"
            ? "This branch is unavailable. Please choose another branch."
            : "Please try again or choose another branch."}
        </Message>
      ) : !request.data?.items.length ? (
        <Message
          title={
            filters.page > 1
              ? "No items on this page"
              : combo
                ? "No combos yet"
                : "No items in this category"
          }
        >
          {filters.page > 1 ? (
            <button
              type="button"
              className={button}
              onClick={() => setFilters({ page: 1 })}
            >
              Go to first page
            </button>
          ) : (
            "Try another category or choose another branch."
          )}
        </Message>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {request.data.items.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              combo={combo}
              onDetails={setSelected}
            />
          ))}
        </div>
      )}
      {meta?.totalPages > 1 && (
        <nav
          aria-label="Menu pagination"
          className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-5"
        >
          <button
            className={button}
            disabled={filters.page <= 1}
            onClick={() => setFilters({ page: filters.page - 1 })}
          >
            <ArrowLeft className="size-4" />
            Previous
          </button>
          <span className="text-sm text-on-surface/60">
            Page {meta.page} / {meta.totalPages}
          </span>
          <button
            className={button}
            disabled={filters.page >= meta.totalPages}
            onClick={() => setFilters({ page: filters.page + 1 })}
          >
            Next
            <ArrowRight className="size-4" />
          </button>
        </nav>
      )}
      {selected && !request.loading && !request.error && (
        <CatalogDetail
          key={selected.id}
          item={selected}
          combo={combo}
          branchName={branchName}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

export default function ConcessionCatalogPage({ staff = false }) {
  const [params, setParams] = useSearchParams();
  const filters = readCatalogFilters(params);
  const [refresh, setRefresh] = useState(0);
  const { account } = useAuth();
  const storedBranch = useSelectedBranchStore((s) => s.selectedBranchId);
  const setStoredBranch = useSelectedBranchStore((s) => s.setSelectedBranchId);
  const [staffBranch, setStaffBranch] = useState("");
  const branches = useCatalogBranches(refresh);
  const categories = useCatalogCategories(refresh);
  const selectedId = staff
    ? staffBranch || account?.employeeProfile?.branchId || ""
    : storedBranch;
  const branch = branches.data?.find((b) => b.id === selectedId);
  const setFilters = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (!value || (key === "page" && value === 1)) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next);
    if (Object.keys(changes).length === 0) setRefresh((v) => v + 1);
  };
  const changeBranch = (id) => {
    if (staff) setStaffBranch(id);
    else setStoredBranch(id);
    setFilters({ page: 1 });
  };
  return (
    <div
      className={
        staff
          ? "p-4 sm:p-6 lg:p-8"
          : "mx-auto max-w-[1440px] px-4 pb-16 pt-28 sm:px-6 lg:px-10"
      }
    >
      {!staff && (
        <nav
          aria-label="Breadcrumb"
          className="mb-7 flex items-center gap-2 text-xs text-on-surface/50"
        >
          <Link to="/" className="hover:text-white">
            Home
          </Link>
          <ChevronRight className="size-3" />
          <span className="text-secondary">Food & Drink</span>
        </nav>
      )}
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top_right,rgba(229,9,20,0.2),transparent_65%)] px-6 py-9 sm:px-10 sm:py-12">
        <div
          className="absolute -right-8 -top-9 rotate-12 text-secondary/5"
          aria-hidden="true"
        >
          <Popcorn className="size-64 stroke-[0.6]" />
        </div>
        <p className="relative mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-secondary">
          F-Cinema · Food & drink
        </p>
        <h1 className="relative max-w-2xl font-heading text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {staff ? (
            "Concession Menu"
          ) : (
            <>
              Movie time.
              <br />
              <span className="text-secondary">Snack time.</span>
            </>
          )}
        </h1>
        <p className="relative mt-4 max-w-lg text-sm leading-6 text-on-surface/65">
          Explore food, drinks and combos at F-Cinema. Choose a branch to view
          the menu and availability.
        </p>
        <div className="relative mt-6 flex flex-wrap items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 sm:max-w-sm">
            <MapPin className="size-5 shrink-0 text-secondary" />
            <span className="sr-only">Menu branch</span>
            <select
              aria-label="Menu branch"
              value={branch?.id || ""}
              onChange={(e) => changeBranch(e.target.value)}
              disabled={branches.loading || !!branches.error}
              className="w-full min-w-0 bg-transparent text-sm font-semibold text-white outline-none [&>option]:bg-surface-container"
            >
              <option value="">
                {branches.loading ? "Loading branches…" : "Choose a branch"}
              </option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-label="Refresh menu"
            onClick={() => setRefresh((v) => v + 1)}
            className={button}
          >
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </section>
      <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside>
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface/40">
            Explore the menu
          </p>
          <nav
            aria-label="Menu categories"
            className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:gap-1"
          >
            {[
              {
                id: "",
                label: "All Items",
                icon: UtensilsCrossed,
                kind: "items",
              },
              ...(categories.data || []).map((c) => ({
                id: c.id,
                label: c.name,
                icon: Popcorn,
                kind: "items",
              })),
              { id: "", label: "Combos", icon: Layers, kind: "combos" },
            ].map(({ id, label, icon: Icon, kind }) => {
              const active = filters.kind === kind && filters.categoryId === id;
              return (
                <button
                  key={`${kind}:${id}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilters({ kind, categoryId: id, page: 1 })}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${active ? "bg-primary-container text-white" : "text-on-surface/65 hover:bg-surface-container"}`}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                  {active && (
                    <Check className="ml-auto hidden size-4 lg:block" />
                  )}
                </button>
              );
            })}
          </nav>
          {categories.error && (
            <p role="status" className="mt-3 text-xs text-on-surface/60">
              Categories could not be loaded. You can still browse all items.
            </p>
          )}
          <p className="mt-6 hidden border-t border-white/10 pt-5 text-xs leading-6 text-on-surface/45 lg:block">
            Prices are shown in VND.
            <br />
            Availability is for the selected branch.
          </p>
        </aside>
        <section aria-label="Menu items" className="min-w-0">
          {branches.loading ? (
            <Message title="Loading branches…">
              Please wait a moment.
            </Message>
          ) : branches.error ? (
            <Message
              title="Branches could not be loaded"
              retry={() => setRefresh((v) => v + 1)}
            >
              Please check your connection and try again.
            </Message>
          ) : !branches.data?.length ? (
            <Message title="No active branches">
              The menu will appear when a branch is active.
            </Message>
          ) : !branch ? (
            <Message title="Which cinema are you visiting?">
              Choose a branch above to view prices, items and combo availability.
            </Message>
          ) : (
            <CatalogContent
              key={`${branch.id}:${filters.kind}:${filters.categoryId}:${filters.page}:${refresh}`}
              branchId={branch.id}
              branchName={branch.branchName}
              categories={categories.data || []}
              refresh={refresh}
              filters={filters}
              setFilters={setFilters}
            />
          )}
        </section>
      </div>
    </div>
  );
}
