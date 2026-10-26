import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Clock3, Minus, Plus, Popcorn } from "lucide-react";
import { useAuth } from "../../auth/hooks/useAuth";
import { acquireSeatHold } from "../../seat-selection/api/seatHoldApi";
import { useCatalogPage } from "../../concessions/hooks/useConcessionCatalog";
import { getCatalogCategories } from "../../concessions/api/concessionApi";
import {
  CatalogBadges,
  CatalogImage,
} from "../../concessions/components/CatalogCard";
import { formatSeatMoney } from "../../seat-selection/utils/seatPricing";
import { getApiErrorMessage } from "../../../lib/api/apiError";
import { quoteConcessions } from "../api/bookingApi";
import { restoreCheckout } from "../utils/checkoutFlow";
import {
  readCheckout,
  remainingHoldMs,
  writeCheckout,
} from "../utils/checkoutSession";

const primary =
  "rounded-xl bg-primary-container px-5 py-3 font-bold text-white disabled:opacity-40";
const itemKey = (line) => `${line.itemType}:${line.itemId}`;

export default function ConcessionSelectionPage() {
  const { showtimeId } = useParams();
  const { account } = useAuth();
  return <ConcessionSelectionSession key={`${account.id}:${showtimeId}`} />;
}

function ConcessionSelectionSession() {
  const { showtimeId } = useParams();
  const { account } = useAuth();
  const navigate = useNavigate();
  const [attempt] = useState(() =>
    readCheckout(sessionStorage, account.id, showtimeId),
  );
  const [items, setItems] = useState(
    attempt?.foodDraft ?? attempt?.concessionSelection?.items ?? [],
  );
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [now, setNow] = useState(Date.now);
  const [kind, setKind] = useState("items");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const holdQuery = useQuery({
    queryKey: ["food-hold", account.id, showtimeId, attempt?.checkoutKey],
    enabled: Boolean(attempt && !attempt.bookingRequested),
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => restoreCheckout({ attempt, acquire: acquireSeatHold }),
  });
  const hold = holdQuery.data?.hold;
  const context = useQuery({
    queryKey: ["food-context", account.id, hold?.holdId],
    enabled: Boolean(hold),
    retry: false,
    queryFn: () => quoteConcessions({ holdId: hold.holdId, items: [] }),
  });
  const branchId = context.data?.branchId;
  const categories = useQuery({
    queryKey: ["food-categories"],
    enabled: Boolean(branchId),
    queryFn: ({ signal }) => getCatalogCategories(signal),
    retry: false,
  });
  const catalog = useCatalogPage(
    {
      kind,
      branchId,
      page,
      limit: 12,
      ...(kind === "items" && categoryId ? { categoryId } : {}),
    },
    refresh,
    Boolean(branchId),
  );
  const remaining = remainingHoldMs(hold, holdQuery.data?.receivedAt, now);
  const expired = Boolean(hold && (remaining <= 0 || hold.status !== "ACTIVE"));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!attempt)
    return (
      <main className="mx-auto max-w-5xl px-6 pb-20 pt-32 text-white">
        <h1 className="text-2xl font-bold">Select seats first</h1>
        <Link
          to={`/booking/${showtimeId}/seats`}
          className="mt-5 inline-block underline"
        >
          Choose seats
        </Link>
      </main>
    );
  if (attempt.bookingRequested)
    return <Navigate to={`/booking/${showtimeId}/checkout`} replace />;

  const changeQuantity = (item, delta) => {
    const line = {
      itemType: kind === "combos" ? "COMBO" : "CONCESSION",
      itemId: item.id,
    };
    const existing = items.find((value) => itemKey(value) === itemKey(line));
    const quantity = (existing?.quantity ?? 0) + delta;
    if (quantity > 100 || (!existing && items.length >= 50)) return;
    setQuote(null);
    setError(null);
    const next = [
      ...items.filter((value) => itemKey(value) !== itemKey(line)),
      ...(quantity > 0 ? [{ ...line, quantity }] : []),
    ];
    try {
      writeCheckout(sessionStorage, { ...attempt, foodDraft: next });
      setItems(next);
    } catch (cause) {
      setError(cause);
    }
  };
  const continueCheckout = async (skip = false) => {
    if (lock.current || !hold || expired) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!skip && items.length && !quote) {
        setQuote(await quoteConcessions({ holdId: hold.holdId, items }));
        return;
      }
      const withFood = !skip && items.length > 0;
      writeCheckout(sessionStorage, {
        ...attempt,
        foodReviewed: true,
        foodDraft: undefined,
        concessionSelection: withFood
          ? {
              items: quote.items.map(({ itemType, itemId, quantity }) => ({
                itemType,
                itemId,
                quantity,
              })),
              quoteReference: quote.quoteReference,
            }
          : undefined,
        concessionQuote: withFood ? quote : undefined,
      });
      navigate(`/booking/${showtimeId}/checkout`);
    } catch (cause) {
      setError(cause);
      setQuote(null);
      setRefresh((value) => value + 1);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const seconds = Math.ceil(remaining / 1000);
  const failure = error ?? holdQuery.error ?? context.error ?? catalog.error;
  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-28 text-on-surface sm:px-8">
      <div className="mx-auto max-w-7xl">
        <nav
          aria-label="Booking progress"
          className="mb-8 text-sm text-on-surface-variant"
        >
          Seats <span className="px-3">/</span>
          <strong className="text-secondary">Food &amp; Drink</strong>
          <span className="px-3">/</span>Payment
        </nav>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-secondary">
              Make it a movie night
            </p>
            <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
              Food &amp; Drink{" "}
              <span className="text-base font-normal text-on-surface-variant">
                Optional
              </span>
            </h1>
            <p className="mt-3 text-sm text-on-surface-variant">
              {context.data?.branchName ?? "Loading your cinema…"} · Your food
              is collected at the same cinema.
            </p>
          </div>
          {hold && (
            <p
              role="timer"
              className="flex items-center gap-2 rounded-xl bg-surface-container p-4 font-mono text-secondary"
            >
              <Clock3 className="size-4" />
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}{" "}
              remaining
            </p>
          )}
        </div>
        {failure && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-error/40 bg-error/10 p-4"
          >
            {getApiErrorMessage(failure)}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => {
                holdQuery.refetch();
                context.refetch();
                setRefresh((value) => value + 1);
              }}
            >
              Retry
            </button>
          </div>
        )}
        {holdQuery.isError && (
          <Link
            to={`/booking/${showtimeId}/checkout`}
            className="mb-6 inline-block text-secondary underline"
          >
            Review reservation or choose seats again
          </Link>
        )}
        {expired ? (
          <section className="rounded-2xl bg-surface-container-low p-8">
            <h2 className="text-xl font-bold">Your seat reservation expired</h2>
            <p className="my-4">
              Please select seats again to start a new checkout.
            </p>
            <Link to={`/booking/${showtimeId}/checkout`} className={primary}>
              Review reservation
            </Link>
          </section>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
            <section aria-label="Food menu">
              <div className="mb-6 flex gap-3">
                {[
                  ["items", "Food & Drinks"],
                  ["combos", "Combos"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={kind === value}
                    className={`rounded-full px-5 py-2.5 font-bold ${kind === value ? "bg-primary-container text-white" : "bg-surface-container"}`}
                    onClick={() => {
                      setKind(value);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {kind === "items" && categories.data?.length > 0 && (
                <label className="mb-6 block text-sm text-on-surface-variant">
                  Category
                  <select
                    value={categoryId}
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setPage(1);
                    }}
                    className="ml-3 rounded-xl border border-white/10 bg-surface-container px-4 py-2 text-white"
                  >
                    <option value="">All categories</option>
                    {categories.data.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(holdQuery.isFetching ||
                context.isFetching ||
                catalog.loading) && (
                <p role="status" className="py-12 text-center">
                  Loading menu…
                </p>
              )}
              {catalog.data?.items.length === 0 && (
                <div className="rounded-xl bg-surface-container-low p-10 text-center">
                  <Popcorn className="mx-auto mb-4 size-8 text-secondary" />
                  <p>
                    No food is listed at this cinema. Continue with your
                    tickets.
                  </p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {catalog.data?.items.map((item) => {
                  const quantity =
                    items.find(
                      (line) =>
                        line.itemId === item.id &&
                        line.itemType ===
                          (kind === "combos" ? "COMBO" : "CONCESSION"),
                    )?.quantity ?? 0;
                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low"
                    >
                      <div className="relative">
                        <CatalogImage
                          key={item.imageUrl}
                          item={item}
                          combo={kind === "combos"}
                        />
                        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                          <CatalogBadges item={item} />
                        </div>
                      </div>
                      <div className="p-4">
                        <h2 className="min-h-12 font-bold">{item.name}</h2>
                        {item.size && (
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {item.size}
                          </p>
                        )}
                        <p className="my-4 font-bold text-secondary">
                          {formatSeatMoney(item.price)}
                        </p>
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            aria-label={`Remove one ${item.name}`}
                            disabled={busy || !quantity}
                            onClick={() => changeQuantity(item, -1)}
                            className="rounded-lg bg-surface-container p-2 disabled:opacity-30"
                          >
                            <Minus className="size-4" />
                          </button>
                          <output aria-label={`Quantity ${item.name}`}>
                            {quantity}
                          </output>
                          <button
                            type="button"
                            aria-label={`Add one ${item.name}`}
                            disabled={
                              busy ||
                              !item.available ||
                              quantity >= 100 ||
                              (!quantity && items.length >= 50)
                            }
                            onClick={() => changeQuantity(item, 1)}
                            className="rounded-lg bg-primary-container p-2 text-white disabled:opacity-30"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {catalog.data?.meta.totalPages > 1 && (
                <nav
                  aria-label="Menu pages"
                  className="mt-6 flex justify-between"
                >
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    {page} / {catalog.data.meta.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= catalog.data.meta.totalPages}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
            </section>
            <aside className="rounded-2xl border border-white/10 bg-surface-container-low p-6 lg:sticky lg:top-24">
              <h2 className="mb-4 font-heading text-xl font-bold">
                Your selection
              </h2>
              <p className="mb-3 text-sm text-on-surface-variant">
                Seats:{" "}
                {attempt.labels
                  .map((seat) => `${seat.row}${seat.number}`)
                  .join(", ")}{" "}
                · {formatSeatMoney(hold?.priceQuote?.totalAmount ?? 0)}
              </p>
              <p className="mb-5 text-sm text-on-surface-variant">
                {items.reduce((sum, line) => sum + line.quantity, 0)} food items
                selected. Stock is reserved when you submit checkout.
              </p>
              {items.map((line) => (
                <div
                  key={itemKey(line)}
                  className="mb-3 flex justify-between gap-3 text-sm"
                >
                  <span>
                    {quote?.items.find(
                      (item) => itemKey(item) === itemKey(line),
                    )?.name ??
                      catalog.data?.items.find(
                        (item) => item.id === line.itemId,
                      )?.name ??
                      (line.itemType === "COMBO"
                        ? "Selected combo"
                        : "Selected item")}{" "}
                    × {line.quantity}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-error underline"
                    onClick={() => {
                      const next = items.filter(
                        (item) => itemKey(item) !== itemKey(line),
                      );
                      try {
                        writeCheckout(sessionStorage, {
                          ...attempt,
                          foodDraft: next,
                        });
                        setItems(next);
                        setQuote(null);
                      } catch (cause) {
                        setError(cause);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {quote && (
                <div
                  aria-live="polite"
                  className="my-5 border-y border-white/10 py-4 text-sm"
                >
                  <p className="mb-3 font-bold text-secondary">
                    Review current server prices
                  </p>
                  {quote.items.map((line) => (
                    <p key={itemKey(line)} className="mb-2">
                      {line.name} × {line.quantity}:{" "}
                      {formatSeatMoney(line.subtotal)}
                    </p>
                  ))}
                  <p className="mt-4">
                    Tickets: {formatSeatMoney(quote.ticketAmount)}
                  </p>
                  <p>Food: {formatSeatMoney(quote.concessionAmount)}</p>
                  <p className="mt-3 text-lg font-bold">
                    Total: {formatSeatMoney(quote.amount)}
                  </p>
                </div>
              )}
              {items.length > 0 ? (
                <button
                  type="button"
                  className={`${primary} mt-3 w-full`}
                  disabled={busy || !hold || !branchId}
                  onClick={() => continueCheckout()}
                >
                  {busy
                    ? "Checking…"
                    : quote
                      ? "Confirm selection & continue"
                      : "Review prices"}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${primary} mt-3 w-full`}
                  disabled={busy || !hold}
                  onClick={() => continueCheckout(true)}
                >
                  {busy ? "Continuing…" : "Skip F&B & continue to payment"}
                </button>
              )}
              <p className="mt-4 text-xs leading-5 text-on-surface-variant">
                You can buy tickets without food. Your seat reservation time
                stays the same.
              </p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
