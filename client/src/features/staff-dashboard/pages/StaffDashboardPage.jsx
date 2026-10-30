import {
  ArrowRight,
  AlertTriangle,
  Activity,
  BarChart3,
  Boxes,
  CalendarClock,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  MapPin,
  PackagePlus,
  Popcorn,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth";
import { getCatalogBranches } from "../../concessions/api/concessionApi";
import {
  getStockSummaryRequest,
  listStockLevelsRequest,
} from "../../inventory/api/inventoryApi";
import { getStaffDashboardRequest } from "../api/staffDashboardApi";

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

const actions = [
  {
    title: "Sell Tickets",
    description:
      "Select a movie, showtime and seats, then complete payment at the counter.",
    to: "/staff/pos",
    icon: Ticket,
    accent: "primary",
  },
  {
    title: "Sell Concessions",
    description:
      "Create a standalone food and drink order with cash or QR payment.",
    to: "/staff/concessions",
    icon: Popcorn,
    accent: "secondary",
  },
  {
    title: "Inventory",
    description:
      "Review concession stock levels and items that need attention.",
    to: "/staff/inventory",
    icon: Boxes,
    permission: "inventory.view",
    accent: "tertiary",
  },
  {
    title: "Stock Goods",
    description: "Record newly received goods for the assigned cinema branch.",
    to: "/staff/inventory/stock-in",
    icon: PackagePlus,
    permission: "inventory.stock_in",
    accent: "tertiary",
  },
];

const accentClasses = {
  primary: "bg-primary-container/15 text-primary ring-primary-container/20",
  secondary: "bg-secondary/10 text-secondary ring-secondary/15",
  tertiary: "bg-tertiary/10 text-tertiary ring-tertiary/15",
};

function StaffDashboardPage() {
  const { account } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [resolvedBranchName, setResolvedBranchName] = useState(null);
  const [inventory, setInventory] = useState({
    loading: true,
    summary: null,
    alerts: [],
    error: null,
  });
  const [inventoryRefresh, setInventoryRefresh] = useState(0);
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [counter, setCounter] = useState({
    loading: true,
    data: null,
    error: null,
  });
  const branchId = account?.employeeProfile?.branchId;
  const displayName =
    account?.profile?.fullName || account?.username || "Staff member";
  const permissions = useMemo(
    () => new Set(account?.permissions?.map(({ name }) => name)),
    [account?.permissions],
  );
  const visibleActions = actions.filter(
    ({ permission }) => !permission || permissions.has(permission),
  );
  const canViewInventory = permissions.has("inventory.view");
  const branchName = branchId
    ? resolvedBranchName || "Assigned cinema"
    : "No cinema branch assigned";

  useEffect(() => {
    const controller = new AbortController();
    getStaffDashboardRequest(controller.signal)
      .then((data) => setCounter({ loading: false, data, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setCounter((current) => ({ ...current, loading: false, error }));
        }
      });
    return () => controller.abort();
  }, [counterRefresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!branchId) {
      return undefined;
    }
    const controller = new AbortController();
    getCatalogBranches(controller.signal)
      .then((branches) => {
        const branch = branches.find(({ id }) => id === branchId);
        setResolvedBranchName(branch?.branchName || "Assigned cinema");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResolvedBranchName("Assigned cinema");
      });
    return () => controller.abort();
  }, [branchId]);

  useEffect(() => {
    if (!canViewInventory) return undefined;
    const controller = new AbortController();
    Promise.all([
      getStockSummaryRequest(controller.signal),
      listStockLevelsRequest(
        { status: "LOW_STOCK", page: 1, limit: 3 },
        controller.signal,
      ),
      listStockLevelsRequest(
        { status: "OUT_OF_STOCK", page: 1, limit: 3 },
        controller.signal,
      ),
    ])
      .then(([summary, low, out]) => {
        setInventory({
          loading: false,
          summary,
          alerts: [
            ...out.items.map((item) => ({ ...item, alert: "OUT_OF_STOCK" })),
            ...low.items.map((item) => ({ ...item, alert: "LOW_STOCK" })),
          ].slice(0, 4),
          error: null,
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setInventory((current) => ({ ...current, loading: false, error }));
        }
      });
    return () => controller.abort();
  }, [canViewInventory, inventoryRefresh]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_18%_0%,rgba(229,9,20,0.17),transparent_42%),radial-gradient(circle_at_78%_0%,rgba(255,214,91,0.10),transparent_34%)]" />

      <div className="relative mx-auto max-w-[1500px] space-y-6">
        <section className="overflow-hidden rounded-2xl border border-white/8 bg-surface-container-low/90 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="h-1 bg-gradient-to-r from-primary-container via-secondary to-primary-container" />
          <div className="grid gap-8 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary-container/15 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary ring-1 ring-primary-container/20">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  Operations terminal
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-400/15">
                  <CheckCircle2 className="size-3.5" /> Ready
                </span>
              </div>
              <p className="text-sm font-medium text-on-surface-variant">
                Welcome back, {displayName}
              </p>
              <h1 className="mt-1 max-w-3xl font-heading text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">
                Staff Operations Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-tertiary">
                Start a counter sale, process a concession order, or review the
                inventory tools available to your account.
              </p>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:min-w-[430px]">
              <div className="rounded-xl border border-white/7 bg-surface-container p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  <MapPin className="size-4 text-primary" /> Cinema
                </div>
                <p className="mt-2 truncate font-heading text-base font-bold text-on-surface">
                  {branchName}
                </p>
              </div>
              <div className="rounded-xl border border-white/7 bg-surface-container p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  <Clock3 className="size-4 text-secondary" /> Local time
                </div>
                <p className="mt-2 font-heading text-xl font-extrabold tabular-nums text-secondary">
                  {timeFormatter.format(now)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-tertiary">
                  {dateFormatter.format(now)} · ICT
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
                Counter workspace
              </p>
              <h2 className="mt-1 font-heading text-2xl font-bold">
                Quick Actions
              </h2>
            </div>
            <p className="text-xs text-on-surface-variant">
              Only tools allowed for your account are shown.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {visibleActions.map(
              ({ title, description, to, icon: Icon, accent }) => (
                <Link
                  key={title}
                  to={to}
                  className="group relative min-h-52 overflow-hidden rounded-2xl border border-white/7 bg-surface-container-low p-5 transition duration-200 hover:-translate-y-1 hover:border-white/15 hover:bg-surface-container hover:shadow-xl hover:shadow-black/20"
                >
                  <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-white/[0.025] transition-transform duration-300 group-hover:scale-125" />
                  <div
                    className={`grid size-12 place-items-center rounded-xl ring-1 ${accentClasses[accent]}`}
                  >
                    <Icon className="size-6" />
                  </div>
                  <h3 className="mt-6 font-heading text-lg font-bold text-on-surface">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-5 text-tertiary">
                    {description}
                  </p>
                  <span className="absolute bottom-5 left-5 inline-flex items-center gap-2 text-xs font-bold text-primary transition-all group-hover:gap-3">
                    Open workspace <ArrowRight className="size-4" />
                  </span>
                </Link>
              ),
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-secondary">
                Live overview
              </p>
              <h2 className="mt-1 font-heading text-2xl font-bold">
                Today's Operations
              </h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                Metrics available to the current Staff account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCounter((current) => ({
                  ...current,
                  loading: true,
                  error: null,
                }));
                setCounterRefresh((value) => value + 1);
                if (canViewInventory) {
                  setInventory((current) => ({
                    ...current,
                    loading: true,
                    error: null,
                  }));
                  setInventoryRefresh((value) => value + 1);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-xs font-bold text-tertiary transition hover:bg-surface-container-high hover:text-on-surface"
            >
              <RefreshCw
                className={`size-3.5 ${inventory.loading || counter.loading ? "animate-spin" : ""}`}
              />{" "}
              Refresh data
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                Ticket,
                "Ticket Sales",
                counter.loading
                  ? "…"
                  : (counter.data?.metrics?.ticketSales ?? "—"),
                counter.error
                  ? "Counter activity could not be loaded"
                  : "Tickets sold by you today",
                "text-primary",
              ],
              [
                Popcorn,
                "F&B Orders",
                counter.loading
                  ? "…"
                  : (counter.data?.metrics?.concessionOrders ?? "—"),
                counter.error
                  ? "Counter activity could not be loaded"
                  : "Standalone orders completed by you today",
                "text-secondary",
              ],
              [
                ReceiptText,
                "Transactions",
                counter.loading
                  ? "…"
                  : (counter.data?.metrics?.transactions ?? "—"),
                counter.error
                  ? "Counter activity could not be loaded"
                  : counter.data
                    ? `${moneyFormatter.format(counter.data.metrics.grossAmount)} gross sales`
                    : "Completed by you today",
                "text-tertiary",
              ],
              [
                AlertTriangle,
                "Low-stock Items",
                inventory.loading
                  ? "…"
                  : canViewInventory
                    ? (inventory.summary?.lowStock ?? "—")
                    : "—",
                canViewInventory
                  ? "Current assigned-branch inventory"
                  : "Inventory permission required",
                "text-secondary",
              ],
            ].map(([Icon, label, value, caption, accent]) => (
              <article
                key={label}
                className="rounded-2xl border border-white/7 bg-surface-container-low p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-on-surface-variant">
                    {label}
                  </p>
                  <Icon className={`size-5 ${accent}`} />
                </div>
                <p
                  className={`mt-4 font-heading text-3xl font-extrabold ${accent}`}
                >
                  {value}
                </p>
                <p className="mt-2 text-xs leading-5 text-tertiary">
                  {caption}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="overflow-hidden rounded-2xl border border-white/7 bg-surface-container-low">
            <div className="flex items-center justify-between border-b border-white/7 p-5">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
                  Counter ledger
                </p>
                <h2 className="mt-1 font-heading text-xl font-bold">
                  Recent Counter Activity
                </h2>
              </div>
              <Activity className="size-5 text-primary" />
            </div>
            {counter.loading ? (
              <div className="grid min-h-56 place-items-center px-6 py-10 text-sm text-tertiary">
                Loading your counter activity…
              </div>
            ) : counter.error ? (
              <div className="grid min-h-56 place-items-center px-6 py-10 text-center">
                <div>
                  <AlertTriangle className="mx-auto size-8 text-error" />
                  <p className="mt-3 text-sm text-error">
                    Counter activity could not be loaded.
                  </p>
                </div>
              </div>
            ) : counter.data?.activity?.length ? (
              <div className="divide-y divide-white/5 px-5">
                {counter.data.activity.map((item) => {
                  const Icon = item.type === "TICKET" ? Ticket : Popcorn;
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center gap-4 py-4"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-container text-primary">
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {item.type === "TICKET" ? "Ticket sale" : "F&B order"}{" "}
                          · {item.reference}
                        </p>
                        <p className="mt-1 text-xs text-tertiary">
                          {item.quantity}{" "}
                          {item.type === "TICKET" ? "ticket(s)" : "item(s)"} ·{" "}
                          {timeFormatter.format(new Date(item.occurredAt))}
                        </p>
                      </div>
                      <strong className="shrink-0 text-sm text-secondary">
                        {moneyFormatter.format(item.amount)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-56 place-items-center px-6 py-10 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-container text-tertiary">
                    <BarChart3 className="size-6" />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-bold">
                    No counter activity today
                  </h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-tertiary">
                    Your confirmed ticket sales and standalone F&amp;B orders
                    will appear here after checkout.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/7 bg-surface-container-low">
            <div className="flex items-center justify-between border-b border-white/7 p-5">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-secondary">
                  Inventory
                </p>
                <h2 className="mt-1 font-heading text-xl font-bold">
                  Stock Alerts
                </h2>
              </div>
              {canViewInventory && (
                <Link
                  to="/staff/inventory"
                  className="text-xs font-bold text-primary"
                >
                  View all
                </Link>
              )}
            </div>
            <div className="divide-y divide-white/5 px-5">
              {!canViewInventory ? (
                <p className="py-10 text-center text-sm text-tertiary">
                  Inventory permission is required.
                </p>
              ) : inventory.loading && !inventory.summary ? (
                <p className="py-10 text-center text-sm text-tertiary">
                  Loading stock alerts…
                </p>
              ) : inventory.error ? (
                <p className="py-10 text-center text-sm text-error">
                  Stock alerts could not be loaded.
                </p>
              ) : inventory.alerts.length === 0 ? (
                <p className="py-10 text-center text-sm text-emerald-400">
                  All tracked items are above their alert threshold.
                </p>
              ) : (
                inventory.alerts.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{item.name}</p>
                      <p className="mt-1 text-xs text-tertiary">
                        {item.quantity} {item.unit || "units"} remaining ·
                        minimum {item.minThreshold}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${item.alert === "OUT_OF_STOCK" ? "bg-error-container/30 text-error" : "bg-secondary/10 text-secondary"}`}
                    >
                      {item.alert === "OUT_OF_STOCK"
                        ? "Out of stock"
                        : "Low stock"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-2xl border border-white/7 bg-surface-container-low p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/7 pb-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-secondary">
                  Service flow
                </p>
                <h2 className="mt-1 font-heading text-xl font-bold">
                  Counter Checklist
                </h2>
              </div>
              <Sparkles className="size-5 text-secondary" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                [
                  CircleUserRound,
                  "Confirm request",
                  "Identify whether the customer needs tickets, food and drinks, or both.",
                ],
                [
                  WalletCards,
                  "Complete payment",
                  "Use cash or QR only through the matching staff checkout screen.",
                ],
                [
                  CalendarClock,
                  "Issue output",
                  "Print the ticket or receipt only after the transaction is confirmed.",
                ],
              ].map(([Icon, title, body], index) => (
                <article
                  key={title}
                  className="rounded-xl bg-surface-container p-4 ring-1 ring-white/5"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="size-5 text-primary" />
                    <span className="font-heading text-2xl font-extrabold text-white/10">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-sm font-bold text-on-surface">
                    {title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-tertiary">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-primary-container/20 bg-gradient-to-br from-primary-container/20 via-surface-container-low to-surface-container-low p-5 sm:p-6">
            <div className="absolute -bottom-16 -right-16 size-52 rounded-full bg-primary-container/15 blur-3xl" />
            <div className="relative">
              <div className="grid size-11 place-items-center rounded-xl bg-primary-container text-white shadow-crimson">
                <ShieldCheck className="size-5" />
              </div>
              <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
                Secure staff session
              </p>
              <h2 className="mt-1 font-heading text-xl font-bold">
                Authorized Operations
              </h2>
              <p className="mt-3 text-sm leading-6 text-tertiary">
                Cash payment and counter operations are available only inside
                the Staff Portal. Every API action remains protected by backend
                authentication and permissions.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {account?.roles?.map(({ name }) => (
                  <span
                    key={name}
                    className="rounded-full bg-surface-container-high px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary"
                  >
                    {name}
                  </span>
                ))}
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Authenticated
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default StaffDashboardPage;
