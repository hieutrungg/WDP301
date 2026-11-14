import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  LoaderCircle,
  Minus,
  Plus,
  Popcorn,
  RefreshCw,
  RotateCcw,
  Search,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import EmptyState from "../../../components/common/EmptyState";
import ErrorState from "../../../components/common/ErrorState";
import { getApiErrorMessage } from "../../../lib/api/apiError";
import { useAuthStore } from "../../auth/store/authStore";
import { useMovies } from "../../movie-showtime/hooks/useMovies";
import { useShowtimes } from "../../movie-showtime/hooks/useShowtimes";
import SeatButton from "../../seat-selection/components/SeatButton";
import SeatLegend from "../../seat-selection/components/SeatLegend";
import {
  useAcquireSeatHold,
  useSeatAvailability,
} from "../../seat-selection/hooks/useSeatAvailability";
import {
  formatSeatMoney,
  hasValidSeatPrice,
  sumSeatPrices,
} from "../../seat-selection/utils/seatPricing";
import {
  createPendingBooking,
  quoteConcessions,
} from "../../booking/api/bookingApi";
import { useCatalogPage } from "../../concessions/hooks/useConcessionCatalog";
import {
  CatalogBadges,
  CatalogImage,
} from "../../concessions/components/CatalogCard";
import {
  getSeatAvailability,
  releaseSeatHold,
} from "../../seat-selection/api/seatHoldApi";
import {
  clearCounterOrderDraft,
  readCounterOrderDraft,
  writeCounterOrderDraft,
} from "../utils/counterOrderDraft";
import { uniqueAvailableCatalogItems } from "../../concessions/utils/catalogDisplay";
import { withCatalogImageOverride } from "../../concessions/utils/catalogPresentation";

const SEAT_SELECTION_DURATION_MS = 10 * 60 * 1000;

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});
const timeFmt = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

function vietnamDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function SeatMatrix({ rows, selected, locked, onToggle }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-container-low p-4 sm:p-6">
      <div className="mb-7 text-center">
        <svg
          viewBox="0 0 600 40"
          aria-hidden="true"
          className="mx-auto h-8 w-[min(90%,52rem)] overflow-visible drop-shadow-[0_6px_18px_rgba(229,9,20,0.35)]"
        >
          <defs>
            <linearGradient id="counter-pos-screen" x1="0" x2="1">
              <stop offset="0" stopColor="#e50914" stopOpacity="0.2" />
              <stop offset="0.5" stopColor="#ffffff" />
              <stop offset="1" stopColor="#e50914" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path
            d="M10 34 Q300 0 590 34"
            fill="none"
            stroke="url(#counter-pos-screen)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <p className="-mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
          Cinema screen
        </p>
      </div>
      <div className="w-full overflow-x-auto pb-3">
        <div className="mx-auto flex w-max min-w-max flex-col gap-3 px-2 sm:px-4">
          {rows.map(([row, seats]) => (
            <div key={row} className="flex items-center justify-center gap-3 sm:gap-4">
              <span className="w-5 shrink-0 text-center font-mono text-xs font-bold text-on-surface-variant">
                {row}
              </span>
              <div className="flex gap-2 sm:gap-2.5">
                {seats.map((seat, index) => (
                  <Fragment key={seat.seatId}>
                    {index === Math.ceil(seats.length / 2) && (
                      <span className="w-3 sm:w-5" />
                    )}
                    <SeatButton
                      seat={seat}
                      selected={selected.includes(seat.seatId)}
                      disabled={locked || !hasValidSeatPrice(seat.price)}
                      onToggle={onToggle}
                      size="counter"
                    />
                  </Fragment>
                ))}
              </div>
              <span className="w-5 shrink-0 text-center font-mono text-xs font-bold text-on-surface-variant">
                {row}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CounterPosPage() {
  const navigate = useNavigate();
  const account = useAuthStore((state) => state.account);
  const [savedDraft, setSavedDraft] = useState(() =>
    readCounterOrderDraft(sessionStorage, account?.id),
  );
  const [draftDecisionPending, setDraftDecisionPending] = useState(() =>
    Boolean(readCounterOrderDraft(sessionStorage, account?.id)),
  );
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(vietnamDateKey);
  const [movieId, setMovieId] = useState("");
  const [showtimeId, setShowtimeId] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionDeadline, setSelectionDeadline] = useState(null);
  const [now, setNow] = useState(Date.now);
  const [hold, setHold] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [foodOpen, setFoodOpen] = useState(false);
  const [foodKind, setFoodKind] = useState("items");
  const [foodItems, setFoodItems] = useState([]);
  const [foodContext, setFoodContext] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    if (!account?.id || draftDecisionPending) return;
    if (!showtimeId || !selectedIds.length) {
      clearCounterOrderDraft(sessionStorage, account.id);
      return;
    }
    writeCounterOrderDraft(sessionStorage, {
      accountId: account.id,
      movieId,
      showtimeId,
      date,
      selectedIds,
      selectionDeadline,
      hold,
      foodItems,
      foodContext,
      savedAt: new Date().toISOString(),
    });
  }, [
    account?.id,
    date,
    draftDecisionPending,
    foodContext,
    foodItems,
    hold,
    movieId,
    selectedIds,
    selectionDeadline,
    showtimeId,
  ]);

  // The public Movie contract caps a page at 24. Sending 50 made every Staff
  // POS request fail validation before any movie could be displayed.
  const movieQuery = useMemo(
    () =>
      new URLSearchParams({
        limit: "24",
        ...(query.trim() ? { q: query.trim() } : {}),
      }).toString(),
    [query],
  );
  const movies = useMovies(movieQuery);
  const schedule = useShowtimes({
    movieId: movieId || undefined,
    date,
    refreshToken: refresh,
  });
  const availability = useSeatAvailability(showtimeId);
  const acquire = useAcquireSeatHold(showtimeId);
  const selectedMovie = movies.movies.find((movie) => movie.id === movieId);
  const showtimes = useMemo(
    () =>
      movieId
        ? (schedule.data?.showtimes ?? []).filter(
            (item) => item.movieId === movieId,
          )
        : [],
    [movieId, schedule.data?.showtimes],
  );
  const selectedShowtime =
    showtimes.find((item) => item.id === showtimeId) ??
    availability.data?.showtime;
  const seats = useMemo(
    () => availability.data?.seats ?? [],
    [availability.data?.seats],
  );
  const seatMap = useMemo(
    () => new Map(seats.map((seat) => [seat.seatId, seat])),
    [seats],
  );
  const selectedSeats = selectedIds
    .map((id) => seatMap.get(id))
    .filter(Boolean);
  const selectedTotal = sumSeatPrices(selectedSeats);
  const total = hold?.priceQuote?.totalAmount ?? selectedTotal ?? 0;
  const effectiveDeadline = Math.min(
    Number.isFinite(selectionDeadline) ? selectionDeadline : Number.POSITIVE_INFINITY,
    hold?.expiresAt ? Date.parse(hold.expiresAt) : Number.POSITIVE_INFINITY,
  );
  const remainingSeconds = Number.isFinite(effectiveDeadline)
    ? Math.max(0, Math.ceil((effectiveDeadline - now) / 1000))
    : null;
  const catalog = useCatalogPage(
    { kind: foodKind, branchId: foodContext?.branchId, page: 1, limit: 24 },
    refresh,
    Boolean(foodOpen && foodContext?.branchId),
  );
  const foodCount = foodItems.reduce((sum, line) => sum + line.quantity, 0);
  const availableFoodItems = useMemo(
    () =>
      uniqueAvailableCatalogItems(catalog.data?.items).map(
        withCatalogImageOverride,
      ),
    [catalog.data?.items],
  );
  const rows = useMemo(() => {
    const groups = new Map();
    seats.forEach((seat) => {
      if (!groups.has(seat.row)) groups.set(seat.row, []);
      groups.get(seat.row).push(seat);
    });
    return [...groups.entries()].map(([row, values]) => [
      row,
      values.sort((a, b) => Number(a.number) - Number(b.number)),
    ]);
  }, [seats]);
  const seatTypes = useMemo(() => {
    const values = new Map();
    seats.forEach((seat) => {
      if (hasValidSeatPrice(seat.price))
        values.set(`${seat.type}:${seat.price}`, {
          ...seat,
          formattedPrice: formatSeatMoney(seat.price),
        });
    });
    return [...values.values()];
  }, [seats]);

  const chooseMovie = (id) => {
    if (!hold) {
      setMovieId(id);
      setShowtimeId("");
      setSelectedIds([]);
      setSelectionDeadline(null);
    }
  };
  const chooseShowtime = (id) => {
    if (!hold) {
      setShowtimeId(id);
      setSelectedIds([]);
      setSelectionDeadline(null);
    }
  };
  const toggleSeat = (id) => {
    const seat = seatMap.get(id);
    if (
      hold ||
      seat?.availability !== "AVAILABLE" ||
      !hasValidSeatPrice(seat?.price)
    )
      return;
    const isSelected = selectedIds.includes(id);
    if (!isSelected && selectedIds.length === 0 && selectionDeadline === null)
      setSelectionDeadline(Date.now() + SEAT_SELECTION_DURATION_MS);
    if (isSelected && selectedIds.length === 1) setSelectionDeadline(null);
    setSelectedIds((current) =>
      isSelected
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };
  const ensureHold = async () => {
    if (hold) return hold;
    const result = await acquire.mutateAsync({
      showtimeId,
      seatIds: selectedIds,
      checkoutKey: `counter-${crypto.randomUUID()}`,
    });
    setHold(result);
    return result;
  };

  useEffect(() => {
    if (!Number.isFinite(effectiveDeadline)) return undefined;
    const remaining = effectiveDeadline - Date.now();
    const timer = window.setTimeout(
      () => {
        setHold(null);
        setSelectedIds([]);
        setSelectionDeadline(null);
        setFoodOpen(false);
        setFoodItems([]);
        setFoodContext(null);
        clearCounterOrderDraft(sessionStorage, account?.id);
        setRefresh((value) => value + 1);
        toast.error(
          "The seat reservation expired. Please select the seats again.",
        );
      },
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(timer);
  }, [account?.id, effectiveDeadline]);

  useEffect(() => {
    if (!Number.isFinite(effectiveDeadline)) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [effectiveDeadline]);

  const continueSavedOrder = async () => {
    if (!savedDraft) return;
    if (savedDraft.selectionDeadline <= Date.now()) {
      clearCounterOrderDraft(sessionStorage, account?.id);
      setSavedDraft(null);
      setDraftDecisionPending(false);
      toast.error("The saved seat selection expired. Please select seats again.");
      return;
    }
    const activeHold =
      savedDraft.hold?.expiresAt &&
      Date.parse(savedDraft.hold.expiresAt) > Date.now()
        ? savedDraft.hold
        : null;
    let restoredIds = savedDraft.selectedIds;
    if (!activeHold) {
      try {
        const current = await getSeatAvailability(savedDraft.showtimeId);
        const currentSeats = new Map(
          (current?.seats ?? []).map((seat) => [seat.seatId, seat]),
        );
        restoredIds = savedDraft.selectedIds.filter((id) => {
          const seat = currentSeats.get(id);
          return (
            seat?.availability === "AVAILABLE" &&
            hasValidSeatPrice(seat.price)
          );
        });
        if (restoredIds.length !== savedDraft.selectedIds.length) {
          toast.warning("Some saved seats are no longer available and were removed.");
        }
      } catch (error) {
        toast.error(getApiErrorMessage(error));
        return;
      }
    }
    if (!restoredIds.length) {
      clearCounterOrderDraft(sessionStorage, account?.id);
      setSavedDraft(null);
      setDraftDecisionPending(false);
      toast.error("None of the saved seats are still available.");
      return;
    }
    setDate(savedDraft.date);
    setMovieId(savedDraft.movieId);
    setShowtimeId(savedDraft.showtimeId);
    setSelectedIds(restoredIds);
    setSelectionDeadline(savedDraft.selectionDeadline);
    setHold(activeHold);
    setFoodItems(activeHold ? savedDraft.foodItems : []);
    setFoodContext(activeHold ? savedDraft.foodContext : null);
    setSavedDraft(null);
    setDraftDecisionPending(false);
    toast.success("Your counter order has been restored.");
  };

  const discardSavedOrder = async () => {
    const activeHold = savedDraft?.hold;
    if (activeHold?.holdId && Date.parse(activeHold.expiresAt) > Date.now()) {
      try {
        await releaseSeatHold(activeHold.holdId);
      } catch (error) {
        toast.error(getApiErrorMessage(error));
        return;
      }
    }
    clearCounterOrderDraft(sessionStorage, account?.id);
    setSavedDraft(null);
    setDraftDecisionPending(false);
    toast.success("Saved order discarded and seats released.");
  };

  const openFood = async () => {
    setFoodOpen(true);
    if (foodContext) return;
    try {
      const activeHold = await ensureHold();
      setFoodContext(
        await quoteConcessions({ holdId: activeHold.holdId, items: [] }),
      );
    } catch (error) {
      setFoodOpen(false);
      toast.error(getApiErrorMessage(error));
      availability.refetch();
    }
  };
  const changeFood = (item, delta) => {
    const itemType = foodKind === "combos" ? "COMBO" : "CONCESSION";
    const key = `${itemType}:${item.id}`;
    const existing = foodItems.find(
      (line) => `${line.itemType}:${line.itemId}` === key,
    );
    const quantity = Math.max(
      0,
      Math.min(100, (existing?.quantity ?? 0) + delta),
    );
    setFoodItems((current) => [
      ...current.filter((line) => `${line.itemType}:${line.itemId}` !== key),
      ...(quantity ? [{ itemType, itemId: item.id, quantity }] : []),
    ]);
  };
  const proceedToPayment = async (skipFood = false) => {
    if (checkoutBusy) return;
    setCheckoutBusy(true);
    try {
      const activeHold = await ensureHold();
      let concessionSelection;
      let concessionQuote;
      if (!skipFood && foodItems.length) {
        concessionQuote = await quoteConcessions({
          holdId: activeHold.holdId,
          items: foodItems,
        });
        concessionSelection = {
          items: concessionQuote.items.map(
            ({ itemType, itemId, quantity }) => ({
              itemType,
              itemId,
              quantity,
            }),
          ),
          quoteReference: concessionQuote.quoteReference,
        };
      }
      const booking = await createPendingBooking({
        holdId: activeHold.holdId,
        requestKey: `counter-${activeHold.holdId}`,
        priceQuoteReference: activeHold.priceQuote?.quoteId,
        concessionSelection,
      });
      clearCounterOrderDraft(sessionStorage, account?.id);
      navigate("/staff/pos/payment", {
        state: {
          booking,
          film: selectedMovie,
          showtime: selectedShowtime,
          seats: selectedSeats,
          concessionQuote,
          total: booking.amount,
          selectionDeadline,
        },
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setCheckoutBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low p-4 shadow-lg">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Box office POS
          </p>
          <h1 className="font-heading text-2xl font-bold">Sell tickets</h1>
          <p className="mt-1 text-xs text-on-surface-variant">
            Live movie, showtime, availability and SeatHold data
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/staff/concessions"
            className="flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-bright"
          >
            <Popcorn className="size-4 text-secondary" /> Open F&amp;B menu
          </Link>
          <div className="flex items-center gap-2 text-sm text-tertiary">
            <Clock3 className="size-4 text-secondary" /> Staff counter
          </div>
        </div>
      </header>
      {draftDecisionPending && savedDraft && (
        <section className="flex flex-col gap-4 rounded-xl border border-secondary/25 bg-secondary/10 p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
              Unfinished counter order
            </p>
            <p className="mt-1 text-sm text-on-surface">
              {savedDraft.selectedIds.length} seat{savedDraft.selectedIds.length === 1 ? "" : "s"} selected
              {savedDraft.foodItems.length ? " with F&B add-ons" : ""}. Continue where you left off?
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={discardSavedOrder}
              className="flex items-center gap-2 rounded-lg bg-surface-container-high px-4 py-2.5 text-sm font-bold text-tertiary hover:text-white"
            >
              <Trash2 className="size-4" /> Discard
            </button>
            <button
              type="button"
              onClick={continueSavedOrder}
              className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-extrabold text-neutral-950"
            >
              <RotateCcw className="size-4" /> Continue order
            </button>
          </div>
        </section>
      )}
      <div className="grid gap-4 xl:grid-cols-12">
        <section className="space-y-3 xl:col-span-2">
          <div className="rounded-xl bg-surface-container-low p-4">
            <label className="relative block">
              <span className="sr-only">Search movie title</span>
              <Search className="absolute left-3 top-3 size-4 text-tertiary" />
              <input
                value={query}
                disabled={Boolean(hold)}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-lg bg-surface-container-high py-2.5 pl-9 pr-3 text-sm outline-none ring-primary focus:ring-2 disabled:opacity-50"
                placeholder="Search title..."
              />
            </label>
          </div>
          {movies.loading && (
            <div className="rounded-xl bg-surface-container-low p-6 text-center text-sm text-tertiary">
              <LoaderCircle className="mx-auto mb-2 size-5 animate-spin" />
              Loading movies…
            </div>
          )}
          {!movies.loading && movies.error && (
            <ErrorState message={movies.error} onRetry={movies.retry} />
          )}
          {!movies.loading && !movies.error && movies.movies.length === 0 && (
            <EmptyState
              title="No movies found"
              description="No published movie matches this search."
            />
          )}
          <div className="space-y-2">
            {movies.movies.map((movie) => (
              <button
                key={movie.id}
                type="button"
                disabled={Boolean(hold)}
                onClick={() => chooseMovie(movie.id)}
                className={`w-full rounded-xl border p-3 text-left transition disabled:opacity-60 ${movie.id === movieId ? "border-primary-container bg-surface-container shadow-crimson" : "border-transparent bg-surface-container-low hover:bg-surface-container"}`}
              >
                <div className="flex items-start gap-3">
                  {movie.posterUrl && (
                    <img
                      src={movie.posterUrl}
                      alt=""
                      className="h-16 w-11 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <strong className="line-clamp-2">{movie.title}</strong>
                    <p className="mt-1 text-xs text-tertiary">
                      {movie.genres?.join(", ") || "Movie"} · {movie.duration}{" "}
                      min
                    </p>
                    <p className="mt-2 text-xs font-bold text-secondary">
                      {movie.ageRating}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4 xl:col-span-7">
          <div className="rounded-xl bg-surface-container-low p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Showtime
                </p>
                <h2 className="font-heading text-xl font-bold">
                  {selectedMovie?.title ?? "Select a movie"}
                </h2>
              </div>
              <label className="text-xs text-on-surface-variant">
                Show date
                <input
                  type="date"
                  min={vietnamDateKey()}
                  value={date}
                  disabled={Boolean(hold)}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setShowtimeId("");
                    setSelectedIds([]);
                    setSelectionDeadline(null);
                  }}
                  className="ml-2 rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface disabled:opacity-50"
                />
              </label>
            </div>
            {movieId && schedule.loading && (
              <p className="mt-5 flex items-center gap-2 text-sm text-tertiary">
                <LoaderCircle className="size-4 animate-spin" />
                Loading showtimes…
              </p>
            )}
            {movieId && !schedule.loading && schedule.error && (
              <div className="mt-4">
                <ErrorState
                  message={schedule.error}
                  onRetry={() => setRefresh((value) => value + 1)}
                />
              </div>
            )}
            {movieId &&
              !schedule.loading &&
              !schedule.error &&
              showtimes.length === 0 && (
                <p className="mt-5 rounded-lg border border-dashed border-white/10 p-4 text-sm text-tertiary">
                  No published future showtimes for this movie and date.
                </p>
              )}
            <div className="mt-5 flex flex-wrap gap-2">
              {showtimes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={Boolean(hold)}
                  onClick={() => chooseShowtime(item.id)}
                  className={`rounded-lg px-4 py-2 text-left text-sm font-semibold disabled:opacity-60 ${showtimeId === item.id ? "bg-primary-container text-white shadow-crimson" : "bg-surface-container-high text-tertiary hover:text-on-surface"}`}
                >
                  <span className="block">
                    {timeFmt.format(new Date(item.startAt))}
                  </span>
                  <span className="mt-1 block text-[10px] font-normal">
                    {item.room.roomName} · {item.cinema.branchName}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {showtimeId && availability.isPending && (
            <div className="rounded-xl bg-surface-container-low p-10 text-center text-sm text-tertiary">
              <LoaderCircle className="mx-auto mb-3 size-7 animate-spin" />
              Loading live seat availability…
            </div>
          )}
          {showtimeId && availability.isError && (
            <ErrorState
              message={getApiErrorMessage(availability.error)}
              onRetry={availability.refetch}
            />
          )}
          {showtimeId && availability.isSuccess && seats.length === 0 && (
            <EmptyState
              title="No seats available"
              description="This showtime has no initialized seat layout."
            />
          )}
          {showtimeId && availability.isSuccess && seats.length > 0 && (
            <>
              <div className="rounded-xl bg-surface-container-low p-4">
                <SeatLegend
                  seatTypes={seatTypes}
                  selectedCount={selectedIds.length}
                />
              </div>
              <SeatMatrix
                rows={rows}
                selected={selectedIds}
                locked={Boolean(hold)}
                onToggle={toggleSeat}
              />
            </>
          )}
        </section>

        <aside className="xl:col-span-3">
          <div className="sticky top-20 rounded-xl bg-surface-container-low p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Counter order
                </p>
                <h2 className="mt-1 font-heading text-lg font-bold">
                  {selectedMovie?.title ?? "No movie selected"}
                </h2>
              </div>
            </div>
            {selectedShowtime && (
              <p className="mt-1 text-sm text-tertiary">
                {dateFmt.format(new Date(selectedShowtime.startAt))} ·{" "}
                {timeFmt.format(new Date(selectedShowtime.startAt))}
                <br />
                {selectedShowtime.room?.roomName} ·{" "}
                {selectedShowtime.cinema?.branchName}
              </p>
            )}
            <div className="my-5 space-y-2 border-y border-surface-container-high py-4">
              {selectedSeats.length ? (
                selectedSeats.map((seat) => (
                  <div
                    key={seat.seatId}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span>
                      {seat.type.replaceAll("_", " ")} · {seat.row}
                      {seat.number}
                    </span>
                    <span>{formatSeatMoney(seat.price)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-tertiary">
                  Select a movie, showtime and at least one available seat.
                </p>
              )}
            </div>
            <div className="flex justify-between font-heading text-xl font-bold">
              <span>Total</span>
              <span>{formatSeatMoney(total)}</span>
            </div>
            <p className="mt-1 text-right text-[10px] text-on-surface-variant">
              Final price is confirmed automatically when you continue.
            </p>
            {remainingSeconds !== null && (
              <p role="timer" className="mt-3 flex items-center justify-end gap-2 font-mono text-sm font-bold text-secondary">
                <Clock3 className="size-4" />
                {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")} remaining
              </p>
            )}
            <div className="mt-5 space-y-3">
              <button
                type="button"
                disabled={
                  !showtimeId ||
                  !selectedIds.length ||
                  selectedTotal === null ||
                  acquire.isPending ||
                  checkoutBusy
                }
                onClick={openFood}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 py-3 font-bold disabled:opacity-45"
              >
                <Popcorn className="size-5" />
                {acquire.isPending
                  ? "Preparing seats…"
                  : `Browse F&B${foodCount ? ` (${foodCount})` : ""}`}
              </button>
              <button
                type="button"
                disabled={
                  !showtimeId ||
                  !selectedIds.length ||
                  selectedTotal === null ||
                  acquire.isPending ||
                  checkoutBusy
                }
                onClick={() => proceedToPayment(foodItems.length === 0)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-3 font-bold text-white shadow-crimson disabled:opacity-45"
              >
                <Ticket className="size-5" />
                {checkoutBusy || acquire.isPending
                  ? "Preparing checkout…"
                  : foodItems.length
                    ? "Continue to payment"
                    : "Skip F&B & continue"}
              </button>
            </div>
            {showtimeId && !hold && (
              <button
                type="button"
                onClick={() => availability.refetch()}
                className="mt-3 flex w-full items-center justify-center gap-2 text-xs font-semibold text-tertiary hover:text-on-surface"
              >
                <RefreshCw className="size-3.5" />
                Refresh availability
              </button>
            )}
          </div>
        </aside>
      </div>
      {hold && foodOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="counter-food-title"
        >
          <section className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low shadow-2xl">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Optional add-on
                </p>
                <h2 id="counter-food-title" className="font-heading text-xl font-bold">
                  Add food &amp; drink
                </h2>
                <p className="mt-0.5 text-xs text-tertiary">
                  {foodContext?.branchName ?? "Loading this cinema's menu…"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {["items", "combos"].map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setFoodKind(kind)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${foodKind === kind ? "bg-primary-container text-white" : "bg-surface-container-high text-tertiary"}`}
                >
                  {kind === "items" ? "Items" : "Combos"}
                </button>
                ))}
                <button
                  type="button"
                  onClick={() => setFoodOpen(false)}
                  aria-label="Close food and drink menu"
                  className="grid size-9 place-items-center rounded-lg bg-surface-container-high text-tertiary hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {catalog.loading && (
                <p className="py-10 text-center text-sm text-tertiary">Loading F&amp;B…</p>
              )}
              {catalog.error && (
                <ErrorState
                  message={getApiErrorMessage(catalog.error)}
                  onRetry={() => setRefresh((value) => value + 1)}
                />
              )}
              {!catalog.loading && !catalog.error && availableFoodItems.length === 0 && (
                <EmptyState
                  title="No food available"
                  description="This cinema currently has no in-stock items in this category."
                />
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {availableFoodItems.map((item) => {
              const type = foodKind === "combos" ? "COMBO" : "CONCESSION";
              const quantity =
                foodItems.find(
                  (line) => line.itemType === type && line.itemId === item.id,
                )?.quantity ?? 0;
              return (
                <article
                  key={item.id}
                  className="flex min-h-32 overflow-hidden rounded-xl border border-white/5 bg-surface-container-lowest"
                >
                  <div className="w-32 shrink-0 [&>div]:h-full [&>div]:aspect-auto">
                    <CatalogImage item={item} combo={foodKind === "combos"} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                    <div className="flex flex-wrap gap-2">
                      <CatalogBadges item={item} />
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-bold">{item.name}</h3>
                    <p className="mt-1 text-sm text-secondary">
                      {formatSeatMoney(item.price)}
                    </p>
                    <div className="mt-2 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        disabled={!quantity}
                        onClick={() => changeFood(item, -1)}
                        className="grid size-8 place-items-center rounded-lg bg-surface-container-high disabled:opacity-40"
                      >
                        <Minus className="size-4" />
                      </button>
                      <strong>{quantity}</strong>
                      <button
                        type="button"
                        disabled={!item.available}
                        onClick={() => changeFood(item, 1)}
                        className="grid size-8 place-items-center rounded-lg bg-primary-container text-white disabled:opacity-40"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
                })}
              </div>
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-surface-container-lowest px-5 py-4">
              <p className="text-sm text-tertiary">
                <strong className="text-on-surface">{foodCount}</strong> item{foodCount === 1 ? "" : "s"} selected
              </p>
              <button
                type="button"
                onClick={() => setFoodOpen(false)}
                className="rounded-xl bg-primary-container px-6 py-2.5 text-sm font-bold text-white shadow-crimson"
              >
                Add to order
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

export default CounterPosPage;
