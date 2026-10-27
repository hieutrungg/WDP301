import ConcessionOrderSummary from "../components/ConcessionOrderSummary";
import BookingPriceSummary from "../components/BookingPriceSummary";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangle,
    Armchair,
    Building2,
    Calendar,
    ChevronRight,
    Clock3,
    Copy,
    CreditCard,
    ExternalLink,
    History,
    House,
    LoaderCircle,
    QrCode,
    RefreshCcw,
    ShieldAlert,
    Ticket,
    X,
} from "lucide-react";
import { Link } from "react-router";
import QrCodeImage from "../../../components/ui/QrCode";
import { getApiErrorMessage } from "../../../lib/api/apiError";
import { formatSeatMoney } from "../../seat-selection/utils/seatPricing";
import { getBookingTickets } from "../../ticket/api/ticketApi";
import {
    describeTicketIssuance,
    formatSeatType,
    formatVnDateTime,
    getTicketStatusMeta,
    isTicketAdmissible,
} from "../../ticket/utils/ticketPresentation";
import { listMyBookingPayments } from "../api/paymentApi";
import { getPaymentMethodOption } from "../utils/mockQrCode";

const FILTER_TABS = [
    { id: "CONFIRMED", label: "My Tickets (Paid)" },
    { id: "ALL", label: "All Booking History" },
    { id: "PENDING_PAYMENT", label: "Pending Payment" },
    { id: "EXPIRED_OR_REVIEW", label: "Expired / Reconciliation" },
];

function getStatusBadge(booking, payment) {
    if (booking?.status === "REFUNDED") {
        return {
            label:
                payment?.status === "PARTIALLY_REFUNDED"
                    ? "PARTIALLY REFUNDED"
                    : "REFUNDED",
            className: "border-sky-400/40 bg-sky-400/15 text-sky-300",
        };
    }
    if (booking?.status === "CONFIRMED" && payment?.status === "PAID") {
        return {
            label: "CONFIRMED • PAID",
            className:
                "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
        };
    }
    if (payment?.status === "REVIEW_REQUIRED") {
        return {
            label: "REVIEW REQUIRED (LATE PAYMENT)",
            className: "border-secondary/40 bg-secondary/15 text-secondary",
        };
    }
    if (booking?.status === "PENDING_PAYMENT") {
        return {
            label: "AWAITING PAYMENT",
            className: "border-amber-400/40 bg-amber-400/15 text-amber-300",
        };
    }
    return {
        label: "EXPIRED",
        className: "border-white/15 bg-white/5 text-on-surface-variant",
    };
}

// Real tickets of a paid booking (GET /api/tickets/bookings/:bookingId): one per seat, with the
// scannable QR only while the ticket is still valid for entry.
function BookingTicketsPanel({ bookingId }) {
    const [selectedId, setSelectedId] = useState(null);
    const [copiedCode, setCopiedCode] = useState(false);
    const ticketsQuery = useQuery({
        queryKey: ["booking-tickets", bookingId],
        queryFn: () => getBookingTickets(bookingId),
        staleTime: 0,
    });

    if (ticketsQuery.isPending) {
        return (
            <div
                role="status"
                className="my-auto flex items-center gap-2 py-10 text-xs text-on-surface-variant"
            >
                <LoaderCircle className="size-5 animate-spin text-primary" />
                Loading your E-Tickets…
            </div>
        );
    }

    if (ticketsQuery.isError) {
        return (
            <div role="alert" className="my-auto space-y-3 py-8">
                <AlertTriangle className="mx-auto size-8 text-error" />
                <p className="text-xs text-on-surface-variant">
                    {getApiErrorMessage(ticketsQuery.error)}
                </p>
                <button
                    type="button"
                    onClick={() => ticketsQuery.refetch()}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white"
                >
                    Try again
                </button>
            </div>
        );
    }

    const tickets = ticketsQuery.data?.tickets ?? [];
    if (tickets.length === 0) {
        return (
            <div className="my-auto space-y-3 py-8">
                <Clock3 className="mx-auto size-10 text-amber-400" />
                <h3 className="font-heading text-base font-bold text-white">
                    Tickets are being issued
                </h3>
                <p className="text-xs text-on-surface-variant">
                    Your payment is confirmed. Refresh in a moment to see your
                    E-Tickets.
                </p>
                <button
                    type="button"
                    onClick={() => ticketsQuery.refetch()}
                    className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-white"
                >
                    Refresh
                </button>
            </div>
        );
    }

    const ticket =
        tickets.find(({ ticketId }) => ticketId === selectedId) ?? tickets[0];
    const status = getTicketStatusMeta(ticket.status);

    const select = (next) => {
        setSelectedId(next.ticketId);
        setCopiedCode(false);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(ticket.ticketCode);
            setCopiedCode(true);
            window.setTimeout(() => setCopiedCode(false), 2000);
        } catch {
            setCopiedCode(false);
        }
    };

    return (
        <>
            <div className="w-full">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-secondary">
                    <QrCode className="size-3.5" />
                    E-Ticket{" "}
                    {tickets.length > 1
                        ? `${tickets.indexOf(ticket) + 1} of ${tickets.length}`
                        : ""}
                </span>
                {tickets.length > 1 && (
                    <div
                        className="mt-3 flex flex-wrap justify-center gap-1.5"
                        role="tablist"
                        aria-label="Choose a seat"
                    >
                        {tickets.map((item) => (
                            <button
                                key={item.ticketId}
                                type="button"
                                role="tab"
                                aria-selected={
                                    item.ticketId === ticket.ticketId
                                }
                                onClick={() => select(item)}
                                className={`rounded-md border px-2.5 py-1 font-heading text-xs font-black ${item.ticketId === ticket.ticketId ? "border-primary bg-primary/25 text-white" : "border-white/15 text-on-surface-variant hover:text-white"}`}
                            >
                                {item.seat.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="my-5 flex flex-col items-center">
                {isTicketAdmissible(ticket) ? (
                    <QrCodeImage
                        value={ticket.qrCode}
                        size={185}
                        label="E-TICKET"
                        ariaLabel={`Admission QR for seat ${ticket.seat.label}`}
                    />
                ) : (
                    <div className="flex size-[200px] items-center justify-center rounded-2xl border border-white/10 bg-surface-container-low p-4 text-xs text-on-surface-variant">
                        {ticket.status === "USED" && ticket.checkedInAt
                            ? `Checked in at ${formatVnDateTime(ticket.checkedInAt)}`
                            : status.label}
                    </div>
                )}

                <span
                    className={`mt-3 rounded-full border px-3 py-0.5 text-[10px] font-black uppercase tracking-wider ${status.tone}`}
                >
                    {status.label}
                </span>
                <p className="mt-2 text-[11px] text-on-surface-variant">
                    Seat {ticket.seat.label} ·{" "}
                    {formatSeatType(ticket.seat.type)}
                </p>

                <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-surface-container px-3.5 py-2">
                    <span className="font-mono text-xs font-black tracking-wider text-secondary">
                        {ticket.ticketCode}
                    </span>
                    <button
                        type="button"
                        onClick={handleCopy}
                        title="Copy ticket code"
                        className="text-on-surface-variant hover:text-white"
                    >
                        <Copy className="size-3.5" />
                    </button>
                </div>
                {copiedCode && (
                    <span className="mt-1 text-[11px] font-bold text-emerald-400">
                        Ticket code copied!
                    </span>
                )}
            </div>

            <Link
                to={`/tickets/${ticket.ticketId}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b5000b] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-primary/25"
            >
                Open fullscreen E-Ticket
                <ExternalLink className="size-3.5" />
            </Link>
        </>
    );
}

function TicketDetailModal({ item, onClose }) {
    if (!item) return null;

    const { booking, payment, showtime } = item;
    const seats = item.seats?.length ? item.seats : booking?.seats || [];
    const isConfirmedAndPaid =
        booking?.status === "CONFIRMED" && payment?.status === "PAID";
    const isReviewRequired = payment?.status === "REVIEW_REQUIRED";
    const isPending = booking?.status === "PENDING_PAYMENT";
    const methodMeta = payment?.method
        ? getPaymentMethodOption(payment.method)
        : null;
    const displayRef =
        booking?.bookingCode || booking?.payableReference || booking?.bookingId;
    const statusBadge = getStatusBadge(booking, payment);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-detail-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
            <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/15 bg-[#19191c] p-6 text-on-surface shadow-2xl sm:p-8">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className={`rounded-full border px-3 py-0.5 text-[11px] font-black uppercase tracking-wider ${statusBadge.className}`}
                            >
                                {statusBadge.label}
                            </span>
                            <span className="rounded bg-primary/20 px-2.5 py-0.5 text-[11px] font-bold uppercase text-primary">
                                {showtime?.format ||
                                    showtime?.room?.roomType ||
                                    "2D Digital"}
                            </span>
                        </div>
                        <h2
                            id="ticket-detail-modal-title"
                            className="mt-2.5 font-heading text-2xl font-black tracking-tight text-white sm:text-3xl"
                        >
                            {showtime?.movieTitle ||
                                showtime?.movie?.title ||
                                "F-Cinema Movie Screening"}
                        </h2>
                        <p className="mt-1 text-xs text-on-surface-variant">
                            Booking Code:{" "}
                            <strong className="font-mono text-secondary">
                                #{displayRef}
                            </strong>{" "}
                            • Payable Ref:{" "}
                            <span className="font-mono text-white">
                                {booking?.payableReference}
                            </span>
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close ticket detail modal"
                        className="rounded-xl border border-white/10 bg-surface-container p-2 text-on-surface-variant transition hover:border-white/30 hover:text-white"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Body Grid */}
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Left 7 Cols: Screening, Seats, and Financial Details */}
                    <div className="space-y-5 lg:col-span-7">
                        {/* Cinema, Room & Screening Time */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-[#131315] p-4">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                                    <Building2 className="size-3.5 text-primary" />
                                    Cinema &amp; Hall
                                </div>
                                <p className="mt-1.5 font-heading text-base font-bold text-white">
                                    {showtime?.cinemaName ||
                                        showtime?.cinema?.branchName ||
                                        "F-Cinema Branch"}
                                </p>
                                <p className="mt-0.5 text-xs font-semibold text-secondary">
                                    {showtime?.roomName ||
                                        showtime?.room?.roomName ||
                                        "Standard Hall"}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-[#131315] p-4">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                                    <Calendar className="size-3.5 text-secondary" />
                                    Screening Date &amp; Time Screening Date
                                    &amp; Time
                                </div>
                                <p className="mt-1.5 font-heading text-base font-bold text-white">
                                    {formatVnDateTime(
                                        showtime?.startAt,
                                        "Scheduled screening",
                                    )}
                                </p>
                                <p className="mt-0.5 text-xs text-emerald-400">
                                    Vietnam time (GMT+7)
                                </p>
                            </div>
                        </div>

                        <BookingPriceSummary booking={booking} />
                        <ConcessionOrderSummary
                            order={booking?.concessionOrder}
                            paid={
                                booking?.status === "CONFIRMED" &&
                                payment?.status === "PAID"
                            }
                        />
                        {/* Detailed Seats Table */}
                        <div className="rounded-2xl border border-white/10 bg-[#131315] p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    <Armchair className="size-4 text-primary" />
                                    Booked seats ({seats.length})
                                </span>
                                <span className="font-mono text-xs font-bold text-secondary">
                                    {seats.map((s) => s.label).join(", ")}
                                </span>
                            </div>

                            <div className="divide-y divide-white/10 rounded-xl border border-white/5 bg-surface-container-low">
                                {seats.map((seat) => (
                                    <div
                                        key={seat.seatId}
                                        className="flex items-center justify-between px-4 py-2.5 text-xs"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className="rounded-md border border-primary/40 bg-primary/20 px-2.5 py-1 font-heading text-xs font-black text-white">
                                                {seat.label}
                                            </span>
                                            <span className="text-on-surface-variant">
                                                Seat type:{" "}
                                                <strong className="text-white">
                                                    {seat.type || "STANDARD"}
                                                </strong>
                                            </span>
                                        </div>
                                        <strong className="font-mono text-sm text-white">
                                            {formatSeatMoney(seat.unitPrice)}
                                        </strong>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Payment & Price Breakdown */}
                        <div className="rounded-2xl border border-white/10 bg-[#131315] p-4">
                            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                <CreditCard className="size-4 text-secondary" />
                                Payment &amp; Amount
                            </h3>

                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between text-on-surface-variant">
                                    <span>Payment method</span>
                                    <strong className="text-white">
                                        {methodMeta
                                            ? methodMeta.label
                                            : "No method selected"}
                                    </strong>
                                </div>
                                <div className="flex justify-between text-on-surface-variant">
                                    <span>Settlement reference</span>
                                    <span className="font-mono text-white">
                                        {payment?.settlementReference ||
                                            payment?.settlementAttemptId ||
                                            "—"}
                                    </span>
                                </div>
                                <div className="flex justify-between text-on-surface-variant">
                                    <span>Booked / paid at</span>
                                    <span className="text-white">
                                        {formatVnDateTime(
                                            payment?.paidAt ||
                                                booking?.bookingTime,
                                            "—",
                                        )}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
                                    <span className="font-bold uppercase tracking-wider text-on-surface-variant">
                                        Total amount (VND)
                                    </span>
                                    <strong className="font-heading text-2xl font-black text-secondary">
                                        {formatSeatMoney(
                                            payment?.amount ??
                                                booking?.totalAmount ??
                                                booking?.amount ??
                                                0,
                                        )}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right 5 Cols: the booking's real E-Tickets (TICKET-001) */}
                    <div className="flex flex-col items-center justify-between rounded-2xl border border-white/10 bg-[#131315] p-6 text-center lg:col-span-5">
                        {isConfirmedAndPaid ? (
                            <BookingTicketsPanel
                                bookingId={booking.bookingId}
                            />
                        ) : booking?.status === "REFUNDED" ? (
                            <div className="my-auto space-y-3 py-6">
                                <RefreshCcw className="mx-auto size-12 text-sky-300" />
                                <h3 className="font-heading text-lg font-bold text-white">
                                    Booking refunded
                                </h3>
                                <p className="text-xs leading-relaxed text-on-surface-variant">
                                    The refund for this booking is complete, so
                                    its E-Tickets are no longer valid for entry.
                                </p>
                            </div>
                        ) : isReviewRequired ? (
                            <div className="my-auto space-y-3 py-6">
                                <ShieldAlert className="mx-auto size-12 text-secondary" />
                                <h3 className="font-heading text-lg font-bold text-white">
                                    Late payment after the seat hold expired
                                </h3>
                                <p className="text-xs leading-relaxed text-on-surface-variant">
                                    The transaction is{" "}
                                    <strong className="text-secondary">
                                        REVIEW_REQUIRED
                                    </strong>{" "}
                                    ({payment?.reconciliationReason}). No
                                    E-Ticket QR code is issued for an expired
                                    booking.
                                </p>
                            </div>
                        ) : (
                            <div className="my-auto space-y-3 py-6">
                                <Clock3 className="mx-auto size-12 text-amber-400" />
                                <h3 className="font-heading text-lg font-bold text-white">
                                    {isPending
                                        ? "Payment not completed"
                                        : "Booking expired"}
                                </h3>
                                <p className="text-xs leading-relaxed text-on-surface-variant">
                                    {isPending
                                        ? "The E-Ticket QR code is issued only after the server confirms a successful payment."
                                        : "The seat hold ended before the payment was completed."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-white/15 bg-surface-container px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:border-white/30"
                    >
                        Close Close
                    </button>

                    <div className="flex flex-wrap items-center gap-3">
                        {isPending && booking?.showtimeId && (
                            <Link
                                to={`/booking/${booking.showtimeId}/checkout`}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
                            >
                                Continue payment
                                <ExternalLink className="size-3.5" />
                            </Link>
                        )}
                        {booking?.bookingId && booking?.showtimeId && (
                            <Link
                                to={`/booking/${booking.showtimeId}/confirmation/${booking.bookingId}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface-container px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:border-white/30"
                            >
                                Booking confirmation
                                <ExternalLink className="size-3.5" />
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CustomerBookingsPage({ initialMode = "tickets" }) {
    const [activeFilter, setActiveFilter] = useState(
        initialMode === "history" ? "ALL" : "CONFIRMED",
    );
    const [selectedItem, setSelectedItem] = useState(null);

    const historyQuery = useQuery({
        queryKey: ["my-booking-payments"],
        staleTime: 0,
        queryFn: listMyBookingPayments,
    });

    const allItems = historyQuery.data?.items || [];
    const summary = historyQuery.data?.summary || {
        totalBookings: allItems.length,
        confirmedTicketsCount: 0,
        pendingCount: 0,
        expiredOrReviewCount: 0,
    };

    const filteredItems = allItems.filter((item) => {
        const isPaidTicket =
            item.booking?.status === "CONFIRMED" &&
            item.payment?.status === "PAID";
        if (activeFilter === "CONFIRMED") return isPaidTicket;
        if (activeFilter === "PENDING_PAYMENT") {
            return item.booking?.status === "PENDING_PAYMENT";
        }
        if (activeFilter === "EXPIRED_OR_REVIEW") {
            return (
                item.booking?.status === "EXPIRED" ||
                item.payment?.status === "REVIEW_REQUIRED"
            );
        }
        return true;
    });

    return (
        <div className="min-h-screen bg-background pb-20 pt-24 text-on-surface">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                {/* Breadcrumb */}
                <nav
                    aria-label="Breadcrumb"
                    className="mb-6 flex items-center gap-1.5 text-xs text-on-surface-variant"
                >
                    <Link
                        to="/"
                        className="flex items-center gap-1 hover:text-white"
                    >
                        <House className="size-3.5" />
                        Home
                    </Link>
                    <ChevronRight className="size-3.5 opacity-40" />
                    <Link to="/profile" className="hover:text-white">
                        Customer Account
                    </Link>
                    <ChevronRight className="size-3.5 opacity-40" />
                    <span className="font-semibold text-white">
                        {initialMode === "history"
                            ? "Booking History"
                            : "My Tickets"}
                    </span>
                </nav>

                {/* Page Title & Mode Switcher */}
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary">
                            {initialMode === "history" ? (
                                <History className="size-4 text-primary" />
                            ) : (
                                <Ticket className="size-4 text-primary" />
                            )}
                            Customer Portal • Verified Server Records
                        </div>
                        <h1 className="mt-1 font-heading text-3xl font-black tracking-tight text-white sm:text-4xl">
                            {initialMode === "history"
                                ? "Booking & Payment History"
                                : "My Tickets"}
                        </h1>
                        <p className="mt-1 text-sm text-on-surface-variant">
                            Select any booking to see its seats, amount,
                            screening date, hall and your E-Tickets with their
                            entry QR codes.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => historyQuery.refetch()}
                        disabled={historyQuery.isFetching}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface-container px-4 py-2.5 text-xs font-bold text-white transition hover:border-white/30 disabled:opacity-45"
                    >
                        <RefreshCcw
                            className={`size-4 ${historyQuery.isFetching ? "animate-spin" : ""}`}
                        />
                        Refresh list
                    </button>
                </div>

                {/* Summary KPI Cards */}
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-500/25 bg-surface-container-low p-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                            Paid bookings
                        </span>
                        <p className="mt-1 font-heading text-2xl font-black text-emerald-400">
                            {summary.confirmedTicketsCount}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-surface-container-low p-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                            Total bookings
                        </span>
                        <p className="mt-1 font-heading text-2xl font-black text-white">
                            {summary.totalBookings}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-amber-400/25 bg-surface-container-low p-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                            Awaiting payment
                        </span>
                        <p className="mt-1 font-heading text-2xl font-black text-amber-300">
                            {summary.pendingCount}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-surface-container-low p-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                            Expired / Under review
                        </span>
                        <p className="mt-1 font-heading text-2xl font-black text-secondary">
                            {summary.expiredOrReviewCount}
                        </p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="mt-6 flex flex-wrap gap-2">
                    {FILTER_TABS.map((tab) => {
                        const active = activeFilter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveFilter(tab.id)}
                                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                                    active
                                        ? "bg-primary text-white shadow-lg shadow-primary/25"
                                        : "border border-white/10 bg-surface-container-low text-on-surface-variant hover:border-white/25 hover:text-white"
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Loading & Error States */}
                {historyQuery.isPending && (
                    <div
                        role="status"
                        className="mt-8 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-surface-container-low p-12 text-sm"
                    >
                        <LoaderCircle className="size-6 animate-spin text-primary" />
                        Loading your tickets and booking history…
                    </div>
                )}

                {historyQuery.isError && (
                    <div
                        role="alert"
                        className="mt-8 rounded-2xl border border-error/40 bg-error/10 p-6 text-center"
                    >
                        <AlertTriangle className="mx-auto size-8 text-error" />
                        <p className="mt-2 font-bold text-white">
                            {getApiErrorMessage(historyQuery.error)}
                        </p>
                        <button
                            type="button"
                            onClick={() => historyQuery.refetch()}
                            className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Ticket & Booking List */}
                {!historyQuery.isPending && !historyQuery.isError && (
                    <div className="mt-6 space-y-4">
                        {filteredItems.length === 0 ? (
                            <div className="rounded-3xl border border-white/10 bg-surface-container-low p-12 text-center">
                                <Ticket className="mx-auto size-12 text-primary/70" />
                                <h2 className="mt-4 font-heading text-xl font-bold text-white">
                                    No tickets or bookings in this section yet
                                </h2>
                                <p className="mt-2 text-sm text-on-surface-variant">
                                    Choose a movie and book your seats to
                                    receive an E-Ticket.
                                </p>
                                <div className="mt-6 flex justify-center gap-3">
                                    {activeFilter !== "ALL" &&
                                        allItems.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setActiveFilter("ALL")
                                                }
                                                className="rounded-xl border border-white/15 bg-surface-container px-5 py-3 text-xs font-bold text-white"
                                            >
                                                View all bookings (
                                                {allItems.length})
                                            </button>
                                        )}
                                    <Link
                                        to="/movies"
                                        className="rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-white"
                                    >
                                        Book a movie now
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            filteredItems.map((item) => {
                                const {
                                    booking,
                                    payment,
                                    showtime,
                                    ticketIssuance,
                                } = item;
                                const seats = item.seats?.length
                                    ? item.seats
                                    : booking?.seats || [];
                                const statusBadge = getStatusBadge(
                                    booking,
                                    payment,
                                );
                                const methodMeta = payment?.method
                                    ? getPaymentMethodOption(payment.method)
                                    : null;
                                const isPaidTicket =
                                    booking?.status === "CONFIRMED" &&
                                    payment?.status === "PAID";
                                const ticketSummary =
                                    describeTicketIssuance(ticketIssuance);
                                const displayRef =
                                    booking?.bookingCode ||
                                    booking?.payableReference ||
                                    booking?.bookingId;

                                return (
                                    <article
                                        key={booking.bookingId}
                                        onClick={() => setSelectedItem(item)}
                                        className="group cursor-pointer rounded-2xl border border-white/10 bg-surface-container-low p-5 transition hover:border-primary/50 hover:bg-surface-container sm:p-6"
                                    >
                                        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                                            {/* Left Info */}
                                            <div className="space-y-2.5">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span
                                                        className={`rounded-full border px-3 py-0.5 text-[11px] font-black uppercase tracking-wider ${statusBadge.className}`}
                                                    >
                                                        {statusBadge.label}
                                                    </span>
                                                    <span className="font-mono text-xs font-bold text-secondary">
                                                        #{displayRef}
                                                    </span>
                                                    {methodMeta && (
                                                        <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
                                                            {methodMeta.label}
                                                        </span>
                                                    )}
                                                </div>

                                                <h2 className="font-heading text-xl font-black text-white group-hover:text-primary sm:text-2xl">
                                                    {showtime?.movieTitle ||
                                                        showtime?.movie
                                                            ?.title ||
                                                        "F-Cinema Movie Screening"}
                                                </h2>

                                                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-on-surface-variant">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Building2 className="size-3.5 text-primary" />
                                                        <strong className="text-white">
                                                            {showtime?.cinemaName ||
                                                                showtime?.cinema
                                                                    ?.branchName ||
                                                                "F-Cinema"}
                                                        </strong>
                                                        {" • "}
                                                        <span className="text-secondary">
                                                            {showtime?.roomName ||
                                                                showtime?.room
                                                                    ?.roomName ||
                                                                "Hall"}
                                                        </span>
                                                    </span>

                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Calendar className="size-3.5 text-secondary" />
                                                        {formatVnDateTime(
                                                            showtime?.startAt,
                                                            "Scheduled time",
                                                        )}
                                                    </span>
                                                </div>

                                                {/* Seat Chips */}
                                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                    <span className="mr-1 inline-flex items-center gap-1 text-xs text-on-surface-variant">
                                                        <Armchair className="size-3.5 text-primary" />
                                                        Seats ({seats.length}):
                                                        Seats ({seats.length}):
                                                    </span>
                                                    {seats.map((seat) => (
                                                        <span
                                                            key={seat.seatId}
                                                            className="rounded border border-primary/40 bg-primary/15 px-2 py-0.5 font-heading text-xs font-extrabold text-white"
                                                        >
                                                            {seat.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Right Price, Mini QR Preview & CTA */}
                                            <div className="flex flex-wrap items-center justify-between gap-5 border-t border-white/10 pt-4 lg:border-t-0 lg:pt-0">
                                                {isPaidTicket &&
                                                    ticketSummary.label && (
                                                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#131315] px-3 py-2">
                                                            <Ticket className="size-6 text-secondary" />
                                                            <div className="text-left">
                                                                <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary">
                                                                    {
                                                                        ticketSummary.label
                                                                    }
                                                                </span>
                                                                <span className="font-mono text-[11px] text-white">
                                                                    {ticketIssuance.tickets
                                                                        .slice(
                                                                            0,
                                                                            2,
                                                                        )
                                                                        .map(
                                                                            (
                                                                                ticket,
                                                                            ) =>
                                                                                ticket.ticketCode,
                                                                        )
                                                                        .join(
                                                                            ", ",
                                                                        )}
                                                                    {ticketIssuance
                                                                        .tickets
                                                                        .length >
                                                                    2
                                                                        ? ", …"
                                                                        : ""}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}

                                                <div className="text-left lg:text-right">
                                                    <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                                        Total Total
                                                    </span>
                                                    <strong className="font-heading text-2xl font-black text-secondary">
                                                        {formatSeatMoney(
                                                            payment?.amount ??
                                                                booking?.totalAmount ??
                                                                booking?.amount ??
                                                                0,
                                                        )}
                                                    </strong>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setSelectedItem(item);
                                                    }}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b5000b] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-primary/20 transition group-hover:brightness-110"
                                                >
                                                    <QrCode className="size-4" />
                                                    {isPaidTicket
                                                        ? "View E-Tickets"
                                                        : "View details"}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Ticket Detail & QR Modal */}
            <TicketDetailModal
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
            />
        </div>
    );
}

export default CustomerBookingsPage;
