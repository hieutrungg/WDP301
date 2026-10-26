import { formatSeatMoney } from "../../seat-selection/utils/seatPricing";

export default function ConcessionOrderSummary({ order, paid = false }) {
  if (!order) return null;
  const ready =
    paid && order.status === "CONFIRMED" && order.paymentStatus === "PAID";
  return (
    <section
      aria-label="Food order"
      className="my-5 rounded-xl border border-white/10 bg-surface-container-low p-5 text-sm"
    >
      <h2 className="mb-3 font-heading text-lg font-bold text-white">
        Food &amp; Drink
      </h2>
      <ul className="space-y-2">
        {order.items.map((line) => (
          <li
            key={`${line.itemType}:${line.itemId}`}
            className="flex justify-between gap-3"
          >
            <span>
              {line.name}
              {line.size ? ` · ${line.size}` : ""} × {line.quantity}
            </span>
            <strong>{formatSeatMoney(line.subtotal)}</strong>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-bold text-secondary">
        Food subtotal: {formatSeatMoney(order.totalAmount)}
      </p>
      {ready ? (
        <div className="mt-4">
          <p className="text-xs text-on-surface-variant">
            Show this code at your screening cinema's concession counter.
          </p>
          <p className="mt-2 break-all font-mono font-bold text-secondary">
            {order.orderCode}
          </p>
          <p className="mt-2 text-xs">Awaiting pickup</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-on-surface-variant">
          {order.status === "EXPIRED"
            ? "Food reservation expired. No pickup is available."
            : "Pickup information becomes available after payment confirmation."}
        </p>
      )}
    </section>
  );
}
