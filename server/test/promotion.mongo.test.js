import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import mongoose from "mongoose";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { applyPromotionStorage } from "../src/migrations/20261027-promo101.js";
import {
  auditPromotionData,
  assertPromotionStorage,
  PROMOTION_INDEXES,
} from "../src/modules/promotion/promotion.storage.js";
import { createPromotionService } from "../src/modules/promotion/promotion.service.js";
import {
  Voucher,
  VoucherRedemption,
} from "../src/modules/promotion/promotion.model.js";
import { Booking } from "../src/modules/booking/booking.model.js";
import { Payment } from "../src/modules/payment/payment.model.js";
import { ShowtimeSeat } from "../src/modules/booking/showtime-seat.model.js";
import { createBookingRepository } from "../src/modules/booking/booking.repository.js";
import { createBookingService } from "../src/modules/booking/booking.service.js";
import { createBookingVoucherService } from "../src/modules/booking/booking-voucher.service.js";
import { createSeatHoldRepository } from "../src/modules/booking/seat-hold.repository.js";
import { paymentPricingReader } from "../src/modules/payment/payment-pricing.read-service.js";
import { createPaymentRepository } from "../src/modules/payment/payment.repository.js";
import { createPaymentService } from "../src/modules/payment/payment.service.js";
import { createPromotionRouter } from "../src/modules/promotion/promotion.routes.js";
import { createBookingVoucherRouter } from "../src/modules/booking/booking-voucher.routes.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { createRefundService } from "../src/modules/refund/refund.service.js";
import { refundRepository } from "../src/modules/refund/refund.repository.js";
import { mockRefundProvider } from "../src/modules/refund/mock-refund-provider.js";

const oid = () => new mongoose.Types.ObjectId();
test(
  "PROMO-101 isolated Mongo transactions and HTTP authorization",
  { skip: !process.env.MONGODB_URI },
  async (t) => {
    const database = `promo101_test_${process.pid}_${Math.floor(Date.now() / 1000)}_${randomUUID().slice(0, 4)}`;
    let db, server;
    const oldSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = "promo101-isolated-test-key";
    try {
      configureMongoDns();
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName: database,
        autoIndex: false,
        autoCreate: false,
        serverSelectionTimeoutMS: 10000,
      });
      db = mongoose.connection.db;
      assert.equal(db.databaseName, database);
      await applyPromotionStorage(db);
      for (const name of [
        "bookings",
        "payments",
        "seat_holds",
        "showtime_seats",
        "accounts",
        "roles",
        "permissions",
      ])
        await db.createCollection(name);
      await Payment.createIndexes();
      await ShowtimeSeat.createIndexes();
      let now = new Date();
      const clock = () => now;
      const promotion = createPromotionService({ clock });
      const repository = createBookingRepository();
      const holds = createSeatHoldRepository();
      const seatHoldPort = {
        getLiveHoldForBooking: (c) => holds.findLiveForBooking(c),
        consumeHoldForBooking: (c) => holds.consumeForBooking(c),
        expireHoldForBooking: (c) => holds.expireForBooking(c),
      };
      const vouchers = createBookingVoucherService({
        repository,
        promotionPort: promotion,
        seatHoldPort,
        paymentReader: paymentPricingReader,
        clock,
      });
      const bookingService = createBookingService({
        repository,
        promotionPort: promotion,
        seatHoldPort,
        clock,
      });
      bookingService.lockPricingForPayment = vouchers.lockPricingForPayment;
      const paymentService = createPaymentService({
        paymentRepository: createPaymentRepository(),
        bookingService,
        now: clock,
      });
      const manager = oid();
      const campaign = async (usageLimit = 10) => {
        const p = await promotion.createPromotion(
          {
            name: "All cinemas",
            discountValue: 10,
            startDate: new Date(+now - 60000),
            endDate: new Date(+now + 3600000),
            status: "ACTIVE",
          },
          manager,
        );
        const v = await promotion.createVoucher(
          p.id,
          {
            code: `TEN_${randomUUID().slice(0, 8)}`.toUpperCase(),
            usageLimit,
            status: "ACTIVE",
          },
          manager,
        );
        return { p, v };
      };
      const fixture = async (ownerId = oid(), food = 0) => {
        const bookingId = oid(),
          holdId = oid(),
          showtimeId = oid(),
          seatId = oid(),
          expiresAt = new Date(+now + 600000);
        await db
          .collection("bookings")
          .insertOne({
            _id: bookingId,
            customerAccountId: ownerId,
            holdId,
            showtimeId,
            bookingCode: `B-${bookingId}`,
            payableReference: `P-${bookingId}`,
            requestKey: `R-${bookingId}`,
            seatIds: [seatId],
            seatLines: [{ seatId, unitPrice: 200005 }],
            subtotal: 200005,
            concessionAmount: food,
            discountAmount: 0,
            totalAmount: 200005 + food,
            currency: "VND",
            status: "PENDING_PAYMENT",
            bookingTime: now,
            expiresAt,
          });
        await db
          .collection("seat_holds")
          .insertOne({
            _id: holdId,
            ownerId,
            showtimeId,
            seatIds: [seatId],
            status: "ACTIVE",
            expiresAt,
          });
        await db
          .collection("showtime_seats")
          .insertOne({
            showtimeId,
            seatId,
            roomLayoutVersion: 1,
            state: "HELD",
            holdId,
            holdOwnerId: ownerId,
            holdExpiresAt: expiresAt,
          });
        return { bookingId, ownerId, holdId, expiresAt };
      };
      const apply = (f, v, extra = {}) =>
        vouchers.applyVoucher({
          ...f,
          code: v.code,
          requestKey: randomUUID(),
          expectedPricingVersion: 0,
          ...extra,
        });
      await t.test(
        "last global use: simultaneous customers cannot oversubscribe",
        async () => {
          const { v } = await campaign(1);
          const fs = await Promise.all(
            Array.from({ length: 8 }, () => fixture()),
          );
          const results = await Promise.allSettled(fs.map((f) => apply(f, v)));
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const stored = await Voucher.findById(v.id).lean();
          assert.equal(stored.reservedCount, 1);
          assert.equal(stored.usedCount, 0);
        },
      );
      await t.test(
        "one Customer cannot hold same code on two Bookings; unlimited still enforces uniqueness",
        async () => {
          const { v } = await campaign(null);
          const owner = oid();
          const a = await fixture(owner),
            b = await fixture(owner);
          const r = await Promise.allSettled([apply(a, v), apply(b, v)]);
          assert.equal(r.filter((v) => v.status === "fulfilled").length, 1);
          assert.equal(
            r.find((v) => v.status === "rejected").reason.code,
            "VOUCHER_HELD_ELSEWHERE",
          );
        },
      );
      await t.test(
        "idempotent command replay; one code per Booking; invalid replacement rolls back release",
        async () => {
          const { v } = await campaign();
          const f = await fixture(oid(), 80000);
          const key = randomUUID();
          const first = await apply(f, v, { requestKey: key });
          assert.equal(first.amount, 260005);
          assert.equal(first.discountAmount, 20000);
          assert.equal(first.concessionAmount, 80000);
          const replay = await apply(f, v, { requestKey: key });
          assert.equal(replay.idempotent, true);
          await assert.rejects(
            apply(f, { code: "UNKNOWN" }, { expectedPricingVersion: 1 }),
            { code: "VOUCHER_UNAVAILABLE" },
          );
          assert.equal((await Voucher.findById(v.id).lean()).reservedCount, 1);
          await assert.rejects(
            apply(f, { code: "UNKNOWN" }, { requestKey: key }),
            { code: "VOUCHER_REQUEST_KEY_REUSED" },
          );
          await vouchers.removeVoucher({
            ...f,
            requestKey: "remove",
            expectedPricingVersion: 1,
          });
          await apply(f, v, { expectedPricingVersion: 2 });
          await vouchers.removeVoucher({
            ...f,
            requestKey: "remove",
            expectedPricingVersion: 1,
          });
          assert.equal(
            (await Booking.findById(f.bookingId).lean()).discountAmount,
            20000,
          );
          assert.equal(
            await VoucherRedemption.countDocuments({
              bookingId: f.bookingId,
              blocking: true,
            }),
            1,
          );
        },
      );
      await t.test(
        "discount snapshots survive rate edit / disable; consume duplicate once and never release on refund",
        async () => {
          const { p, v } = await campaign();
          const f = await fixture();
          await apply(f, v);
          await promotion.updatePromotion(
            p.id,
            {
              expectedVersion: p.version,
              discountValue: 20,
              status: "INACTIVE",
            },
            manager,
          );
          const vNow = await Voucher.findById(v.id).lean();
          await promotion.updateVoucher(
            v.id,
            { expectedVersion: vNow.version, status: "INACTIVE" },
            manager,
          );
          const paymentId = oid();
          const results = await Promise.all([
            bookingService.confirmBookingAfterVerifiedPayment({
              bookingId: f.bookingId,
              paymentId,
              verifiedAt: now,
            }),
            bookingService.confirmBookingAfterVerifiedPayment({
              bookingId: f.bookingId,
              paymentId,
              verifiedAt: now,
            }),
          ]);
          assert.ok(
            results.every((r) =>
              ["CONFIRMED", "ALREADY_CONFIRMED"].includes(r.outcome),
            ),
          );
          const b = await Booking.findById(f.bookingId).lean();
          assert.equal(b.discountAmount, 20000);
          assert.equal(b.voucherSnapshot.discountValue, 10);
          assert.equal((await Voucher.findById(v.id).lean()).usedCount, 1);
          await repository.withTransaction((session) =>
            promotion.releaseForClosedBooking({
              reservationId: b.voucherSnapshot.reservationId,
              session,
            }),
          );
          await db
            .collection("bookings")
            .updateOne({ _id: b._id }, { $set: { status: "REFUNDED" } });
          assert.equal((await Voucher.findById(v.id).lean()).usedCount, 1);
          // Re-enable only for new claims; the consumed Customer claim remains permanently blocking.
          await promotion.updatePromotion(
            p.id,
            { expectedVersion: 1, status: "ACTIVE" },
            manager,
          );
          const latest = await Voucher.findById(v.id).lean();
          await promotion.updateVoucher(
            v.id,
            { expectedVersion: latest.version, status: "ACTIVE" },
            manager,
          );
          await assert.rejects(apply(await fixture(f.ownerId), v), {
            code: "VOUCHER_ALREADY_USED",
          });
        },
      );
      await t.test(
        "Payment freezes price, failed/cancelled attempts keep reservation, duplicate success consumes once",
        async () => {
          const { v } = await campaign();
          const f = await fixture();
          await apply(f, v);
          const initiated = await paymentService.initiatePayment({
            ...f,
            method: "MOMO_WALLET",
            idempotencyKey: randomUUID(),
          });
          assert.equal(initiated.payment.amount, 180005);
          assert.equal(initiated.activeAttempt.amount, 180005);
          await assert.rejects(
            vouchers.removeVoucher({
              ...f,
              expectedPricingVersion: 1,
              requestKey: "remove-locked",
            }),
            { code: "BOOKING_PRICING_LOCKED" },
          );
          await paymentService.handlePaymentNotification({
            ownerId: f.ownerId,
            paymentId: initiated.payment.paymentId,
            attemptId: initiated.activeAttempt.attemptId,
            outcome: "FAILED",
            notificationKey: randomUUID(),
          });
          assert.equal((await Voucher.findById(v.id).lean()).reservedCount, 1);
          const retry = await paymentService.initiatePayment({
            ...f,
            method: "MOMO_WALLET",
            idempotencyKey: randomUUID(),
          });
          const command = {
            ownerId: f.ownerId,
            paymentId: retry.payment.paymentId,
            attemptId: retry.activeAttempt.attemptId,
            outcome: "SUCCESS",
            notificationKey: "same-notification",
          };
          await paymentService.handlePaymentNotification(command);
          await paymentService.handlePaymentNotification(command);
          assert.equal((await Voucher.findById(v.id).lean()).usedCount, 1);
        },
      );
      await t.test(
        "expiry/cancellation release once; quota reclaims lazily; late success cannot consume released claim",
        async () => {
          const { v } = await campaign(1);
          const f = await fixture();
          await apply(f, v);
          const initiated = await paymentService.initiatePayment({
            ...f,
            method: "MOMO_WALLET",
            idempotencyKey: randomUUID(),
          });
          now = new Date(+f.expiresAt);
          const next = await fixture();
          await apply(next, v);
          const late = await paymentService.handlePaymentNotification({
            ownerId: f.ownerId,
            paymentId: initiated.payment.paymentId,
            attemptId: initiated.activeAttempt.attemptId,
            outcome: "SUCCESS",
            notificationKey: randomUUID(),
          });
          assert.equal(late.payment.status, "REVIEW_REQUIRED");
          assert.equal(
            (await Booking.findById(f.bookingId).lean()).status,
            "EXPIRED",
          );
          await bookingService.cancelPendingCheckout({ ...next });
          await bookingService.cancelPendingCheckout({ ...next });
          const stored = await Voucher.findById(v.id).lean();
          assert.equal(stored.usedCount, 0);
          assert.equal(stored.reservedCount, 0);
        },
      );
      await t.test(
        "apply vs first initiation: frozen payable always matches committed discount",
        async () => {
          const { v } = await campaign();
          const f = await fixture();
          const outcomes = await Promise.allSettled([
            apply(f, v),
            vouchers.lockPricingForPayment(f),
          ]);
          const b = await Booking.findById(f.bookingId).lean();
          assert.ok(b.pricingLockedAt);
          assert.equal(b.totalAmount, 200005 - b.discountAmount);
          const lock = outcomes[1];
          assert.equal(lock.status, "fulfilled");
          assert.equal(lock.value.totalAmount, b.totalAmount);
          await assert.rejects(apply(f, v), { code: "BOOKING_PRICING_LOCKED" });
        },
      );
      await t.test(
        "failed confirmation/expiry writes roll back voucher and seat effects together",
        async () => {
          const { v } = await campaign();
          const f = await fixture();
          await apply(f, v);
          const badConfirm = createBookingService({
            repository: { ...repository, markConfirmed: async () => null },
            seatHoldPort,
            promotionPort: promotion,
            clock,
          });
          await assert.rejects(
            badConfirm.confirmBookingAfterVerifiedPayment({
              bookingId: f.bookingId,
              paymentId: oid(),
              verifiedAt: now,
            }),
          );
          assert.equal((await Voucher.findById(v.id).lean()).usedCount, 0);
          assert.equal((await Voucher.findById(v.id).lean()).reservedCount, 1);
          assert.equal(
            (await VoucherRedemption.findOne({ bookingId: f.bookingId }).lean())
              .state,
            "RESERVED",
          );
          const badExpiry = createBookingService({
            repository: { ...repository, markExpired: async () => null },
            seatHoldPort,
            promotionPort: promotion,
            clock,
          });
          await assert.rejects(badExpiry.cancelPendingCheckout(f));
          assert.equal((await Voucher.findById(v.id).lean()).reservedCount, 1);
          assert.equal(
            (await Booking.findById(f.bookingId).lean()).status,
            "PENDING_PAYMENT",
          );
        },
      );
      await t.test(
        "real refund processing returns net paid amount and preserves consumed quota/Customer claim",
        async () => {
          await db.createCollection("refund_requests");
          await db.createCollection("showtimes");
          const { v } = await campaign();
          const f = await fixture();
          await apply(f, v);
          const initiated = await paymentService.initiatePayment({
            ...f,
            method: "MOMO_WALLET",
            idempotencyKey: randomUUID(),
          });
          await paymentService.handlePaymentNotification({
            paymentId: initiated.payment.paymentId,
            attemptId: initiated.activeAttempt.attemptId,
            actorOwnerId: f.ownerId,
            outcome: "SUCCESS",
            notificationKey: randomUUID(),
          });
          const b = await Booking.findById(f.bookingId).lean();
          await db
            .collection("showtimes")
            .insertOne({
              _id: b.showtimeId,
              startAt: new Date(+now + 7200000),
            });
          const refunds = createRefundService({
            repository: refundRepository,
            provider: mockRefundProvider,
            clock,
          });
          const requested = await refunds.request({
            bookingId: f.bookingId,
            customerAccountId: f.ownerId,
            reason: "Cannot attend",
          });
          assert.equal(requested.refundAmount, 180005);
          await refunds.process({
            refundId: requested.refundId,
            managerId: manager,
          });
          assert.equal(
            (await Booking.findById(f.bookingId).lean()).status,
            "REFUNDED",
          );
          assert.equal((await Voucher.findById(v.id).lean()).usedCount, 1);
          assert.equal(
            (await VoucherRedemption.findOne({ bookingId: f.bookingId }).lean())
              .state,
            "CONSUMED",
          );
          await assert.rejects(apply(await fixture(f.ownerId), v), {
            code: "VOUCHER_ALREADY_USED",
          });
        },
      );
      await t.test(
        "quota edit cannot fall below held+used; wrong owner and expired quotes denied",
        async () => {
          const { v } = await campaign();
          const f = await fixture();
          await apply(f, v);
          await apply(await fixture(), v);
          await assert.rejects(
            promotion.updateVoucher(
              v.id,
              { expectedVersion: 0, usageLimit: 1 },
              manager,
            ),
            { code: "VOUCHER_LIMIT_CONFLICT" },
          );
          await assert.rejects(
            vouchers.quoteVoucher({ ...f, ownerId: oid(), code: v.code }),
            { code: "BOOKING_NOT_FOUND" },
          );
          const b = await fixture();
          now = new Date(+b.expiresAt);
          await assert.rejects(vouchers.quoteVoucher({ ...b, code: v.code }), {
            code: "BOOKING_HOLD_EXPIRED",
          });
        },
      );
      await t.test(
        "missing unique index fails closed and audit rejects incompatible legacy data",
        async () => {
          const [name, , options] = PROMOTION_INDEXES[1];
          await db.collection(name).dropIndex(options.name);
          await assert.rejects(assertPromotionStorage(db), {
            code: "VOUCHER_STORAGE_NOT_READY",
          });
          await applyPromotionStorage(db);
          await db
            .collection("vouchers")
            .insertOne(
              { _id: oid(), code: "legacy", usedCount: 5 },
              { bypassDocumentValidation: true },
            );
          assert.ok((await auditPromotionData(db)).length > 0);
          await assert.rejects(
            applyPromotionStorage(db),
            /Data review required/,
          );
          // Only this exact disposable test database; remove only the fixture just inserted.
          await db.collection("vouchers").deleteOne({ code: "legacy" });
        },
      );
      await t.test(
        "HTTP Manager/Customer/Guest/wrong role/locked/revoked permissions",
        async () => {
          const permissionId = oid(),
            managerRole = oid(),
            customerRole = oid(),
            staffRole = oid();
          await db
            .collection("permissions")
            .insertOne({
              _id: permissionId,
              name: "booking.create",
              description: "Book",
            });
          await db.collection("roles").insertMany([
            { _id: managerRole, name: "MANAGER", permissionIds: [] },
            {
              _id: customerRole,
              name: "CUSTOMER",
              permissionIds: [permissionId],
            },
            { _id: staffRole, name: "STAFF", permissionIds: [permissionId] },
          ]);
          const account = async (role) => {
            const _id = oid();
            await db
              .collection("accounts")
              .insertOne({
                _id,
                username: `u${_id}`,
                email: `${_id}@example.com`,
                status: "ACTIVE",
                roleIds: [role],
                directPermissionIds: [],
                profile: {},
              });
            return _id;
          };
          const m = await account(managerRole),
            c = await account(customerRole),
            s = await account(staffRole);
          const app = express();
          app.use(express.json(), cookieParser());
          app.use("/api", createPromotionRouter(promotion));
          app.use("/api/bookings", createBookingVoucherRouter(vouchers));
          app.use(errorHandler);
          server = app.listen(0, "127.0.0.1");
          await new Promise((resolve) => server.once("listening", resolve));
          const request = async (path, actor, method = "GET", body) => {
            const token = actor
              ? jwt.sign({ sub: String(actor) }, process.env.JWT_ACCESS_SECRET)
              : null;
            const response = await fetch(
              `http://127.0.0.1:${server.address().port}/api${path}`,
              {
                method,
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Cookie: `accessToken=${token}` } : {}),
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
              },
            );
            return { status: response.status, body: await response.json() };
          };
          assert.equal((await request("/promotions")).status, 401);
          assert.equal((await request("/promotions", c)).status, 403);
          assert.equal((await request("/promotions", s)).status, 403);
          assert.equal((await request("/promotions", m)).status, 200);
          const { v } = await campaign();
          const f = await fixture(c);
          const input = {
            code: v.code,
            requestKey: "http",
            expectedPricingVersion: 0,
          };
          assert.equal(
            (await request(`/bookings/${f.bookingId}/voucher`, s, "PUT", input))
              .status,
            403,
          );
          assert.equal(
            (
              await request(`/bookings/${f.bookingId}/voucher`, c, "PUT", {
                ...input,
                amount: 1,
              })
            ).status,
            400,
          );
          assert.equal(
            (await request(`/bookings/${f.bookingId}/voucher`, c, "PUT", input))
              .status,
            200,
          );
          await db
            .collection("roles")
            .updateOne({ _id: customerRole }, { $set: { permissionIds: [] } });
          assert.equal(
            (await request(`/bookings/${f.bookingId}/voucher`, c, "PUT", input))
              .status,
            403,
          );
          await db
            .collection("accounts")
            .updateOne({ _id: m }, { $set: { status: "LOCKED" } });
          assert.equal((await request("/promotions", m)).status, 403);
        },
      );
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (oldSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
      else process.env.JWT_ACCESS_SECRET = oldSecret;
      try {
        if (db) {
          assert.equal(db.databaseName, database);
          assert.match(database, /^promo101_test_\d+_\d+_[a-f0-9-]+$/);
          await db.dropDatabase();
        }
      } finally {
        await mongoose.disconnect();
      }
    }
  },
);
