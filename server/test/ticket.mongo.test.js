import assert from "node:assert/strict";
import { test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { ensureTicket001Indexes } from "../src/migrations/20261027-ticket-001-indexes.js";
import { TICKET_STATUS } from "../src/modules/ticket/ticket.constants.js";

test("TICKET-001 MongoDB unique indexes, concurrent issuance and fail-closed migration gate", { skip: !process.env.MONGODB_URI }, async (t) => {
  // A fresh, task-specific DB; never touch the configured development database.
  // Atlas caps database names at 38 bytes.
  const dbName = `tkt001_test_${process.pid}_${Date.now().toString(36)}`;
  try {
    configureMongoDns();
    await mongoose.connect(process.env.MONGODB_URI, { dbName, autoIndex: false, serverSelectionTimeoutMS: 10000 });
    const { Ticket } = await import("../src/modules/ticket/ticket.model.js");
    const { createTicketRepository } = await import("../src/modules/ticket/ticket.repository.js");
    const { createTicketService } = await import("../src/modules/ticket/ticket.service.js");

    const ownerId = new mongoose.Types.ObjectId().toString();
    const seatIds = [new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId().toString()];
    const makeBooking = () => ({
      bookingId: new mongoose.Types.ObjectId().toString(),
      customerAccountId: ownerId,
      showtimeId: new mongoose.Types.ObjectId().toString(),
      status: "CONFIRMED",
      seatIds,
      seatLines: seatIds.map((seatId) => ({ seatId, unitPrice: 90000 })),
      seats: [
        { seatId: seatIds[0], label: "C5", row: "C", number: 5, type: "STANDARD", unitPrice: 90000 },
        { seatId: seatIds[1], label: "C6", row: "C", number: 6, type: "STANDARD", unitPrice: 90000 },
      ],
    });
    const bookings = new Map();
    const bookingReader = {
      async getBookingDetails({ bookingId }) {
        const booking = bookings.get(bookingId);
        return { booking, showtime: booking?.showtime ?? null };
      },
    };
    const serviceWith = (repository) => createTicketService({ ticketRepository: repository, bookingReader });

    await t.test("issuance fails closed before the index migration has run", async () => {
      const booking = makeBooking();
      bookings.set(booking.bookingId, booking);
      await assert.rejects(
        () => serviceWith(createTicketRepository()).issueTicketsForConfirmedBooking({ bookingId: booking.bookingId, ownerId }),
        /Ticket indexes are missing/,
      );
      assert.equal(await Ticket.countDocuments({}), 0);
    });

    await t.test("migration reuses the bootstrap ticketCode_1 index and is repeatable", async () => {
      await mongoose.connection.db.collection("tickets").createIndex({ ticketCode: 1 }, { unique: true, name: "ticketCode_1" });
      const first = await ensureTicket001Indexes(mongoose.connection.db);
      const second = await ensureTicket001Indexes(mongoose.connection.db);
      assert.deepEqual(first, ["ticketCode_1", "uniq_ticket_qr_code", "uniq_ticket_booking_seat"]);
      assert.deepEqual(second, first);
    });

    await t.test("concurrent issuance from zero stores exactly one ticket per seat", async () => {
      const booking = makeBooking();
      bookings.set(booking.bookingId, booking);
      // Separate repositories/services stand in for separate server instances.
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          serviceWith(createTicketRepository()).issueTicketsForConfirmedBooking({ bookingId: booking.bookingId, ownerId }),
        ),
      );
      const stored = await Ticket.find({ bookingId: booking.bookingId }).lean();
      assert.equal(stored.length, 2);
      assert.deepEqual(stored.map((ticket) => ticket.seat.label).sort(), ["C5", "C6"]);
      assert.equal(results.reduce((sum, result) => sum + result.newlyIssuedCount, 0), 2);
      for (const result of results) {
        assert.deepEqual(
          result.tickets.map((ticket) => ticket.ticketCode).sort(),
          stored.map((ticket) => ticket.ticketCode).sort(),
        );
      }
    });

    await t.test("database rejects a second ticket for the same booking seat", async () => {
      const [existing] = await Ticket.find({}).lean();
      await assert.rejects(
        () => Ticket.create({ ...existing, _id: undefined, ticketCode: "TK-DUPLICATE01", qrCode: "dup-qr" }),
        (error) => error.code === 11000,
      );
    });

    await t.test("invalidation updates only ISSUED tickets and is repeatable", async () => {
      const booking = makeBooking();
      bookings.set(booking.bookingId, booking);
      const service = serviceWith(createTicketRepository());
      const issued = await service.issueTicketsForConfirmedBooking({ bookingId: booking.bookingId, ownerId });
      await Ticket.updateOne(
        { _id: issued.tickets[0].ticketId },
        { $set: { status: TICKET_STATUS.USED, checkedInAt: new Date() } },
      );

      const first = await service.invalidateTicketsByBooking({ bookingId: booking.bookingId, reason: "REFUNDED" });
      assert.equal(first.invalidatedCount, 1);
      assert.equal(first.usedCount, 1);
      const second = await service.invalidateTicketsByBooking({ bookingId: booking.bookingId, reason: "REFUNDED" });
      assert.equal(second.invalidatedCount, 0);

      const status = await service.getCheckInStatusByBooking({ bookingId: booking.bookingId });
      assert.equal(status.checkedIn, true);
      const statuses = (await Ticket.find({ bookingId: booking.bookingId }).lean()).map((ticket) => ticket.status).sort();
      assert.deepEqual(statuses, [TICKET_STATUS.INVALIDATED, TICKET_STATUS.USED]);
    });

    await t.test("TICKET-101 concurrent check-ins of one ticket admit it once (compare-and-set)", async () => {
      const branchId = new mongoose.Types.ObjectId().toString();
      const booking = {
        ...makeBooking(),
        showtime: {
          status: "PUBLISHED",
          startAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          endAt: new Date(Date.now() + 130 * 60_000).toISOString(),
          cinema: { id: branchId, branchName: "Test Branch" },
        },
      };
      bookings.set(booking.bookingId, booking);
      const issued = await serviceWith(createTicketRepository()).issueTicketsForConfirmedBooking({ bookingId: booking.bookingId, ownerId });
      const code = issued.tickets[0].ticketCode;

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          serviceWith(createTicketRepository()).checkInTicket({
            ticketCode: code,
            staffAccountId: new mongoose.Types.ObjectId().toString(),
            staffBranchId: branchId,
          }),
        ),
      );
      assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
      assert.ok(results.filter(({ status }) => status === "rejected").every(({ reason }) => reason.code === "TICKET_ALREADY_USED"));
      const stored = await Ticket.findOne({ ticketCode: code }).lean();
      assert.equal(stored.status, TICKET_STATUS.USED);
      assert.ok(stored.checkedInAt instanceof Date);
      assert.ok(stored.checkedInBy);
    });
  } finally {
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect();
    }
  }
});
