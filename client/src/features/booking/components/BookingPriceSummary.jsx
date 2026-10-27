import { formatSeatMoney } from "../../seat-selection/utils/seatPricing";

export default function BookingPriceSummary({ booking }) {
  if (!booking?.voucher) return null;
  return (
    <section
      aria-label="Recorded price breakdown"
      className="my-4 space-y-2 rounded-xl border border-white/10 bg-surface-container-low p-4 text-sm"
    >
      <h2 className="font-bold">Recorded payment breakdown</h2>
      <div className="flex justify-between gap-3">
        <span>Tickets subtotal</span>
        <span>{formatSeatMoney(booking.ticketAmount ?? booking.subtotal)}</span>
      </div>
      <div className="flex flex-wrap justify-between gap-3 text-emerald-400">
        <span>
          Voucher {booking.voucher.code} ({booking.voucher.discountValue}%)
        </span>
        <span>−{formatSeatMoney(booking.discountAmount)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span>Food &amp; combos</span>
        <span>{formatSeatMoney(booking.concessionAmount ?? 0)}</span>
      </div>
      <div className="flex justify-between gap-3 border-t border-white/10 pt-2 font-bold text-secondary">
        <span>Total</span>
        <span>{formatSeatMoney(booking.totalAmount ?? booking.amount)}</span>
      </div>
    </section>
  );
}
