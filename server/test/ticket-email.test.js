import assert from "node:assert/strict";
import { test } from "node:test";
import { PAYMENT_METHODS } from "../src/modules/payment/payment.constants.js";
import { createTicketEmailNotifier } from "../src/modules/ticket/ticket-email.notifier.js";
import { createInMemoryHarness } from "./helpers/payment-harness.js";

const flush = () => new Promise((resolve) => setImmediate(resolve));

const payBooking = async (harness, key) => {
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
  const notify = (notificationKey) =>
    harness.paymentService.handlePaymentNotification({
      paymentId: initiated.payment.paymentId,
      attemptId: initiated.activeAttempt.attemptId,
      outcome: "SUCCESS",
      notificationKey,
      actorOwnerId: harness.ownerId,
    });
  await notify(`notif-${key}-success`);
  return { booking, notify };
};

test("issuing a booking's tickets notifies the customer once, even on replayed callbacks and reads", async () => {
  const calls = [];
  const harness = createInMemoryHarness({ notifyTicketsIssued: async (event) => calls.push(event) });
  const { booking, notify } = await payBooking(harness, "mail");
  await flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].booking.bookingId, booking.bookingId);
  assert.equal(calls[0].booking.channel, "ONLINE");
  assert.equal(calls[0].tickets.length, 2);
  assert.ok(calls[0].tickets.every((ticket) => ticket.qrCode));

  await notify("notif-mail-success");
  await notify("notif-mail-replay");
  await harness.paymentService.getBookingPaymentDetails({
    bookingId: booking.bookingId,
    ownerId: harness.ownerId,
  });
  await flush();
  assert.equal(calls.length, 1);
});

test("a failing notification never fails the settled payment or ticket issuance", async () => {
  const harness = createInMemoryHarness({
    notifyTicketsIssued: async () => {
      throw new Error("SMTP down");
    },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    const { booking } = await payBooking(harness, "smtp");
    await flush();
    const tickets = await harness.ticketService.listTicketsForBooking({ bookingId: booking.bookingId });
    assert.equal(tickets.length, 2);
  } finally {
    console.error = originalError;
  }
});

const sampleTicket = (overrides = {}) => ({
  ticketId: "t1",
  ticketCode: "TK-8974D076F0",
  qrCode: "FCINEMA-TICKET:TK-8974D076F0:secret",
  seat: { label: "B4", type: "STANDARD" },
  screening: {
    movieTitle: "Inside Out 2",
    ageRating: "P",
    cinemaName: "F-Cinema Central",
    roomName: "Room 02",
    roomType: "STANDARD",
    startAt: "2026-11-08T10:05:00.000Z",
  },
  ...overrides,
});

test("the ticket email carries one QR PNG and E-Ticket link per admissible ticket", async () => {
  const sent = [];
  const notifier = createTicketEmailNotifier({
    findAccount: async () => ({ email: "customer@example.com", fullName: "Customer" }),
    sendEmail: async (message) => sent.push(message),
    clientUrl: () => "http://localhost:5173/",
  });

  const result = await notifier({
    booking: { bookingId: "b1", bookingCode: "BK-1", channel: "ONLINE", customerAccountId: "a1" },
    tickets: [sampleTicket(), sampleTicket({ ticketId: "t2", ticketCode: "TK-2", qrCode: null })],
  });

  assert.deepEqual(result, { sent: true, ticketCount: 1 });
  assert.equal(sent[0].email, "customer@example.com");
  assert.equal(sent[0].bookingUrl, "http://localhost:5173/bookings/b1/confirmation");
  const [ticket] = sent[0].tickets;
  assert.equal(ticket.ticketUrl, "http://localhost:5173/tickets/t1");
  assert.equal(ticket.date, "08/11/2026");
  assert.equal(ticket.time, "17:05");
  assert.equal(ticket.seatLabel, "B4");
  assert.deepEqual([...ticket.qrPng.subarray(1, 4)].map((code) => String.fromCharCode(code)).join(""), "PNG");
});

test("counter bookings are not emailed because they belong to the selling staff account", async () => {
  let looked = false;
  const notifier = createTicketEmailNotifier({
    findAccount: async () => {
      looked = true;
      return { email: "staff@example.com" };
    },
    sendEmail: async () => assert.fail("must not send"),
  });
  const result = await notifier({
    booking: { bookingId: "b1", channel: "COUNTER", customerAccountId: "staff" },
    tickets: [sampleTicket()],
  });
  assert.deepEqual(result, { sent: false, reason: "COUNTER_BOOKING" });
  assert.equal(looked, false);
});
