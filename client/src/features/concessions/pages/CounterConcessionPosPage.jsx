import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  LoaderCircle,
  Minus,
  Plus,
  Popcorn,
  Printer,
  QrCode,
  ReceiptText,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { MockQrSvg } from "../../booking/components/MockPaymentModal";
import QrCodeImage from "../../../components/ui/QrCode";
import { isBankTransferAttempt } from "../../booking/utils/mockQrCode";
import {
  createCounterConcessionOrder,
  confirmCounterConcessionQr,
  simulateCounterConcessionPayment,
  getCatalogBranches,
  getCatalogCategories,
  getCatalogPage,
} from "../api/concessionApi";
import { useAuth } from "../../auth/hooks/useAuth";

const money = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value || 0,
  );
const keyOf = (item) => `${item.itemType}:${item.itemId}`;

export default function CounterConcessionPosPage() {
  const { account } = useAuth();
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branchId, setBranchId] = useState(
    account?.employeeProfile?.branchId || "",
  );
  const [categoryId, setCategoryId] = useState("ALL");
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("CASH");
  const [cash, setCash] = useState("");
  const [checkout, setCheckout] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getCatalogBranches(controller.signal)
      .then((branchRows) => {
        setBranches(branchRows);
        setBranchId((current) => current || branchRows[0]?.id || "");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          toast.error("Unable to load cinema branches");
      });
    getCatalogCategories(controller.signal)
      .then(setCategories)
      .catch(() => {
        if (!controller.signal.aborted)
          toast.error("Unable to load concession categories");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!branchId) return undefined;
    const controller = new AbortController();
    Promise.all([
      getCatalogPage(
        { kind: "items", branchId, page: 1, limit: 100 },
        controller.signal,
      ),
      getCatalogPage(
        { kind: "combos", branchId, page: 1, limit: 100 },
        controller.signal,
      ),
    ])
      .then(([items, combos]) => {
        setProducts([
          ...items.items.map((item) => ({
            ...item,
            itemType: "CONCESSION",
            itemId: item.id,
          })),
          ...combos.items.map((item) => ({
            ...item,
            itemType: "COMBO",
            itemId: item.id,
            category: null,
          })),
        ]);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          toast.error("Unable to load the concession menu");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [branchId]);

  const total = lines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );
  const cashValue = Number(cash || 0);
  const visible = useMemo(
    () =>
      products.filter((item) => {
        const categoryMatch =
          categoryId === "ALL" ||
          (categoryId === "COMBO"
            ? item.itemType === "COMBO"
            : item.category?.id === categoryId);
        return (
          categoryMatch &&
          item.name?.toLowerCase().includes(query.trim().toLowerCase())
        );
      }),
    [products, categoryId, query],
  );

  const add = (product) => {
    if (!product.available) return;
    setLines((current) => {
      const key = keyOf(product);
      const found = current.find((line) => keyOf(line) === key);
      return found
        ? current.map((line) =>
            keyOf(line) === key
              ? { ...line, quantity: Math.min(100, line.quantity + 1) }
              : line,
          )
        : [...current, { ...product, quantity: 1 }];
    });
  };
  const quantity = (key, delta) =>
    setLines((current) =>
      current
        .map((line) =>
          keyOf(line) === key
            ? { ...line, quantity: line.quantity + delta }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  const changeBranch = (next) => {
    if (
      lines.length &&
      !window.confirm(
        "Changing the cinema will clear the current sale. Continue?",
      )
    )
      return;
    setLines([]);
    setCheckout(null);
    setLoading(true);
    setBranchId(next);
  };
  const submit = async () => {
    if (!lines.length || (method === "CASH" && cashValue < total)) return;
    setBusy(true);
    try {
      const result = await createCounterConcessionOrder({
        branchId,
        items: lines.map(({ itemType, itemId, quantity: amount }) => ({
          itemType,
          itemId,
          quantity: amount,
        })),
        method,
        idempotencyKey: `counter-fnb-${crypto.randomUUID()}`,
        ...(method === "CASH" ? { tenderedAmount: cashValue } : {}),
      });
      setCheckout(result);
      if (method === "CASH") toast.success("Cash payment recorded");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to create the F&B order",
      );
    } finally {
      setBusy(false);
    }
  };
  const confirmQr = async () => {
    setBusy(true);
    try {
      const result = await confirmCounterConcessionQr(checkout.order.orderId);
      setCheckout(result);
      toast.success("QR payment confirmed");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to confirm QR payment",
      );
    } finally {
      setBusy(false);
    }
  };
  const simulatePayment = async () => {
    setBusy(true);
    try {
      const result = await simulateCounterConcessionPayment(
        checkout.order.orderId,
      );
      setCheckout(result);
      toast.success("Demo payment confirmed");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to simulate payment",
      );
    } finally {
      setBusy(false);
    }
  };
  const paid = checkout?.payment?.status === "PAID";
  const branch = branches.find((item) => item.id === branchId);

  return (
    <div className="counter-fnb-pos grid min-h-[calc(100vh-7.5rem)] gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <section className="min-w-0 rounded-2xl bg-surface-container-low p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Counter F&amp;B POS
            </p>
            <h1 className="font-heading text-2xl font-bold">
              Sell Concessions
            </h1>
          </div>
          <label className="grid gap-1 text-xs text-tertiary">
            Cinema
            <select
              value={branchId}
              onChange={(event) => changeBranch(event.target.value)}
              className="min-w-60 rounded-lg bg-surface-container-high px-3 py-2 text-sm font-semibold text-on-surface outline-none"
            >
              {branches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.branchName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {[
            { id: "ALL", name: "All" },
            ...categories,
            { id: "COMBO", name: "Combos" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategoryId(item.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${categoryId === item.id ? "bg-primary-container text-white" : "bg-surface-container-high text-tertiary"}`}
            >
              {item.name}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-xl bg-surface-container-high px-3 py-2">
          <Search className="size-4 text-tertiary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search items or combos…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        {loading ? (
          <div className="grid min-h-80 place-items-center">
            <LoaderCircle className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
            {visible.map((item) => (
              <button
                key={keyOf(item)}
                type="button"
                disabled={!item.available || paid}
                onClick={() => add(item)}
                className="group overflow-hidden rounded-xl bg-surface-container-high text-left transition hover:-translate-y-0.5 hover:ring-2 hover:ring-primary disabled:opacity-40"
              >
                <div className="grid aspect-[4/3] place-items-center bg-surface-container-highest">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Popcorn className="size-10 text-secondary" />
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 min-h-10 text-sm font-bold">
                    {item.name}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-secondary">
                      {money(item.price)}
                    </span>
                    <Plus className="size-4 text-primary" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="flex self-start flex-col rounded-2xl bg-surface-container-low p-5 xl:sticky xl:top-20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Current sale
            </p>
            <h2 className="font-heading text-xl font-bold">Current Order</h2>
          </div>
          {lines.length > 0 && !checkout && (
            <button
              onClick={() => setLines([])}
              className="text-xs font-semibold text-error"
            >
              Clear All
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-tertiary">
          {branch?.branchName || "Select a cinema"}
        </p>
        <div
          className={`mt-4 space-y-2 overflow-y-auto border-y border-white/10 py-4 ${lines.length ? "max-h-[min(42vh,28rem)]" : "grid min-h-52 place-items-center"}`}
        >
          {!lines.length ? (
            <div className="text-center text-sm text-tertiary">
              <ReceiptText className="mx-auto mb-3 size-8" />
              Select a product to add it to the order
            </div>
          ) : (
            lines.map((line) => (
              <div
                key={keyOf(line)}
                className="rounded-xl bg-surface-container-high p-3"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{line.name}</p>
                    <p className="text-xs text-tertiary">
                      {money(line.price)} / item
                    </p>
                  </div>
                  <strong className="text-sm">
                    {money(line.price * line.quantity)}
                  </strong>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    disabled={!!checkout}
                    onClick={() => quantity(keyOf(line), -1)}
                    className="grid size-7 place-items-center rounded bg-surface-container-highest"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold">
                    {line.quantity}
                  </span>
                  <button
                    disabled={!!checkout}
                    onClick={() => quantity(keyOf(line), 1)}
                    className="grid size-7 place-items-center rounded bg-surface-container-highest"
                  >
                    <Plus className="size-3" />
                  </button>
                  <button
                    disabled={!!checkout}
                    onClick={() =>
                      setLines((rows) =>
                        rows.filter((row) => keyOf(row) !== keyOf(line)),
                      )
                    }
                    className="ml-2 text-error"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex items-center justify-between font-heading text-xl font-bold">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
        {!checkout && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setMethod("CASH")}
                className={`rounded-xl p-3 text-sm font-semibold ${method === "CASH" ? "bg-primary-container text-white" : "bg-surface-container-high"}`}
              >
                <Banknote className="mx-auto mb-1 size-5" />
                Cash
              </button>
              <button
                onClick={() => setMethod("BANK_TRANSFER")}
                className={`rounded-xl p-3 text-sm font-semibold ${method === "BANK_TRANSFER" ? "bg-primary-container text-white" : "bg-surface-container-high"}`}
              >
                <QrCode className="mx-auto mb-1 size-5" />
                VietQR
              </button>
            </div>
            {method === "CASH" && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-tertiary">
                  Cash Received
                </label>
                <input
                  value={
                    cash ? new Intl.NumberFormat("vi-VN").format(cashValue) : ""
                  }
                  onChange={(event) =>
                    setCash(event.target.value.replace(/\D/g, ""))
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl bg-surface-container-high px-4 py-3 text-lg font-bold outline-none"
                  placeholder="0"
                />
                <p className="mt-2 text-xs text-tertiary">
                  The system only verifies that the amount is sufficient. Change
                  is handled outside the system.
                </p>
              </div>
            )}
            <button
              disabled={
                busy ||
                !lines.length ||
                (method === "CASH" && cashValue < total)
              }
              onClick={submit}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container py-3.5 font-bold text-white disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <ReceiptText className="size-5" />
              )}
              Create Order &amp; Pay
            </button>
          </>
        )}
        {checkout && !paid && (
          <div className="mt-4 text-center">
            {isBankTransferAttempt(checkout.payment.activeAttempt) ? (
              <QrCodeImage
                value={checkout.payment.activeAttempt.qrPayload}
                size={180}
                label="VietQR"
                ariaLabel="Counter concession VietQR payment"
              />
            ) : (
              <MockQrSvg
                payload={checkout.payment.activeAttempt.qrPayload}
                size={150}
                badgeLabel="DEMO"
              />
            )}
            <p className="mt-2 text-xs text-tertiary">
              Payment is verified with payOS before this order is completed.
            </p>
            <button
              disabled={busy}
              onClick={confirmQr}
              className="mt-4 w-full rounded-xl bg-primary-container py-3 font-bold text-white"
            >
              {busy ? "Checking…" : "Check Bank Transfer"}
            </button>
            <button
              disabled={busy}
              onClick={simulatePayment}
              className="mt-2 w-full rounded-xl border border-white/15 py-3 text-xs font-bold text-tertiary hover:text-on-surface disabled:opacity-50"
            >
              Simulate successful payment (demo)
            </button>
          </div>
        )}
        {paid && (
          <div className="counter-fnb-receipt mt-4 rounded-xl bg-secondary-container/15 p-4">
            <p className="font-bold text-secondary">Payment Successful</p>
            <p className="mt-1 font-mono text-xs">{checkout.order.orderCode}</p>
            <button
              onClick={() => window.print()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 font-bold text-black"
            >
              <Printer className="size-4" />
              Print Receipt
            </button>
            <button
              onClick={() => {
                setLines([]);
                setCheckout(null);
                setCash("");
              }}
              className="mt-2 w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm font-semibold"
            >
              New Order
            </button>
          </div>
        )}
      </aside>
      {paid && (
        <section
          id="counter-concession-receipt"
          aria-label="Concession sale receipt"
        >
          <header className="receipt-header">
            <p className="receipt-brand">F-CINEMA</p>
            <p className="receipt-title">F&amp;B SALES RECEIPT</p>
            <p className="receipt-subtitle">Premium Cinema Experience</p>
          </header>
          <div className="receipt-details">
            <div>
              <span>Order</span>
              <strong>{checkout.order.orderCode}</strong>
            </div>
            <div>
              <span>Cinema</span>
              <strong>{branch?.branchName}</strong>
            </div>
            <div>
              <span>Payment</span>
              <strong>
                {checkout.payment.method === "CASH" ? "Cash" : "Bank transfer"}
              </strong>
            </div>
            <div>
              <span>Time</span>
              <strong>
                {new Date(checkout.payment.paidAt).toLocaleString("en-GB")}
              </strong>
            </div>
          </div>
          <div className="receipt-items">
            <div className="receipt-table-heading">
              <span>Item</span>
              <span>Amount</span>
            </div>
            {checkout.order.items.map((item) => (
              <div
                className="receipt-item"
                key={`${item.itemType}:${item.itemId}`}
              >
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.quantity} × {money(item.unitPrice)}
                  </p>
                </div>
                <strong>{money(item.subtotal)}</strong>
              </div>
            ))}
          </div>
          <div className="receipt-total">
            <span>Total</span>
            <strong>{money(checkout.order.totalAmount)}</strong>
          </div>
          <footer className="receipt-footer">
            <p>Thank you for visiting F-Cinema!</p>
            <p>Please keep this receipt for your reference.</p>
          </footer>
        </section>
      )}
    </div>
  );
}
