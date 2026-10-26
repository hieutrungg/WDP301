import assert from "node:assert/strict";
import { test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { Booking } from "../src/modules/booking/booking.model.js";
import { SeatHold } from "../src/modules/booking/seat-hold.model.js";
import { ShowtimeSeat } from "../src/modules/booking/showtime-seat.model.js";
import { createBookingRepository } from "../src/modules/booking/booking.repository.js";
import { createSeatHoldRepository } from "../src/modules/booking/seat-hold.repository.js";
import { createBookingService } from "../src/modules/booking/booking.service.js";
import { createPaymentRepository } from "../src/modules/payment/payment.repository.js";
import { createPaymentService } from "../src/modules/payment/payment.service.js";
import { Payment } from "../src/modules/payment/payment.model.js";

const oid = () => new mongoose.Types.ObjectId();

test(
  "BOOK-010 lifecycle transactions on isolated MongoDB",
  { skip: !process.env.MONGODB_URI },
  async (t) => {
    const dbName = `book010_test_${process.pid}_${Date.now()}`;
    let db;
    try {
      configureMongoDns();
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName,
        autoCreate: false,
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
      });
      db = mongoose.connection.db;
      assert.equal(db.databaseName, dbName);
      for (const name of [
        "bookings",
        "seat_holds",
        "showtime_seats",
        "payments",
      ])
        await db.createCollection(name);
      await ShowtimeSeat.createIndexes();
      await Payment.createIndexes();
      const baseRepository = createBookingRepository();
      const holdRepository = createSeatHoldRepository();
      const seatHoldPort = {
        getLiveHoldForBooking: (command) =>
          holdRepository.findLiveForBooking(command),
        consumeHoldForBooking: (command) =>
          holdRepository.consumeForBooking(command),
        expireHoldForBooking: (command) =>
          holdRepository.expireForBooking(command),
      };
      const fixture = async () => {
        const now = new Date("2026-10-24T05:00:00Z");
        const expiresAt = new Date(now.getTime() + 60000);
        const bookingId = oid(),
          holdId = oid(),
          ownerId = oid(),
          showtimeId = oid(),
          paymentId = oid();
        const seatIds = [oid(), oid()];
        await db.collection("bookings").insertOne({
          _id: bookingId,
          holdId,
          customerAccountId: ownerId,
          showtimeId,
          paymentId: undefined,
          bookingCode: `B-${bookingId}`,
          payableReference: `P-${bookingId}`,
          requestKey: `R-${bookingId}`,
          seatIds,
          seatLines: seatIds.map((seatId) => ({ seatId, unitPrice: 90000 })),
          currency: "VND",
          subtotal: 180000,
          totalAmount: 180000,
          discountAmount: 0,
          status: "PENDING_PAYMENT",
          bookingTime: now,
          expiresAt,
        });
        await db.collection("seat_holds").insertOne({
          _id: holdId,
          ownerId,
          showtimeId,
          seatIds,
          status: "ACTIVE",
          expiresAt,
        });
        await db.collection("showtime_seats").insertMany(
          seatIds.map((seatId) => ({
            _id: oid(),
            showtimeId,
            seatId,
            roomLayoutVersion: 1,
            state: "HELD",
            holdId,
            holdOwnerId: ownerId,
            holdExpiresAt: expiresAt,
          })),
        );
        const service = (repository = baseRepository, port = seatHoldPort) =>
          createBookingService({
            repository,
            seatHoldPort: port,
            clock: () => now,
          });
        const command = { bookingId, paymentId, verifiedAt: now };
        const read = async () => ({
          booking: await Booking.findById(bookingId).lean(),
          hold: await SeatHold.findById(holdId).lean(),
          seats: await ShowtimeSeat.find({ showtimeId })
            .sort({ seatId: 1 })
            .lean(),
        });
        return {
          now,
          expiresAt,
          bookingId,
          holdId,
          ownerId,
          showtimeId,
          paymentId,
          seatIds,
          service,
          command,
          read,
        };
      };
      await t.test(
        "verified success consumes all seats atomically; duplicate and concurrent calls are idempotent",
        async () => {
          const f = await fixture();
          const results = await Promise.all([
            f.service().confirmBookingAfterVerifiedPayment(f.command),
            f.service().confirmBookingAfterVerifiedPayment(f.command),
          ]);
          assert.deepEqual(results.map((r) => r.outcome).sort(), [
            "ALREADY_CONFIRMED",
            "CONFIRMED",
          ]);
          const state = await f.read();
          assert.equal(state.booking.status, "CONFIRMED");
          assert.equal(String(state.booking.paymentId), String(f.paymentId));
          assert.equal(state.hold.status, "CONSUMED");
          assert.ok(
            state.seats.every(
              (s) =>
                s.state === "SOLD" &&
                String(s.bookingId) === String(f.bookingId),
            ),
          );
          const afterExpiry = await f
            .service()
            .confirmBookingAfterVerifiedPayment({
              ...f.command,
              verifiedAt: new Date(f.expiresAt.getTime() + 1),
            });
          assert.equal(afterExpiry.outcome, "ALREADY_CONFIRMED");
          await assert.rejects(
            f.service().confirmBookingAfterVerifiedPayment({
              ...f.command,
              paymentId: oid(),
            }),
            { code: "BOOKING_HOLD_NOT_AVAILABLE" },
          );
          assert.equal(
            (await f.read()).booking.confirmedAt.getTime(),
            state.booking.confirmedAt.getTime(),
          );
        },
      );
      await t.test(
        "success at exact expiry and after expiry never confirms or sells seats",
        async () => {
          for (const offset of [0, 1]) {
            const f = await fixture();
            const command = {
              ...f.command,
              verifiedAt: new Date(f.expiresAt.getTime() + offset),
            };
            assert.equal(
              (await f.service().confirmBookingAfterVerifiedPayment(command))
                .outcome,
              "EXPIRED_REVIEW_REQUIRED",
            );
            assert.equal(
              (await f.service().confirmBookingAfterVerifiedPayment(command))
                .outcome,
              "EXPIRED_REVIEW_REQUIRED",
            );
            const state = await f.read();
            assert.equal(state.booking.status, "EXPIRED");
            assert.equal(state.hold.status, "EXPIRED");
            assert.ok(
              state.seats.every(
                (s) => s.state === "AVAILABLE" && !s.holdId && !s.bookingId,
              ),
            );
            assert.equal(state.booking.confirmedAt, undefined);
          }
        },
      );
      await t.test(
        "failed multi-seat consumption rolls back partial SOLD writes before expiring; another owner is untouched",
        async () => {
          const f = await fixture();
          const anotherHold = oid();
          await ShowtimeSeat.updateOne(
            { showtimeId: f.showtimeId, seatId: f.seatIds[1] },
            { $set: { holdId: anotherHold, holdOwnerId: oid() } },
          );
          assert.equal(
            (await f.service().confirmBookingAfterVerifiedPayment(f.command))
              .outcome,
            "EXPIRED_REVIEW_REQUIRED",
          );
          const state = await f.read();
          assert.equal(state.booking.status, "EXPIRED");
          assert.equal(state.hold.status, "EXPIRED");
          assert.equal(state.seats.filter((s) => s.state === "SOLD").length, 0);
          assert.equal(
            state.seats.find((s) => String(s.holdId) === String(anotherHold))
              .state,
            "HELD",
          );
          assert.equal(
            state.seats.filter((s) => s.state === "AVAILABLE").length,
            1,
          );
        },
      );
      await t.test(
        "failed Booking confirmation write rolls back the consumed hold and all sold claims",
        async () => {
          const f = await fixture();
          const repository = {
            ...baseRepository,
            markConfirmed: async () => null,
          };
          await assert.rejects(
            f.service(repository).confirmBookingAfterVerifiedPayment(f.command),
            { code: "BOOKING_HOLD_NOT_AVAILABLE" },
          );
          const state = await f.read();
          assert.equal(state.booking.status, "PENDING_PAYMENT");
          assert.equal(state.hold.status, "ACTIVE");
          assert.ok(
            state.seats.every((s) => s.state === "HELD" && !s.bookingId),
          );
        },
      );
      await t.test(
        "customer read expires the Booking and releases its hold in one transaction; repeats are stable",
        async () => {
          const f = await fixture();
          f.now.setTime(f.expiresAt.getTime());
          const command = { bookingId: f.bookingId, ownerId: f.ownerId };
          assert.equal(
            (await f.service().getCustomerBookingDetails(command)).booking
              .status,
            "EXPIRED",
          );
          assert.equal(
            (await f.service().getCustomerBookingDetails(command)).booking
              .status,
            "EXPIRED",
          );
          const state = await f.read();
          assert.equal(state.hold.status, "EXPIRED");
          assert.ok(state.seats.every((s) => s.state === "AVAILABLE"));
        },
      );
      await t.test(
        "failed expiry write rolls back released seats instead of returning an invented EXPIRED state",
        async () => {
          const f = await fixture();
          f.now.setTime(f.expiresAt.getTime());
          await assert.rejects(
            f
              .service({ ...baseRepository, markExpired: async () => null })
              .getCustomerBookingDetails({
                bookingId: f.bookingId,
                ownerId: f.ownerId,
              }),
            { code: "BOOKING_HOLD_NOT_AVAILABLE" },
          );
          const state = await f.read();
          assert.equal(state.booking.status, "PENDING_PAYMENT");
          assert.equal(state.hold.status, "ACTIVE");
          assert.ok(state.seats.every((s) => s.state === "HELD"));
        },
      );
      await t.test(
        "expiry read reloads under the transaction and preserves a concurrently confirmed Booking",
        async () => {
          const f = await fixture();
          const verifiedAt = new Date(f.now);
          f.now.setTime(f.expiresAt.getTime());
          let firstRead = true;
          const repository = {
            ...baseRepository,
            findById: async (...args) => {
              const snapshot = await baseRepository.findById(...args);
              if (firstRead) {
                firstRead = false;
                await f.service().confirmBookingAfterVerifiedPayment({
                  ...f.command,
                  verifiedAt,
                });
              }
              return snapshot;
            },
          };
          assert.equal(
            (
              await f.service(repository).getCustomerBookingDetails({
                bookingId: f.bookingId,
                ownerId: f.ownerId,
              })
            ).booking.status,
            "CONFIRMED",
          );
          assert.ok((await f.read()).seats.every((s) => s.state === "SOLD"));
        },
      );
      await t.test(
        "missing dependencies, unverified payment input and unexpected hold results fail closed",
        async () => {
          const f = await fixture();
          await assert.rejects(
            f
              .service({ ...baseRepository, withTransaction: undefined })
              .confirmBookingAfterVerifiedPayment(f.command),
            TypeError,
          );
          await assert.rejects(
            f.service().confirmBookingAfterVerifiedPayment({
              ...f.command,
              paymentId: undefined,
            }),
            TypeError,
          );
          await assert.rejects(
            f.service().confirmBookingAfterVerifiedPayment({
              ...f.command,
              verifiedAt: "invalid",
            }),
            TypeError,
          );
          await assert.rejects(
            f
              .service(baseRepository, {
                ...seatHoldPort,
                consumeHoldForBooking: async () => undefined,
              })
              .confirmBookingAfterVerifiedPayment(f.command),
            { code: "BOOKING_HOLD_NOT_AVAILABLE" },
          );
          assert.equal((await f.read()).booking.status, "PENDING_PAYMENT");
          await assert.rejects(
            f.service().getCustomerBookingDetails({
              bookingId: f.bookingId,
              ownerId: oid(),
            }),
            { code: "BOOKING_FORBIDDEN" },
          );
        },
      );
      await t.test(
        "external transaction failure escapes and aborts all partial seat writes",
        async () => {
          const f = await fixture();
          await ShowtimeSeat.deleteOne({
            showtimeId: f.showtimeId,
            seatId: f.seatIds[1],
          });
          await assert.rejects(
            baseRepository.withTransaction((session) =>
              f
                .service()
                .confirmBookingAfterVerifiedPayment({ ...f.command, session }),
            ),
          );
          const state = await f.read();
          assert.equal(state.booking.status, "PENDING_PAYMENT");
          assert.equal(state.hold.status, "ACTIVE");
          assert.equal(state.seats[0].state, "HELD");
        },
      );
      await t.test(
        "real Payment integration confirms verified success and routes late success to review, without issuing tickets",
        async () => {
          for (const late of [false, true]) {
            const f = await fixture();
            const service = createPaymentService({
              paymentRepository: createPaymentRepository(),
              bookingService: f.service(),
              now: () => f.now,
            });
            const initiated = await service.initiatePayment({
              bookingId: f.bookingId,
              ownerId: f.ownerId,
              method: "MOMO_WALLET",
              idempotencyKey: `pay-${f.bookingId}`,
            });
            if (late) f.now.setTime(f.expiresAt.getTime());
            const command = {
              paymentId: initiated.payment.paymentId,
              attemptId: initiated.activeAttempt.attemptId,
              actorOwnerId: f.ownerId,
              outcome: "SUCCESS",
              notificationKey: `notify-${f.bookingId}`,
            };
            const settled = await service.handlePaymentNotification(command);
            assert.equal(
              settled.booking.status,
              late ? "EXPIRED" : "CONFIRMED",
            );
            assert.equal(
              settled.payment.status,
              late ? "REVIEW_REQUIRED" : "PAID",
            );
            const duplicate = await service.handlePaymentNotification(command);
            assert.equal(duplicate.idempotent, true);
            assert.equal(duplicate.booking.status, settled.booking.status);
            assert.ok(
              (await f.read()).seats.every(
                (s) => s.state === (late ? "AVAILABLE" : "SOLD"),
              ),
            );
          }
          assert.equal(await db.collection("tickets").countDocuments(), 0);
        },
      );
      await t.test(
        "competing expiry and confirmation transactions leave Booking, hold and seats consistent",
        async () => {
          const f = await fixture();
          const verifiedAt = new Date(f.now);
          f.now.setTime(f.expiresAt.getTime());
          const [confirmation] = await Promise.all([
            f
              .service()
              .confirmBookingAfterVerifiedPayment({ ...f.command, verifiedAt }),
            f
              .service()
              .getCustomerBookingDetails({
                bookingId: f.bookingId,
                ownerId: f.ownerId,
              }),
          ]);
          const state = await f.read();
          if (state.booking.status === "CONFIRMED") {
            assert.ok(
              ["CONFIRMED", "ALREADY_CONFIRMED"].includes(confirmation.outcome),
            );
            assert.equal(state.hold.status, "CONSUMED");
            assert.ok(state.seats.every((seat) => seat.state === "SOLD"));
          } else {
            assert.equal(state.booking.status, "EXPIRED");
            assert.equal(confirmation.outcome, "EXPIRED_REVIEW_REQUIRED");
            assert.equal(state.hold.status, "EXPIRED");
            assert.ok(state.seats.every((seat) => seat.state === "AVAILABLE"));
          }
        },
      );
      await t.test(
        "unknown Booking states cannot become CONFIRMED",
        async () => {
          const f = await fixture();
          await db
            .collection("bookings")
            .updateOne(
              { _id: f.bookingId },
              { $set: { status: "LEGACY_UNKNOWN" } },
            );
          await assert.rejects(
            f.service().confirmBookingAfterVerifiedPayment(f.command),
            { code: "BOOKING_HOLD_NOT_AVAILABLE" },
          );
          assert.equal((await f.read()).hold.status, "ACTIVE");
        },
      );
    } finally {
      try {
        if (db?.databaseName === dbName && dbName.startsWith("book010_test_"))
          await db.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  },
);
