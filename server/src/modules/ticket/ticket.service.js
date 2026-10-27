import crypto from "node:crypto";
import { AppError } from "../../utils/AppError.js";
import { AUDIT_ACTION, AUDIT_TARGET } from "../audit/audit.constants.js";
import { BOOKING_STATUS } from "../booking/booking.constants.js";
import { ticketRepository as defaultTicketRepository } from "./ticket.repository.js";
import {
  CHECK_IN_OPENS_BEFORE_MINUTES,
  QR_PAYLOAD_PREFIX,
  TICKET_ERROR,
  TICKET_ISSUANCE_STATUS,
  TICKET_STATUS,
} from "./ticket.constants.js";

const MAX_ISSUE_ROUNDS = 3;

const idString = (value) => (value == null ? null : String(value));

const ticketError = (status, message, code) => new AppError(status, message, [], code);

const defaultGenerateCode = () =>
  `TK-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

// The QR payload carries an unguessable token in addition to the readable code, so a ticket code
// seen on a screen or receipt is not enough to forge an admission QR.
const defaultGenerateQrCode = (ticketCode) =>
  `${QR_PAYLOAD_PREFIX}:${ticketCode}:${crypto.randomBytes(16).toString("base64url")}`;

const toDate = (value) => (value ? new Date(value) : null);

// dd/MM/yyyy HH:mm in Asia/Ho_Chi_Minh for check-in messages (SRS 4.2.1).
const formatVnDateTime = (value) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map(({ type, value: part }) => [type, part]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};

export const toTicketDto = (ticket) => ({
  ticketId: idString(ticket._id),
  ticketCode: ticket.ticketCode,
  // Only an admissible ticket exposes its QR payload.
  qrCode: ticket.status === TICKET_STATUS.ISSUED ? ticket.qrCode : null,
  bookingId: idString(ticket.bookingId),
  showtimeId: idString(ticket.showtimeId),
  seatId: idString(ticket.seatId),
  seat: {
    label: ticket.seat?.label ?? "",
    row: ticket.seat?.row ?? "",
    number: ticket.seat?.number ?? "",
    type: ticket.seat?.type ?? "STANDARD",
    unitPrice: ticket.seat?.unitPrice ?? null,
  },
  screening: {
    movieTitle: ticket.screening?.movieTitle ?? null,
    ageRating: ticket.screening?.ageRating ?? null,
    cinemaName: ticket.screening?.cinemaName ?? null,
    roomName: ticket.screening?.roomName ?? null,
    roomType: ticket.screening?.roomType ?? null,
    startAt: ticket.screening?.startAt ? new Date(ticket.screening.startAt).toISOString() : null,
    endAt: ticket.screening?.endAt ? new Date(ticket.screening.endAt).toISOString() : null,
  },
  status: ticket.status,
  issuedAt: ticket.issuedAt ? new Date(ticket.issuedAt).toISOString() : null,
  checkedInAt: ticket.checkedInAt ? new Date(ticket.checkedInAt).toISOString() : null,
  invalidatedAt: ticket.invalidatedAt ? new Date(ticket.invalidatedAt).toISOString() : null,
  invalidationReason: ticket.invalidationReason ?? null,
});

const buildScreeningSnapshot = (showtime) => ({
  movieTitle: showtime?.movie?.title ?? null,
  ageRating: showtime?.movie?.ageRating ?? null,
  cinemaName: showtime?.cinema?.branchName ?? null,
  roomName: showtime?.room?.roomName ?? null,
  roomType: showtime?.room?.roomType ?? null,
  startAt: toDate(showtime?.startAt),
  endAt: toDate(showtime?.endAt),
});

const buildSeatSnapshot = (seatId, seatsById, priceBySeat, index) => {
  const seat = seatsById.get(seatId);
  return {
    label: seat?.label || `Seat ${index + 1}`,
    row: seat?.row ?? "",
    number: seat?.number ?? "",
    type: seat?.type ?? "STANDARD",
    unitPrice: seat?.unitPrice ?? priceBySeat.get(seatId) ?? null,
  };
};

/**
 * TICKET-001 service. Ports exposed to other modules:
 * - issueTicketsForConfirmedBooking: called by Payment after a verified, persisted PAID settlement.
 * - getCheckInStatusByBooking / invalidateTicketsByBooking: for Refund and Iter3 check-in.
 * Booking data is read only through `bookingReader`, never from Booking's model.
 */
export const createTicketService = ({
  ticketRepository = defaultTicketRepository,
  bookingReader,
  now = () => new Date(),
  generateCode = defaultGenerateCode,
  generateQrCode = defaultGenerateQrCode,
  // Audit sink for check-ins; the module injects recordAuditEvent, tests keep the no-op.
  auditLog = async () => {},
} = {}) => {
  if (typeof bookingReader?.getBookingDetails !== "function") {
    throw new TypeError("bookingReader.getBookingDetails is required");
  }

  const issueTicketsForConfirmedBooking = async ({ bookingId, ownerId, paymentId = null }) => {
    const { booking, showtime } = await bookingReader.getBookingDetails({ bookingId, ownerId });

    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      throw ticketError(
        409,
        "Tickets can only be issued for a confirmed booking",
        TICKET_ERROR.BOOKING_NOT_CONFIRMED,
      );
    }

    const seatIds = (booking.seatIds ?? []).map(idString);
    const seatsById = new Map((booking.seats ?? []).map((seat) => [idString(seat.seatId), seat]));
    const priceBySeat = new Map(
      (booking.seatLines ?? []).map((line) => [idString(line.seatId), line.unitPrice]),
    );
    const screening = buildScreeningSnapshot(showtime);

    let tickets = await ticketRepository.findByBookingId(booking.bookingId);
    // Codes generated by this call; under concurrency only the winning inserts count as new.
    const generatedCodes = new Set();

    // A retried round only regenerates codes for seats that are still missing, which covers the
    // (practically impossible) case of a random ticketCode/qrCode colliding with another booking.
    for (let round = 0; round < MAX_ISSUE_ROUNDS; round += 1) {
      const issuedSeats = new Set(tickets.map((ticket) => idString(ticket.seatId)));
      const missing = seatIds.filter((seatId) => !issuedSeats.has(seatId));
      if (missing.length === 0) break;

      const issuedAt = now();
      await ticketRepository.insertMissing(
        missing.map((seatId) => {
          const ticketCode = generateCode();
          generatedCodes.add(ticketCode);
          return {
            ticketCode,
            qrCode: generateQrCode(ticketCode),
            bookingId: booking.bookingId,
            paymentId: paymentId ? idString(paymentId) : null,
            showtimeId: booking.showtimeId,
            seatId,
            customerAccountId: booking.customerAccountId,
            seat: buildSeatSnapshot(seatId, seatsById, priceBySeat, seatIds.indexOf(seatId)),
            screening,
            status: TICKET_STATUS.ISSUED,
            issuedAt,
          };
        }),
      );
      tickets = await ticketRepository.findByBookingId(booking.bookingId);
    }

    if (tickets.length < seatIds.length) {
      throw new Error(`Ticket issuance for booking ${booking.bookingId} is incomplete`);
    }

    return {
      bookingId: booking.bookingId,
      newlyIssuedCount: tickets.filter((ticket) => generatedCodes.has(ticket.ticketCode)).length,
      tickets: tickets.map(toTicketDto),
    };
  };

  const listTicketsForBooking = async ({ bookingId }) =>
    (await ticketRepository.findByBookingId(bookingId)).map(toTicketDto);

  // Customer read (BR-36). Booking ownership is enforced by the Booking read port (404/403).
  const getTicketsForOwner = async ({ bookingId, ownerId }) => {
    const { booking } = await bookingReader.getBookingDetails({ bookingId, ownerId });
    return {
      bookingId: booking.bookingId,
      bookingStatus: booking.status,
      tickets: await listTicketsForBooking({ bookingId: booking.bookingId }),
    };
  };

  const getTicketForOwner = async ({ ticketId, ownerId }) => {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) {
      throw ticketError(404, "Ticket not found", TICKET_ERROR.TICKET_NOT_FOUND);
    }
    if (idString(ticket.customerAccountId) !== idString(ownerId)) {
      throw ticketError(403, "You do not have access to this ticket", TICKET_ERROR.TICKET_FORBIDDEN);
    }
    return toTicketDto(ticket);
  };

  const getCheckInStatusByBooking = async ({ bookingId, session } = {}) => {
    const tickets = await ticketRepository.findByBookingId(bookingId, session);
    const checkedInCount = tickets.filter(
      (ticket) => ticket.status === TICKET_STATUS.USED || ticket.checkedInAt,
    ).length;
    return {
      bookingId: idString(bookingId),
      ticketCount: tickets.length,
      checkedInCount,
      checkedIn: checkedInCount > 0,
    };
  };

  // Idempotent: repeated calls only report what is already invalidated. USED tickets are never
  // rewritten; callers (Refund) must reject checked-in bookings before invalidating.
  const invalidateTicketsByBooking = async ({ bookingId, reason, session } = {}) => {
    if (typeof reason !== "string" || !reason.trim()) {
      throw new TypeError("An invalidation reason is required");
    }
    const invalidatedCount = await ticketRepository.invalidateIssuedByBooking(
      bookingId,
      { at: now(), reason: reason.trim() },
      session,
    );
    const tickets = await ticketRepository.findByBookingId(bookingId, session);
    return {
      bookingId: idString(bookingId),
      invalidatedCount,
      usedCount: tickets.filter((ticket) => ticket.status === TICKET_STATUS.USED).length,
      tickets: tickets.map(toTicketDto),
    };
  };

  // TICKET-101: Staff check-in by ticket code. Order of checks: ticket state (BR-17/BR-40), the
  // Booking it belongs to (a refunded booking is never admitted even if its tickets were not
  // invalidated yet), the Showtime and branch, then the check-in window. The final ISSUED -> USED
  // write is a compare-and-set, so concurrent check-ins of one ticket admit it once.
  const checkInTicket = async ({ ticketCode, staffAccountId, staffBranchId }) => {
    if (!staffBranchId) {
      throw ticketError(403, "Your account is not assigned to a cinema branch.", TICKET_ERROR.BRANCH_NOT_ASSIGNED);
    }

    const alreadyUsed = (ticket) =>
      ticketError(
        409,
        `Ticket ${ticket.ticketCode} was already checked in${ticket.checkedInAt ? ` at ${formatVnDateTime(ticket.checkedInAt)}` : ""}. It cannot be used again.`,
        TICKET_ERROR.ALREADY_USED,
      );
    const invalidated = (ticket) =>
      ticketError(
        409,
        `Ticket ${ticket.ticketCode} is no longer valid (refunded or cancelled) and cannot be admitted.`,
        TICKET_ERROR.INVALIDATED,
      );

    const ticket = await ticketRepository.findByTicketCode(ticketCode);
    if (!ticket) throw ticketError(404, "No ticket matches this code.", TICKET_ERROR.TICKET_NOT_FOUND);
    if (ticket.status === TICKET_STATUS.USED) throw alreadyUsed(ticket);
    if (ticket.status !== TICKET_STATUS.ISSUED) throw invalidated(ticket);

    const { booking, showtime } = await bookingReader.getBookingDetails({
      bookingId: idString(ticket.bookingId),
      ownerId: idString(ticket.customerAccountId),
    });
    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      if (booking.status === BOOKING_STATUS.REFUNDED) {
        await invalidateTicketsByBooking({ bookingId: ticket.bookingId, reason: "BOOKING_REFUNDED" });
      }
      throw invalidated(ticket);
    }

    if (!showtime?.startAt || !showtime?.endAt || (showtime.status && showtime.status !== "PUBLISHED")) {
      throw ticketError(409, "The showtime of this ticket is not available for check-in.", TICKET_ERROR.SHOWTIME_UNAVAILABLE);
    }

    const cinemaId = idString(showtime.cinema?.id);
    if (!cinemaId || cinemaId !== idString(staffBranchId)) {
      throw ticketError(
        403,
        `This ticket is for ${showtime.cinema?.branchName ?? "another branch"}. It can only be checked in at that branch.`,
        TICKET_ERROR.WRONG_BRANCH,
      );
    }

    const at = now();
    const opensAt = new Date(new Date(showtime.startAt).getTime() - CHECK_IN_OPENS_BEFORE_MINUTES * 60_000);
    if (at < opensAt) {
      throw ticketError(
        409,
        `Check-in for this showtime opens at ${formatVnDateTime(opensAt)} (${CHECK_IN_OPENS_BEFORE_MINUTES} minutes before it starts).`,
        TICKET_ERROR.TOO_EARLY,
      );
    }
    if (at >= new Date(showtime.endAt)) {
      throw ticketError(409, "This showtime has ended. The ticket can no longer be checked in.", TICKET_ERROR.SHOWTIME_ENDED);
    }

    if (!(await ticketRepository.markUsed(ticket._id, { at, by: staffAccountId }))) {
      // Lost the race: another check-in admitted it first, or it was invalidated meanwhile.
      const current = await ticketRepository.findById(ticket._id);
      throw current?.status === TICKET_STATUS.USED ? alreadyUsed(current) : invalidated(ticket);
    }

    await auditLog({
      actorAccountId: staffAccountId,
      action: AUDIT_ACTION.TICKET_CHECKED_IN,
      targetType: AUDIT_TARGET.TICKET,
      targetId: ticket._id,
      summary: `Checked in ticket ${ticket.ticketCode}`,
      changes: { status: { from: TICKET_STATUS.ISSUED, to: TICKET_STATUS.USED }, bookingId: idString(ticket.bookingId) },
    });

    return {
      ticket: toTicketDto(await ticketRepository.findById(ticket._id)),
      bookingCheckIn: await getCheckInStatusByBooking({ bookingId: ticket.bookingId }),
    };
  };

  return {
    checkInTicket,
    issueTicketsForConfirmedBooking,
    listTicketsForBooking,
    getTicketsForOwner,
    getTicketForOwner,
    getCheckInStatusByBooking,
    invalidateTicketsByBooking,
  };
};

// Payment-facing summary used on C15/C16. Not a demo preview: it reflects persisted tickets.
export const summarizeTicketIssuance = ({ isConfirmedAndPaid, tickets }) => {
  if (!isConfirmedAndPaid) {
    return { eligible: false, status: TICKET_ISSUANCE_STATUS.NOT_ISSUED, ticketCount: 0, tickets: [] };
  }
  return {
    eligible: true,
    status: tickets.length > 0 ? TICKET_ISSUANCE_STATUS.ISSUED : TICKET_ISSUANCE_STATUS.ISSUANCE_PENDING,
    ticketCount: tickets.length,
    tickets: tickets.map(({ ticketId, ticketCode, seat, status }) => ({
      ticketId,
      ticketCode,
      seatLabel: seat.label,
      status,
    })),
  };
};
