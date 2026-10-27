import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth";
import {
  getPromotion,
  savePromotion,
  listVouchers,
  createVoucher,
  updateVoucher,
} from "../api/promotionApi";
import { toVietnamInput, fromVietnamInput } from "../utils/promotionForm";
import {
  inputClass,
  buttonClass,
  panelClass,
  ErrorNotice,
  StatusBadge,
  Pagination,
} from "../components/PromotionUi";

function VoucherRow({ voucher, onSaved }) {
  const [limit, setLimit] = useState(voucher.usageLimit ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async (changes) => {
    setBusy(true);
    setError(null);
    try {
      await updateVoucher(voucher.id, {
        expectedVersion: voucher.version,
        ...changes,
      });
      await onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="space-y-3 rounded-xl border border-white/10 bg-background/40 p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <strong className="break-all font-mono text-secondary">
          {voucher.code}
        </strong>
        <StatusBadge>{voucher.status}</StatusBadge>
      </div>
      <p className="text-xs text-on-surface-variant">
        Used: {voucher.usedCount} · Reserved: {voucher.reservedCount} ·
        Remaining: {voucher.remainingUses ?? "Unlimited"}
      </p>
      <form
        className="grid grid-cols-2 items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save({ usageLimit: limit === "" ? null : Number(limit) });
        }}
      >
        <label className="col-span-2 min-w-0 text-sm">
          Total uses (blank = unlimited)
          <input
            type="number"
            min="1"
            step="1"
            className={`${inputClass} mt-1`}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </label>
        <button className={buttonClass} disabled={busy}>
          Save limit
        </button>
        <button
          className="py-2 text-sm underline disabled:opacity-50"
          type="button"
          disabled={busy}
          onClick={() =>
            save({
              status: voucher.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
            })
          }
        >
          {voucher.status === "ACTIVE" ? "Disable code" : "Enable code"}
        </button>
      </form>
      <ErrorNotice error={error} />
    </article>
  );
}
function VoucherManager({ promotionId }) {
  const { account } = useAuth();
  const [page, setPage] = useState(1);
  const [code, setCode] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["promotion-vouchers", account.id, promotionId, page],
    retry: false,
    queryFn: () => listVouchers(promotionId, { page, limit: 10 }),
  });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      await createVoucher(promotionId, {
        code,
        usageLimit: limit === "" ? null : Number(limit),
        status: "ACTIVE",
      });
      setCode("");
      setLimit("");
      setNotice("Voucher created.");
      await query.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`${panelClass} space-y-4`}>
      <h2 className="font-heading text-xl font-bold">Voucher codes</h2>
      <p className="text-sm text-on-surface-variant">
        Codes inherit this campaign’s dates. Each customer can use each code
        successfully once. Code strings cannot be renamed.
      </p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          New voucher code
          <input
            required
            minLength={3}
            maxLength={40}
            pattern="[A-Za-z0-9_-]{3,40}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} mt-1 font-mono uppercase`}
            placeholder="SUMMER10"
          />
        </label>
        <label className="text-sm">
          Total uses (blank = unlimited)
          <input
            type="number"
            min="1"
            step="1"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <button className={`${buttonClass} sm:col-span-2`} disabled={busy}>
          {busy ? "Creating…" : "Create voucher code"}
        </button>
      </form>
      <ErrorNotice error={error ?? query.error} retry={() => query.refetch()} />
      <p role="status" className="text-sm text-emerald-400">
        {notice}
      </p>
      {query.isFetching && <p role="status">Loading codes…</p>}
      {query.data?.data.items.length === 0 && (
        <p className="py-4 text-sm text-on-surface-variant">
          No codes yet. Create a code to let customers use this promotion.
        </p>
      )}
      {query.data?.data.items.map((v) => (
        <VoucherRow
          key={`${v.id}:${v.version}`}
          voucher={v}
          onSaved={() => {
            setNotice("Voucher updated.");
            return query.refetch();
          }}
        />
      ))}
      <Pagination page={page} meta={query.data?.meta} onPage={setPage} />
    </section>
  );
}
function PromotionForm({ promotion, refresh }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: promotion?.name ?? "",
    discountValue: promotion?.discountValue ?? "",
    startDate: toVietnamInput(promotion?.startDate),
    endDate: toVietnamInput(promotion?.endDate),
    status: promotion?.status ?? "ACTIVE",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const set = (field) => (e) => {
    const value = e.target.value;
    setValues((previous) => ({ ...previous, [field]: value }));
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const result = await savePromotion(promotion?.id, {
        ...values,
        discountValue: Number(values.discountValue),
        startDate: fromVietnamInput(values.startDate),
        endDate: fromVietnamInput(values.endDate),
        ...(promotion ? { expectedVersion: promotion.version } : {}),
      });
      if (!promotion)
        navigate(`/manager/promotions/${result.id}/edit`, { replace: true });
      else {
        setNotice(
          "Promotion saved. Existing reservations keep their original discount.",
        );
        await refresh();
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section className={panelClass}>
        <form onSubmit={submit} className="space-y-5">
          <h2 className="font-heading text-xl font-bold">
            Campaign configuration
          </h2>
          <label className="block text-sm">
            Promotion name
            <input
              required
              maxLength={150}
              className={`${inputClass} mt-1`}
              value={values.name}
              onChange={set("name")}
            />
          </label>
          <label className="block text-sm">
            Ticket discount (%)
            <input
              required
              type="number"
              min="0.01"
              max="20"
              step="0.01"
              className={`${inputClass} mt-1`}
              value={values.discountValue}
              onChange={set("discountValue")}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Start · Vietnam time
              <input
                required
                type="datetime-local"
                value={values.startDate}
                onChange={set("startDate")}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm">
              End · Vietnam time
              <input
                required
                type="datetime-local"
                min={values.startDate}
                value={values.endDate}
                onChange={set("endDate")}
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>
          <label className="block text-sm">
            Status
            <select
              className={`${inputClass} mt-1`}
              value={values.status}
              onChange={set("status")}
            >
              <option value="ACTIVE">Enabled</option>
              <option value="INACTIVE">Disabled</option>
            </select>
          </label>
          <ErrorNotice error={error} />
          <p role="status" className="text-sm text-emerald-400">
            {notice}
          </p>
          <div className="flex flex-wrap gap-4">
            <button disabled={busy} className={buttonClass}>
              {busy
                ? "Saving…"
                : promotion
                  ? "Save changes"
                  : "Create promotion"}
            </button>
            <Link
              className="px-4 py-2.5 text-sm underline"
              to="/manager/promotions"
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>
      <div className="space-y-5">
        <aside className={`${panelClass} space-y-3 border-primary/25`}>
          <p className="text-xs uppercase tracking-widest text-primary">
            Promotion scope
          </p>
          <h2 className="font-heading text-2xl font-bold">
            {values.name || "Your campaign"}
          </h2>
          <p className="font-heading text-4xl font-black text-secondary">
            {values.discountValue || "0"}% OFF
          </p>
          <p className="text-sm text-on-surface-variant">
            Tickets at all F-Cinema locations. Food and combos keep their
            original price. One code per booking, one successful use per
            customer/code.
          </p>
          <p className="text-xs text-on-surface-variant">
            Changes apply to new reservations. Disabling a campaign does not
            revoke an existing reservation before its seat-hold deadline.
          </p>
        </aside>
        {promotion ? (
          <VoucherManager promotionId={promotion.id} />
        ) : (
          <p className="p-4 text-sm text-on-surface-variant">
            Save the campaign first, then create its voucher codes here.
          </p>
        )}
      </div>
    </div>
  );
}
export default function PromotionFormPage() {
  const { promotionId } = useParams();
  const { account } = useAuth();
  const query = useQuery({
    queryKey: ["promotion", account.id, promotionId],
    enabled: Boolean(promotionId),
    retry: false,
    queryFn: () => getPromotion(promotionId),
  });
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Link to="/manager/promotions" className="text-sm text-primary underline">
        ← Promotion Management
      </Link>
      <header>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
          Commercial operations
        </p>
        <h1 className="font-heading text-3xl font-extrabold">
          {promotionId ? "Edit Promotion" : "Create Promotion"}
        </h1>
      </header>
      <ErrorNotice error={query.error} retry={() => query.refetch()} />
      {promotionId && query.isPending ? (
        <p role="status">Loading promotion…</p>
      ) : (
        (!promotionId || query.data) && (
          <PromotionForm
            key={promotionId ?? "new"}
            promotion={query.data}
            refresh={() => query.refetch()}
          />
        )
      )}
    </div>
  );
}
