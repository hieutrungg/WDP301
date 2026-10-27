import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Plus, TicketPercent } from "lucide-react";
import { useAuth } from "../../auth/hooks/useAuth";
import { listPromotions, savePromotion } from "../api/promotionApi";
import {
  buttonClass,
  inputClass,
  panelClass,
  ErrorNotice,
  StatusBadge,
  Pagination,
} from "../components/PromotionUi";
import { dateLabel } from "../utils/promotionForm";

export default function PromotionsPage() {
  const { account } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ page: 1, q: "", status: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["promotions", account.id, filter],
    retry: false,
    queryFn: () =>
      listPromotions({
        page: filter.page,
        limit: 20,
        ...(filter.q ? { q: filter.q } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      }),
  });
  const toggle = async (p) => {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      await savePromotion(p.id, {
        expectedVersion: p.version,
        status: p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      setNotice(
        "Promotion status updated. Existing reservations keep their discount.",
      );
      await query.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
            Commercial operations
          </p>
          <h1 className="flex items-center gap-3 font-heading text-3xl font-extrabold">
            <TicketPercent className="text-primary" />
            Promotion Management
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Manage ticket discounts and voucher codes across all F-Cinema
            locations.
          </p>
        </div>
        <Link className={buttonClass} to="/manager/promotions/new">
          <Plus className="size-4" />
          Create Promotion
        </Link>
      </header>
      <div className="rounded-xl border border-secondary/20 bg-secondary/5 p-4 text-sm text-on-surface-variant">
        Percentage discounts up to 20% · Tickets only · One code per booking ·
        One successful use per customer/code
      </div>
      <section className={panelClass}>
        <form
          className="mb-5 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter({ ...filter, page: 1, q: search });
          }}
        >
          <label className="min-w-0 flex-1 text-sm">
            Search promotion name
            <input
              className={`${inputClass} mt-1`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={150}
              placeholder="Search campaigns"
            />
          </label>
          <label className="text-sm">
            Status
            <select
              className={`${inputClass} mt-1`}
              value={filter.status}
              onChange={(e) =>
                setFilter({ ...filter, page: 1, status: e.target.value })
              }
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Enabled</option>
              <option value="INACTIVE">Disabled</option>
            </select>
          </label>
          <button className={buttonClass}>Search</button>
        </form>
        <ErrorNotice
          error={error ?? query.error}
          retry={() => query.refetch()}
        />
        <p role="status" className="my-3 text-sm text-emerald-400">
          {notice}
        </p>
        {query.isFetching && (
          <p role="status" className="py-6 text-on-surface-variant">
            Loading promotions…
          </p>
        )}
        {!query.isFetching && query.data?.data.items.length === 0 && (
          <div className="py-12 text-center">
            <TicketPercent className="mx-auto mb-3 size-10 text-primary" />
            <h2 className="font-bold">No promotions found</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Create a promotion or try another search.
            </p>
          </div>
        )}
        <div className="grid gap-4">
          {query.data?.data.items.map((p) => (
            <article
              key={p.id}
              className="grid items-center gap-4 rounded-xl border border-white/10 bg-background/40 p-4 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]"
            >
              <div className="min-w-0">
                <h2 className="break-words font-heading font-bold">{p.name}</h2>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {dateLabel(p.startDate)} – {dateLabel(p.endDate)} · Vietnam
                  time
                </p>
              </div>
              <div>
                <strong className="font-heading text-xl text-secondary">
                  {p.discountValue}% OFF
                </strong>
                <p className="text-xs text-on-surface-variant">
                  All tickets · All cinemas
                </p>
              </div>
              <div>
                <StatusBadge>{p.displayStatus}</StatusBadge>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link
                  className="font-bold text-primary underline"
                  to={`/manager/promotions/${p.id}/edit`}
                >
                  Edit / Codes
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  className="underline disabled:opacity-40"
                  onClick={() => toggle(p)}
                >
                  {p.status === "ACTIVE" ? "Disable" : "Enable"}
                </button>
              </div>
            </article>
          ))}
        </div>
        <Pagination
          page={filter.page}
          meta={query.data?.meta}
          onPage={(page) => setFilter({ ...filter, page })}
        />
      </section>
    </div>
  );
}
