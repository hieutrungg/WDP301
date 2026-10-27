import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  Banknote,
  Landmark,
  LoaderCircle,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import {
  confirmCounterCash,
  initiatePayment,
  simulatePaymentAttempt,
  verifyPaymentAttempt,
} from "../../booking/api/paymentApi";
import { MockQrSvg } from "../../booking/components/MockPaymentModal";
import { isBankTransferAttempt } from "../../booking/utils/mockQrCode";
import QrCodeImage from "../../../components/ui/QrCode";
import { getApiErrorMessage } from "../../../lib/api/apiError";

const formatVnd = (amount) =>
  new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
const PROVIDER_POLL_MS = 4000;

function CounterPaymentPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [method, setMethod] = useState("CASH");
  const [tendered, setTendered] = useState("");
  const [attempt, setAttempt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const total = state?.booking?.amount ?? state?.total ?? 0;
  const tenderedValue = Number(tendered.replaceAll(".", "")) || 0;
  const activeAttempt = attempt?.activeAttempt;
  const realBankTransfer = isBankTransferAttempt(activeAttempt);
  const canConfirm =
    method === "CASH" ? tenderedValue >= total : Boolean(activeAttempt);
  const paymentMethods = [
    { id: "CASH", label: "Cash", icon: Banknote },
    { id: "BANK_TRANSFER", label: "Bank transfer", icon: Landmark },
  ];
  const presets = useMemo(
    () => [total, Math.ceil(total / 50000) * 50000, 500000],
    [total],
  );
  const setAmount = (amount) => setTendered(String(amount));
  const finishWhenPaid = (result, selectedMethod = method) => {
    if (result?.payment?.status !== "PAID") return false;
    navigate("/staff/pos/complete", {
      replace: true,
      state: { ...state, method: selectedMethod, settlement: result },
    });
    return true;
  };
  const verifyProvider = async ({ silent = false } = {}) => {
    if (!realBankTransfer || !attempt?.payment?.paymentId || !activeAttempt)
      return;
    if (!silent) setVerifying(true);
    try {
      const result = await verifyPaymentAttempt({
        paymentId: attempt.payment.paymentId,
        attemptId: activeAttempt.attemptId,
      });
      setAttempt(result);
      if (!finishWhenPaid(result, "BANK_TRANSFER") && !silent)
        toast.info(
          "The transfer is still pending. Please check again shortly.",
        );
    } catch (error) {
      if (!silent) toast.error(getApiErrorMessage(error));
    } finally {
      if (!silent) setVerifying(false);
    }
  };
  useEffect(() => {
    if (!realBankTransfer || activeAttempt?.status !== "PENDING")
      return undefined;
    const timer = window.setInterval(
      () => verifyProvider({ silent: true }),
      PROVIDER_POLL_MS,
    );
    return () => window.clearInterval(timer);
    // Active attempt identity controls the polling lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realBankTransfer, activeAttempt?.attemptId, activeAttempt?.status]);
  if (!state?.booking?.bookingId || !state?.film || !state?.seats?.length)
    return <Navigate to="/staff/pos" replace />;
  const chooseMethod = async (id) => {
    setMethod(id);
    if (id === "CASH") {
      setAttempt(null);
      return;
    }
    if (activeAttempt?.method === id) return;
    setBusy(true);
    try {
      setAttempt(
        await initiatePayment({
          bookingId: state.booking.bookingId,
          method: id,
          amount: total,
          idempotencyKey: `counter-bank:${state.booking.bookingId}:${crypto.randomUUID()}`,
        }),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const confirmPayment = async () => {
    if (method === "BANK_TRANSFER") {
      if (realBankTransfer) await verifyProvider();
      else if (activeAttempt) await simulateSuccess();
      return;
    }
    setBusy(true);
    try {
      let current = attempt;
      if (method === "CASH" && !current) {
        current = await initiatePayment({
          bookingId: state.booking.bookingId,
          method,
          amount: total,
          idempotencyKey: `counter-cash:${state.booking.bookingId}`,
        });
        setAttempt(current);
      }
      const result = await confirmCounterCash({
        paymentId: current.payment.paymentId,
        attemptId: current.activeAttempt.attemptId,
        tenderedAmount: tenderedValue,
      });
      finishWhenPaid(result, "CASH");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const simulateSuccess = async () => {
    if (!attempt?.payment?.paymentId || !activeAttempt) return;
    setBusy(true);
    try {
      const result = await simulatePaymentAttempt({
        paymentId: attempt.payment.paymentId,
        attemptId: activeAttempt.attemptId,
        outcome: "SUCCESS",
        notificationKey: `counter-demo:${activeAttempt.attemptId}`,
      });
      setAttempt(result);
      finishWhenPaid(result, "BANK_TRANSFER");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-tertiary hover:text-on-surface"
      >
        <ArrowLeft className="size-4" /> Back to order
      </button>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-surface-container-low p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Counter payment
          </p>
          <h1 className="mt-1 font-heading text-2xl font-bold">Order review</h1>
          <div className="mt-6 rounded-xl bg-surface-container-lowest p-4">
            <h2 className="font-heading text-lg font-bold">
              {state.film.title}
            </h2>
            <p className="mt-1 text-sm text-tertiary">
              {new Date(state.showtime.startAt).toLocaleString("vi-VN")} ·{" "}
              {state.showtime.room?.roomName}
            </p>
            <div className="mt-4 space-y-2">
              {state.seats.map((seat) => (
                <div key={seat.seatId} className="flex justify-between text-sm">
                  <span>
                    {seat.type.replaceAll("_", " ")} seat {seat.row}
                    {seat.number}
                  </span>
                  <span>{formatVnd(seat.price)}</span>
                </div>
              ))}
              {state.concessionQuote?.items?.map((item) => (
                <div
                  key={`${item.itemType}:${item.itemId}`}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>{formatVnd(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-surface-container-high pt-4 font-heading text-xl font-bold">
              <span>Amount due</span>
              <span>{formatVnd(total)}</span>
            </div>
          </div>
        </section>
        <section className="rounded-xl bg-surface-container-low p-6">
          <h2 className="font-heading text-lg font-bold">Payment method</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {paymentMethods.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                disabled={busy}
                onClick={() => chooseMethod(id)}
                className={`rounded-xl p-3 text-sm font-semibold ${method === id ? "bg-primary-container text-white" : "bg-surface-container-high text-tertiary hover:text-on-surface"}`}
              >
                <Icon className="mx-auto mb-2 size-5" />
                {label}
              </button>
            ))}
          </div>
          {method === "CASH" ? (
            <div className="mt-6">
              <label className="text-sm font-semibold">Cash received</label>
              <input
                value={
                  tendered
                    ? new Intl.NumberFormat("vi-VN").format(tenderedValue)
                    : ""
                }
                onChange={(event) =>
                  setTendered(
                    event.target.value.replaceAll(".", "").replace(/\D/g, ""),
                  )
                }
                inputMode="numeric"
                className="mt-2 w-full rounded-xl bg-surface-container-high px-4 py-3 text-xl font-bold outline-none ring-primary focus:ring-2"
                placeholder="0"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {presets.map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setAmount(value)}
                    className="rounded-lg bg-surface-container-high px-3 py-2 text-xs text-tertiary hover:text-on-surface"
                  >
                    {formatVnd(value)}
                  </button>
                ))}
              </div>
              <div
                className={`mt-5 rounded-xl p-4 ${tenderedValue >= total ? "bg-secondary-container/20 text-secondary" : "bg-error-container/30 text-error"}`}
              >
                <p className="text-xs font-bold uppercase">
                  {tenderedValue >= total
                    ? "Cash is sufficient"
                    : "Still required"}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold">
                  {formatVnd(Math.max(0, total - tenderedValue))}
                </p>
                <p className="mt-1 text-xs text-tertiary">
                  Any change is handled outside the system.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-surface-container-lowest p-5 text-center">
              {busy && !activeAttempt ? (
                <LoaderCircle className="mx-auto size-7 animate-spin" />
              ) : activeAttempt ? (
                <>
                  {realBankTransfer ? (
                    <QrCodeImage
                      value={activeAttempt.qrPayload}
                      size={190}
                      label="VietQR"
                      ariaLabel="Counter bank transfer VietQR"
                    />
                  ) : (
                    <MockQrSvg
                      payload={activeAttempt.qrPayload}
                      size={180}
                      badgeLabel="DEMO"
                    />
                  )}
                  <p className="mt-3 text-sm font-bold text-secondary">
                    {formatVnd(activeAttempt.amount)}
                  </p>
                  {realBankTransfer && activeAttempt.instruction?.bankAccount && (
                    <div className="mx-auto mt-3 max-w-xs space-y-1 text-left text-xs text-tertiary">
                      <p>Account: <strong className="text-on-surface">{activeAttempt.instruction.bankAccount.accountNumber}</strong></p>
                      <p>Name: <strong className="text-on-surface">{activeAttempt.instruction.bankAccount.accountName}</strong></p>
                      <p>Content: <strong className="font-mono text-on-surface">{activeAttempt.instruction.transferContent}</strong></p>
                    </div>
                  )}
                  <p className="mt-3 font-mono text-xs text-tertiary">
                    {activeAttempt.gatewayTransactionRef}
                  </p>
                  {realBankTransfer && (
                    <p className="mt-2 text-xs text-emerald-300">
                      Automatically checking payOS every 4 seconds…
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-tertiary">
                  Choose bank transfer to create a VietQR payment.
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={!canConfirm || busy || verifying}
            onClick={confirmPayment}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-4 font-bold text-white shadow-crimson disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy || verifying ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <ReceiptText className="size-5" />
            )}
            {busy || verifying
              ? "Processing…"
              : method === "CASH"
                ? "Confirm cash payment"
                : realBankTransfer
                  ? "Check bank transfer"
                  : "Confirm demo payment"}
          </button>
          {method === "BANK_TRANSFER" && activeAttempt?.status === "PENDING" && (
            <button
              type="button"
              disabled={busy}
              onClick={simulateSuccess}
              className="mt-2 w-full rounded-xl border border-white/15 px-4 py-3 text-xs font-bold text-tertiary hover:text-on-surface disabled:opacity-50"
            >
              Simulate successful payment (demo)
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

export default CounterPaymentPage;
