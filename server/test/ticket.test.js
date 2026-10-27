import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { BOOKING_ERROR } from "../src/modules/booking/booking.constants.js";
import { PAYMENT_METHODS, PAYMENT_STATUS } from "../src/modules/payment/payment.constants.js";
import {
  QR_PAYLOAD_PREFIX,
  TICKET_ERROR,
  TICKET_STATUS,
  TICKET_STATUSES,
} from "../src/modules/ticket/ticket.constants.js";
import { createTicketController } from "../src/modules/ticket/ticket.controller.js";
import { TICKET_INDEXES } from "../src/modules/ticket/ticket.indexes.js";
import { Ticket } from "../src/modules/ticket/ticket.model.js";
import { createTicketRouter } from "../src/modules/ticket/ticket.routes.js";
import { toTicketDto } from "../src/modules/ticket/ticket.service.js";
import { createInMemoryTicketRepository } from "./helpers/in-memory-ticket-repository.js";
import { createInMemoryHarness } from "./helpers/payment-harness.js";

const createPendingPayment = async (harness, key = "ticket") => {
  const booking = await harness.bookingService.createPendingBookingFromHold({
    holdId: harness.holdId,
    ownerId: harness.ownerId,
    requestKey: `req-${key}`,
  });
  const initiated = await harness.paymentService.initiatePayment({
    bookingId: booking.bookingId,
    ownerId: harness.ownerId,
    method: PAYMENT_METHODS.MOMO_WALLET,
    idempotencyKey: `idem-${key}-0001`,
  });
  return { booking, initiated };
};

const notify = (harness, initiated, notificationKey, outcome = "SUCCESS") =>
  harness.paymentService.handlePaymentNotification({
    paymentId: initiated.payment.paymentId,
    attemptId: initiated.activeAttempt.attemptId,
    outcome,
    notificationKey,
    actorOwnerId: harness.ownerId,
  });

const payBooking = async (harness, key = "ticket") => {
  const pending = await createPendingPayment(harness, key);
  const settled = await notify(harness, pending.initiated, `notif-${key}-success`);
  return { ...pending, settled };
};

test("TICKET-001 model and index definitions back the idempotency contract", () => {
  assert.equal(Ticket.schema.options.autoIndex, false);
  assert.equal(Ticket.schema.options.collection, "tickets");
  assert.deepEqual(Ticket.schema.path("status").enumValues, TICKET_STATUSES);
  assert.deepEqual(TICKET_STATUSES, ["ISSUED", "USED", "INVALIDATED"]);
  const byName = Object.fromEntries(TICKET_INDEXES.map((index) => [index.options.name, index]));
  assert.deepEqual(byName.uniq_ticket_booking_seat.fields, { bookingId: 1, seatId: 1 });
  assert.deepEqual(byName.uniq_ticket_code.fields, { ticketCode: 1 });
  assert.deepEqual(byName.uniq_ticket_qr_code.fields, { qrCode: 1 });
  assert.ok(TICKET_INDEXES.every((index) => index.options.unique === true));
});

test("verified payment success issues exactly one ISSUED ticket per seat with an immutable snapshot", async () => {
  const harness = createInMemoryHarness();
  const { booking, settled } = await payBooking(harness);

  assert.equal(settled.payment.status, PAYMENT_STATUS.PAID);
  const tickets = await harness.ticketService.listTicketsForBooking({ bookingId: booking.bookingId });
  assert.equal(tickets.length, 2);
  assert.deepEqual(tickets.map((ticket) => ticket.seat.label), ["G12", "G13"]);
  assert.deepEqual(
    tickets.map((ticket) => ticket.seatId).sort(),
    [...harness.seatIds].sort(),
  );

  for (const ticket of tickets) {
    assert.equal(ticket.status, TICKET_STATUS.ISSUED);
    assert.equal(ticket.bookingId, booking.bookingId);
    assert.equal(ticket.showtimeId, harness.showtimeId);
    assert.match(ticket.ticketCode, /^TK-[0-9A-F]{10}$/);
    assert.ok(ticket.qrCode.startsWith(`${QR_PAYLOAD_PREFIX}:${ticket.ticketCode}:`));
    assert.equal(ticket.seat.type, "VIP");
    assert.equal(ticket.seat.unitPrice, 95000);
    assert.equal(ticket.screening.movieTitle, "Dune: Part Two");
    assert.equal(ticket.screening.cinemaName, "F-Cinema Landmark 81");
    assert.equal(ticket.screening.roomName, "IMAX Hall 04");
    assert.equal(ticket.screening.startAt, "2026-10-24T12:30:00.000Z");
    assert.equal(ticket.checkedInAt, null);
  }
  assert.equal(new Set(tickets.map((ticket) => ticket.ticketCode)).size, 2);
  assert.equal(new Set(tickets.map((ticket) => ticket.qrCode)).size, 2);

  const stored = [...harness.ticketRepository.tickets.values()];
  assert.ok(stored.every((ticket) => String(ticket.paymentId) === settled.payment.paymentId));
  assert.ok(stored.every((ticket) => String(ticket.customerAccountId) === harness.ownerId));

  const details = await harness.paymentService.getBookingPaymentDetails({
    bookingId: booking.bookingId,
    ownerId: harness.ownerId,
  });
  assert.equal(details.ticketIssuance.status, "ISSUED");
  assert.equal(details.ticketIssuance.ticketCount, 2);
});

test("duplicate, replayed and concurrent success notifications never create additional tickets", async () => {
  const harness = createInMemoryHarness();
  const { booking, initiated } = await payBooking(harness, "dup");
  const originalIds = (await harness.ticketService.listTicketsForBooking({ bookingId: booking.bookingId }))
    .map((ticket) => ticket.ticketId);

  // Same notification key: the duplicate-callback path.
  const duplicate = await notify(harness, initiated, "notif-dup-success");
  assert.equal(duplicate.duplicateNotification, true);
  // New key on an already PAID payment: the replayed-settlement path.
  const replay = await notify(harness, initiated, "notif-dup-replay");
  assert.equal(replay.payment.status, PAYMENT_STATUS.PAID);

  // Concurrent issuance through the port, as a multi-instance replay would do.
  await Promise.all(
    Array.from({ length: 5 }, () =>
      harness.ticketService.issueTicketsForConfirmedBooking({
        bookingId: booking.bookingId,
        ownerId: harness.ownerId,
      }),
    ),
  );

  const tickets = await harness.ticketService.listTicketsForBooking({ bookingId: booking.bookingId });
  assert.equal(tickets.length, 2);
  assert.deepEqual(tickets.map((ticket) => ticket.ticketId), originalIds);
  assert.equal(harness.ticketRepository.tickets.size, 2);
});

test("no ticket exists before verified success, and late success after expiry issues none", async () => {
  const harness = createInMemoryHarness();
  const { booking, initiated } = await createPendingPayment(harness, "late");

  assert.equal(harness.ticketRepository.tickets.size, 0);
  await assert.rejects(
    () =>
      harness.ticketService.issueTicketsForConfirmedBooking({
        bookingId: booking.bookingId,
        ownerId: harness.ownerId,
      }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, TICKET_ERROR.BOOKING_NOT_CONFIRMED);
      return true;
    },
  );

  harness.advanceTimeMs(11 * 60 * 1000);
  const late = await notify(harness, initiated, "notif-late-success");
  assert.equal(late.payment.status, PAYMENT_STATUS.REVIEW_REQUIRED);
  assert.equal(harness.ticketRepository.tickets.size, 0);

  const details = await harness.paymentService.getBookingPaymentDetails({
    bookingId: booking.bookingId,
    ownerId: harness.ownerId,
  });
  assert.equal(details.ticketIssuance.eligible, false);
  assert.equal(details.ticketIssuance.status, "NOT_ISSUED");
  assert.equal(harness.ticketRepository.tickets.size, 0);
});

test("an issuance failure never fails the verified payment and is completed on the next read", async (t) => {
  t.mock.method(console, "error", () => {});
  const repository = createInMemoryTicketRepository();
  const realInsert = repository.insertMissing;
  let failNext = true;
  repository.insertMissing = async (documents) => {
    if (failNext) {
      failNext = false;
      throw new Error("simulated ticket store outage");
    }
    return realInsert(documents);
  };

  const harness = createInMemoryHarness({ ticketRepository: repository });
  const { booking, settled } = await payBooking(harness, "outage");
  assert.equal(settled.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(repository.tickets.size, 0);

  const details = await harness.paymentService.getBookingPaymentDetails({
    bookingId: booking.bookingId,
    ownerId: harness.ownerId,
  });
  assert.equal(details.ticketIssuance.status, "ISSUED");
  assert.equal(details.ticketIssuance.ticketCount, 2);
  assert.equal(repository.tickets.size, 2);
});

test("check-in status and invalidation ports are idempotent and never rewrite USED tickets", async () => {
  const harness = createInMemoryHarness();
  const { booking } = await payBooking(harness, "ports");

  const before = await harness.ticketService.getCheckInStatusByBooking({ bookingId: booking.bookingId });
  assert.deepEqual(before, {
    bookingId: booking.bookingId,
    ticketCount: 2,
    checkedInCount: 0,
    checkedIn: false,
  });

  // Simulate an Iter3 check-in of the first seat.
  const [first] = await harness.ticketRepository.findByBookingId(booking.bookingId);
  Object.assign(first, { status: TICKET_STATUS.USED, checkedInAt: new Date() });
  const after = await harness.ticketService.getCheckInStatusByBooking({ bookingId: booking.bookingId });
  assert.equal(after.checkedIn, true);
  assert.equal(after.checkedInCount, 1);

  await assert.rejects(
    () => harness.ticketService.invalidateTicketsByBooking({ bookingId: booking.bookingId, reason: " " }),
    TypeError,
  );

  const invalidated = await harness.ticketService.invalidateTicketsByBooking({
    bookingId: booking.bookingId,
    reason: "REFUNDED",
  });
  assert.equal(invalidated.invalidatedCount, 1);
  assert.equal(invalidated.usedCount, 1);
  const voided = invalidated.tickets.find((ticket) => ticket.status === TICKET_STATUS.INVALIDATED);
  assert.equal(voided.qrCode, null);
  assert.equal(voided.invalidationReason, "REFUNDED");
  assert.ok(voided.invalidatedAt);
  assert.equal(
    invalidated.tickets.find((ticket) => ticket.status === TICKET_STATUS.USED).ticketId,
    String(first._id),
  );

  const again = await harness.ticketService.invalidateTicketsByBooking({
    bookingId: booking.bookingId,
    reason: "REFUNDED",
  });
  assert.equal(again.invalidatedCount, 0);
});

test("toTicketDto exposes the QR payload only for an admissible ticket", () => {
  const base = {
    _id: new mongoose.Types.ObjectId(),
    ticketCode: "TK-0000000001",
    qrCode: `${QR_PAYLOAD_PREFIX}:TK-0000000001:secret`,
    bookingId: new mongoose.Types.ObjectId(),
    showtimeId: new mongoose.Types.ObjectId(),
    seatId: new mongoose.Types.ObjectId(),
    seat: { label: "A1" },
    issuedAt: new Date("2026-10-27T00:00:00.000Z"),
  };
  assert.equal(toTicketDto({ ...base, status: TICKET_STATUS.ISSUED }).qrCode, base.qrCode);
  assert.equal(toTicketDto({ ...base, status: TICKET_STATUS.USED }).qrCode, null);
  assert.equal(toTicketDto({ ...base, status: TICKET_STATUS.INVALIDATED }).qrCode, null);
});

test("HTTP ticket routes enforce authentication and BR-36 ownership", async (t) => {
  const previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "ticket-route-test-secret";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  const harness = createInMemoryHarness();
  const { booking } = await payBooking(harness, "http");

  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/api/tickets", createTicketRouter(createTicketController(harness.ticketService)));
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/tickets`;

  const cookieFor = (accountId) =>
    `accessToken=${jwt.sign({ sub: accountId }, process.env.JWT_ACCESS_SECRET)}`;
  const get = async (path, accountId) => {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: accountId ? { Cookie: cookieFor(accountId) } : {},
    });
    return { status: response.status, body: await response.json() };
  };

  const owned = await get(`/bookings/${booking.bookingId}`, harness.ownerId);
  assert.equal(owned.status, 200);
  assert.equal(owned.body.data.bookingStatus, "CONFIRMED");
  assert.equal(owned.body.data.tickets.length, 2);
  assert.ok(owned.body.data.tickets.every((ticket) => ticket.qrCode));
  const [firstTicket] = owned.body.data.tickets;

  const single = await get(`/${firstTicket.ticketId}`, harness.ownerId);
  assert.equal(single.status, 200);
  assert.equal(single.body.data.ticketCode, firstTicket.ticketCode);
  assert.equal(single.body.data.qrCode, firstTicket.qrCode);

  assert.equal((await get(`/bookings/${booking.bookingId}`)).status, 401);
  assert.equal((await get(`/${firstTicket.ticketId}`)).status, 401);

  const foreignList = await get(`/bookings/${booking.bookingId}`, harness.otherOwnerId);
  assert.equal(foreignList.status, 403);
  assert.equal(foreignList.body.code, BOOKING_ERROR.BOOKING_FORBIDDEN);
  assert.equal(foreignList.body.tickets, undefined);

  const foreignTicket = await get(`/${firstTicket.ticketId}`, harness.otherOwnerId);
  assert.equal(foreignTicket.status, 403);
  assert.equal(foreignTicket.body.code, TICKET_ERROR.TICKET_FORBIDDEN);
  assert.equal(foreignTicket.body.data, undefined);

  const missingBooking = await get(`/bookings/${new mongoose.Types.ObjectId()}`, harness.ownerId);
  assert.equal(missingBooking.status, 404);
  assert.equal(missingBooking.body.code, BOOKING_ERROR.BOOKING_NOT_FOUND);

  const missingTicket = await get(`/${new mongoose.Types.ObjectId()}`, harness.ownerId);
  assert.equal(missingTicket.status, 404);
  assert.equal(missingTicket.body.code, TICKET_ERROR.TICKET_NOT_FOUND);

  const invalid = await get("/not-an-id", harness.ownerId);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, TICKET_ERROR.INVALID_TICKET_ID);
});
