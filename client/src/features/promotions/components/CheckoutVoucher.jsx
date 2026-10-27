import { useState } from "react";
import { TicketPercent } from "lucide-react";
import { buttonClass, inputClass, ErrorNotice } from "./PromotionUi";

export default function CheckoutVoucher({ booking, busy, disabled, onChange }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const locked = booking?.pricingLocked;
  const change = async (value) => {
    setError(null);
    setNotice("");
    try {
      await onChange(value);
      setNotice(
        value === null
          ? "Voucher removed."
          : "Voucher applied. The server has reserved your discount until the seat-hold deadline.",
      );
    } catch (e) {
      setError(e);
    }
  };
  return (
    <section className="my-5 space-y-4 rounded-2xl border border-primary/20 bg-surface-container-low p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        <TicketPercent className="text-primary" />
        Promo code
      </h2>
      <p className="text-sm text-on-surface-variant">
        Save up to 20% on tickets. Food and combos are unchanged. One code per
        booking.
      </p>
      <form
        className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          change(code.trim().toUpperCase());
        }}
      >
        <label className="min-w-0 flex-1 text-sm">
          Voucher code
          <input
            required
            minLength={3}
            maxLength={40}
            pattern="[A-Za-z0-9_-]{3,40}"
            disabled={busy || disabled || locked}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} mt-1 font-mono uppercase`}
            placeholder="Enter your code"
            autoComplete="off"
          />
        </label>
        <button className={buttonClass} disabled={busy || disabled || locked}>
          {busy
            ? "Processing…"
            : booking?.voucher
              ? "Replace code"
              : "Apply code"}
        </button>
      </form>
      {booking?.voucher && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-300">
          <span>
            <strong className="font-mono">{booking.voucher.code}</strong> ·{" "}
            {booking.voucher.discountValue}% off tickets ·{" "}
            {booking.voucher.status}
          </span>
          <button
            type="button"
            disabled={busy || disabled || locked}
            className="underline disabled:opacity-40"
            onClick={() => change(null)}
          >
            Remove code
          </button>
        </div>
      )}
      {locked && (
        <p className="text-sm text-secondary">
          Your amount and voucher are locked because payment has started.
          Payment retries keep the same discount until checkout expires.
        </p>
      )}
      <ErrorNotice error={error} />
      <p role="status" className="text-sm text-emerald-300">
        {notice}
      </p>
    </section>
  );
}
