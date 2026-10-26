import assert from "node:assert/strict";
import { test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { createBookingService } from "../src/modules/booking/booking.service.js";
import { createBookingRepository } from "../src/modules/booking/booking.repository.js";
import { createSeatHoldRepository } from "../src/modules/booking/seat-hold.repository.js";
import {
  createConcessionCheckoutService,
  selectionFingerprint,
} from "../src/modules/concession/checkout.service.js";
import { ensureConcessionCheckoutIndexes } from "../src/migrations/20261025-concession-checkout.js";
import { Booking } from "../src/modules/booking/booking.model.js";
import { createPaymentService } from "../src/modules/payment/payment.service.js";
import { createPaymentRepository } from "../src/modules/payment/payment.repository.js";
import { Payment } from "../src/modules/payment/payment.model.js";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { createConcessionCheckoutRouter } from "../src/modules/concession/checkout.routes.js";
import { createBookingRouter } from "../src/modules/booking/booking.routes.js";
import { createBookingController } from "../src/modules/booking/booking.controller.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";

const oid = () => new mongoose.Types.ObjectId();
test(
  "CON-102 combined checkout on isolated MongoDB",
  { skip: !process.env.MONGODB_URI },
  async (t) => {
    const dbName = `con102_test_${process.pid}_${Date.now()}`;
    let db;
    try {
      configureMongoDns();
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName,
        autoIndex: false,
        autoCreate: false,
        serverSelectionTimeoutMS: 10000,
      });
      db = mongoose.connection.db;
      assert.equal(db.databaseName, dbName);
      for (const name of [
        "bookings",
        "seat_holds",
        "showtime_seats",
        "payments",
        "orders",
        "inventory_reservations",
        "inventories",
        "stock_transactions",
        "concessions",
        "combos",
        "branches",
      ])
        await db.createCollection(name);
      await ensureConcessionCheckoutIndexes(db);
      await Booking.createIndexes();
      await Payment.createIndexes();
      const holdRepo = createSeatHoldRepository();
      const seatHoldPort = {
        getLiveHoldForBooking: (command) =>
          holdRepo.findLiveForBooking(command),
        consumeHoldForBooking: (command) => holdRepo.consumeForBooking(command),
        expireHoldForBooking: (command) => holdRepo.expireForBooking(command),
      };
      const fixture = async (stock = 5) => {
        let current = new Date();
        const branch = oid(),
          owner = oid(),
          item = oid(),
          drink = oid(),
          combo = oid();
        await db.collection("branches").insertOne({
          _id: branch,
          status: "ACTIVE",
          branchName: "Checkout Cinema",
        });
        await db.collection("concessions").insertMany([
          { _id: item, name: "Popcorn", status: "ACTIVE", price: 30000 },
          { _id: drink, name: "Water", status: "ACTIVE", price: 0 },
        ]);
        await db.collection("inventories").insertMany(
          [item, drink].map((concessionId) => ({
            branchId: branch,
            concessionId,
            quantity: stock,
          })),
        );
        await db.collection("combos").insertOne({
          _id: combo,
          name: "Duo",
          price: 50000,
          status: "ACTIVE",
          items: [
            { concessionId: item, quantity: 2 },
            { concessionId: drink, quantity: 1 },
          ],
        });
        const food = createConcessionCheckoutService({
          getLiveHold: seatHoldPort.getLiveHoldForBooking,
          getShowtime: async () => ({
            cinema: { id: String(branch), branchName: "Checkout Cinema" },
          }),
          clock: () => current,
        });
        const booking = createBookingService({
          repository: createBookingRepository(),
          seatHoldPort,
          concessionPort: { ...food, fingerprint: selectionFingerprint },
          clock: () => current,
        });
        const makeHold = async () => {
          const holdId = oid(),
            seat = oid(),
            showtime = oid(),
            expiresAt = new Date(current.getTime() + 60000);
          await db.collection("seat_holds").insertOne({
            _id: holdId,
            ownerId: owner,
            showtimeId: showtime,
            seatIds: [seat],
            status: "ACTIVE",
            expiresAt,
            priceSnapshot: {
              quoteId: "q",
              currency: "VND",
              totalAmount: 90000,
              lines: [{ seatId: seat, unitPrice: 90000 }],
            },
          });
          await db.collection("showtime_seats").insertOne({
            showtimeId: showtime,
            seatId: seat,
            roomLayoutVersion: 1,
            state: "HELD",
            holdId,
            holdOwnerId: owner,
            holdExpiresAt: expiresAt,
            priceSnapshot: 90000,
          });
          return holdId;
        };
        const make = async (
          items = [
            { itemType: "CONCESSION", itemId: String(item), quantity: 1 },
          ],
        ) => {
          const holdId = await makeHold();
          const quote = await food.quote({
            holdId: String(holdId),
            ownerId: String(owner),
            items,
          });
          const command = {
            holdId: String(holdId),
            ownerId: String(owner),
            requestKey: `checkout-${holdId}`,
            concessionSelection: {
              quoteReference: quote.quoteReference,
              items,
            },
          };
          return { holdId, quote, command };
        };
        const stockState = () =>
          db
            .collection("inventories")
            .findOne({ branchId: branch, concessionId: item });
        return {
          branch,
          owner,
          item,
          drink,
          combo,
          food,
          booking,
          make,
          makeHold,
          stockState,
          advance: (ms) => {
            current = new Date(current.getTime() + ms);
          },
          clock: () => current,
        };
      };
      await t.test(
        "quote does not reserve, stock/branch/owner and price are server controlled",
        async () => {
          const f = await fixture();
          const q = await f.make();
          assert.equal(q.quote.amount, 120000);
          assert.equal(q.quote.branchId, String(f.branch));
          assert.equal((await f.stockState()).reservedQuantity, undefined);
          await assert.rejects(
            f.food.quote({
              holdId: String(q.holdId),
              ownerId: String(oid()),
              items: q.command.concessionSelection.items,
            }),
          );
          await db
            .collection("concessions")
            .updateOne({ _id: f.item }, { $set: { price: 40000 } });
          await assert.rejects(
            f.booking.createPendingBookingFromHold(q.command),
            { code: "CONCESSION_QUOTE_CHANGED" },
          );
          assert.equal(
            await db
              .collection("bookings")
              .countDocuments({ holdId: q.holdId }),
            0,
          );
          assert.equal((await f.stockState()).reservedQuantity, undefined);
        },
      );
      await t.test(
        "combined amount, replay, one consume, real Customer SALE and immutable receipt",
        async () => {
          const f = await fixture();
          const q = await f.make();
          const b = await f.booking.createPendingBookingFromHold(q.command);
          assert.equal(b.ticketAmount, 90000);
          assert.equal(b.concessionAmount, 30000);
          assert.equal(b.amount, 120000);
          assert.equal((await f.stockState()).reservedQuantity, 1);
          assert.equal((await f.stockState()).quantity, 5);
          assert.equal(
            (await f.booking.createPendingBookingFromHold(q.command)).bookingId,
            b.bookingId,
          );
          await assert.rejects(
            f.booking.createPendingBookingFromHold({
              ...q.command,
              concessionSelection: undefined,
            }),
            { code: "CONCESSION_REQUEST_KEY_REUSED" },
          );
          const paymentId = oid();
          const command = {
            bookingId: b.bookingId,
            paymentId,
            verifiedAt: f.clock(),
          };
          await Promise.all([
            f.booking.confirmBookingAfterVerifiedPayment(command),
            f.booking.confirmBookingAfterVerifiedPayment(command),
          ]);
          await f.booking.confirmBookingAfterVerifiedPayment(command);
          assert.equal((await f.stockState()).quantity, 4);
          assert.equal((await f.stockState()).reservedQuantity, 0);
          const sale = await db
            .collection("stock_transactions")
            .findOne({ bookingId: new mongoose.Types.ObjectId(b.bookingId) });
          assert.equal(String(sale.recordedBy), String(f.owner));
          assert.equal(sale.source, "ONLINE_CHECKOUT");
          assert.equal(
            await db
              .collection("stock_transactions")
              .countDocuments({ orderId: sale.orderId }),
            1,
          );
          const detail = await f.booking.getCustomerBookingDetails({
            bookingId: b.bookingId,
            ownerId: f.owner,
          });
          assert.equal(
            detail.booking.concessionOrder.pickupStatus,
            "AWAITING_PICKUP",
          );
          assert.equal(detail.booking.concessionOrder.paymentStatus, "PAID");
          await assert.rejects(
            f.booking.cancelPendingCheckout({
              bookingId: b.bookingId,
              ownerId: f.owner,
            }),
          );
        },
      );
      await t.test(
        "last-item race accepts exactly one checkout; other hold remains usable for Skip",
        async () => {
          const f = await fixture(1);
          const a = await f.make(),
            b = await f.make();
          const outcomes = await Promise.allSettled(
            [a, b].map((q) =>
              f.booking.createPendingBookingFromHold(q.command),
            ),
          );
          assert.equal(
            outcomes.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            outcomes.find((r) => r.status === "rejected").reason.code,
            "INSUFFICIENT_CONCESSION_STOCK",
          );
          assert.equal((await f.stockState()).reservedQuantity, 1);
          const loser = outcomes[0].status === "rejected" ? a : b;
          const ticket = await f.booking.createPendingBookingFromHold({
            ...loser.command,
            concessionSelection: undefined,
          });
          assert.equal(ticket.amount, 90000);
          assert.equal(ticket.concessionOrder, undefined);
        },
      );
      await t.test(
        "aggregate loose item + combo demand and rollback all components on shortage",
        async () => {
          const f = await fixture(4);
          const items = [
            { itemType: "COMBO", itemId: String(f.combo), quantity: 1 },
            { itemType: "CONCESSION", itemId: String(f.item), quantity: 2 },
          ];
          const q = await f.make(items);
          await db
            .collection("inventories")
            .updateOne(
              { branchId: f.branch, concessionId: f.drink },
              { $set: { quantity: 0 } },
            );
          await assert.rejects(
            f.booking.createPendingBookingFromHold(q.command),
            { code: "INSUFFICIENT_CONCESSION_STOCK" },
          );
          assert.equal((await f.stockState()).reservedQuantity, undefined);
          assert.equal(
            await db
              .collection("orders")
              .countDocuments({ branchId: f.branch }),
            0,
          );
          await db
            .collection("inventories")
            .updateOne(
              { branchId: f.branch, concessionId: f.drink },
              { $inc: { quantity: 1 } },
            );
          const b = await f.booking.createPendingBookingFromHold(q.command);
          assert.equal(b.amount, 200000);
          assert.equal((await f.stockState()).reservedQuantity, 4);
        },
      );
      await t.test(
        "explicit cancellation is owner-only and releases seats/stock idempotently",
        async () => {
          const f = await fixture();
          const q = await f.make();
          const b = await f.booking.createPendingBookingFromHold(q.command);
          await assert.rejects(
            f.booking.cancelPendingCheckout({
              bookingId: b.bookingId,
              ownerId: oid(),
            }),
            { statusCode: 403 },
          );
          await f.booking.cancelPendingCheckout({
            bookingId: b.bookingId,
            ownerId: f.owner,
          });
          await f.booking.cancelPendingCheckout({
            bookingId: b.bookingId,
            ownerId: f.owner,
          });
          assert.equal((await f.stockState()).reservedQuantity, 0);
          assert.equal((await f.stockState()).quantity, 5);
          assert.equal(
            (await db.collection("seat_holds").findOne({ _id: q.holdId }))
              .status,
            "EXPIRED",
          );
          assert.equal(
            (
              await db.collection("orders").findOne({
                bookingId: new mongoose.Types.ObjectId(b.bookingId),
              })
            ).status,
            "EXPIRED",
          );
        },
      );
      await t.test(
        "boundary expiry releases food and late success never consumes or sells seats",
        async () => {
          const f = await fixture();
          const q = await f.make();
          const b = await f.booking.createPendingBookingFromHold(q.command);
          f.advance(60000);
          const result = await f.booking.confirmBookingAfterVerifiedPayment({
            bookingId: b.bookingId,
            paymentId: oid(),
            verifiedAt: f.clock(),
          });
          assert.equal(result.outcome, "EXPIRED_REVIEW_REQUIRED");
          assert.equal((await f.stockState()).reservedQuantity, 0);
          assert.equal((await f.stockState()).quantity, 5);
          assert.equal(
            await db
              .collection("stock_transactions")
              .countDocuments({ branchId: f.branch }),
            0,
          );
        },
      );
      await t.test(
        "mock Payment charges combined server total, failed attempt retains stock, retry settles once",
        async () => {
          const f = await fixture();
          const q = await f.make();
          const b = await f.booking.createPendingBookingFromHold(q.command);
          const payment = createPaymentService({
            paymentRepository: createPaymentRepository(),
            bookingService: f.booking,
            now: f.clock,
          });
          const p = await payment.initiatePayment({
            bookingId: b.bookingId,
            ownerId: String(f.owner),
            method: "MOMO_WALLET",
            idempotencyKey: `pay-${b.bookingId}`,
            amount: b.amount,
          });
          assert.equal(p.payment.amount, 120000);
          await payment.handlePaymentNotification({
            paymentId: p.payment.paymentId,
            attemptId: p.activeAttempt.attemptId,
            outcome: "FAILED",
            notificationKey: "first-failed",
          });
          assert.equal((await f.stockState()).reservedQuantity, 1);
          const retry = await payment.initiatePayment({
            bookingId: b.bookingId,
            ownerId: String(f.owner),
            method: "MOMO_WALLET",
            idempotencyKey: `retry-${b.bookingId}`,
            amount: b.amount,
          });
          await payment.handlePaymentNotification({
            paymentId: retry.payment.paymentId,
            attemptId: retry.activeAttempt.attemptId,
            outcome: "SUCCESS",
            notificationKey: "second-success",
          });
          assert.equal((await f.stockState()).quantity, 4);
          const detail = await payment.getBookingPaymentDetails({
            bookingId: b.bookingId,
            ownerId: String(f.owner),
          });
          assert.equal(detail.payment.status, "PAID");
          assert.equal(detail.booking.concessionOrder.status, "CONFIRMED");
        },
      );
      await t.test(
        "expired counters are reconciled before reuse; free food still reserves and is audited",
        async () => {
          const f = await fixture(1);
          const a = await f.make();
          await f.booking.createPendingBookingFromHold(a.command);
          f.advance(60000);
          const next = await f.make([
            { itemType: "CONCESSION", itemId: String(f.drink), quantity: 1 },
          ]);
          const b = await f.booking.createPendingBookingFromHold(next.command);
          assert.equal(b.amount, 90000);
          assert.equal(b.concessionAmount, 0);
          assert.equal((await f.stockState()).reservedQuantity, 0);
          await f.booking.confirmBookingAfterVerifiedPayment({
            bookingId: b.bookingId,
            paymentId: oid(),
            verifiedAt: f.clock(),
          });
          assert.equal(
            (
              await db
                .collection("inventories")
                .findOne({ branchId: f.branch, concessionId: f.drink })
            ).quantity,
            0,
          );
        },
      );
      await t.test(
        "late mock success is REVIEW_REQUIRED with no food fulfillment",
        async () => {
          const f = await fixture();
          const q = await f.make();
          const b = await f.booking.createPendingBookingFromHold(q.command);
          const payment = createPaymentService({
            paymentRepository: createPaymentRepository(),
            bookingService: f.booking,
            now: f.clock,
          });
          const p = await payment.initiatePayment({
            bookingId: b.bookingId,
            ownerId: String(f.owner),
            method: "MOMO_WALLET",
            idempotencyKey: `late-${b.bookingId}`,
          });
          f.advance(60000);
          const result = await payment.handlePaymentNotification({
            paymentId: p.payment.paymentId,
            attemptId: p.activeAttempt.attemptId,
            outcome: "SUCCESS",
            notificationKey: "late-success",
          });
          assert.equal(result.payment.status, "REVIEW_REQUIRED");
          assert.equal((await f.stockState()).quantity, 5);
          assert.equal((await f.stockState()).reservedQuantity, 0);
          const detail = await payment.getBookingPaymentDetails({
            bookingId: b.bookingId,
            ownerId: String(f.owner),
          });
          assert.equal(
            detail.booking.concessionOrder.pickupStatus,
            "NOT_READY",
          );
        },
      );
      await t.test(
        "HTTP default-deny, Customer-only, strict input and linked cancellation",
        async () => {
          const f = await fixture();
          const q = await f.make();
          const grant = oid(),
            customer = oid(),
            staff = oid(),
            staffAccount = oid(),
            noGrant = oid();
          await db
            .collection("permissions")
            .insertOne({ _id: grant, name: "booking.create" });
          await db.collection("roles").insertMany([
            { _id: customer, name: "CUSTOMER", permissionIds: [grant] },
            { _id: staff, name: "STAFF", permissionIds: [grant] },
          ]);
          await db.collection("accounts").insertMany([
            { _id: f.owner, status: "ACTIVE", roleIds: [customer] },
            { _id: staffAccount, status: "ACTIVE", roleIds: [staff] },
            { _id: noGrant, status: "ACTIVE", roleIds: [] },
          ]);
          const app = express();
          app.use(express.json(), cookieParser());
          app.use("/quote", createConcessionCheckoutRouter(f.food));
          app.use(
            "/bookings",
            createBookingRouter(createBookingController(f.booking)),
          );
          app.use(errorHandler);
          const listener = await new Promise((resolve) => {
            const s = app.listen(0, "127.0.0.1", () => resolve(s));
          });
          const request = async (path, body, owner) => {
            const res = await fetch(
              `http://127.0.0.1:${listener.address().port}${path}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(owner
                    ? {
                        Cookie: `accessToken=${jwt.sign({ sub: String(owner) }, process.env.JWT_ACCESS_SECRET)}`,
                      }
                    : {}),
                },
                body: JSON.stringify(body),
              },
            );
            return { status: res.status, body: await res.json() };
          };
          try {
            const input = {
              holdId: String(q.holdId),
              items: q.command.concessionSelection.items,
            };
            assert.equal((await request("/quote/quote", input)).status, 401);
            assert.equal(
              (await request("/quote/quote", input, noGrant)).status,
              403,
            );
            assert.equal(
              (await request("/quote/quote", input, staffAccount)).status,
              403,
            );
            assert.equal(
              (
                await request(
                  "/quote/quote",
                  { ...input, branchId: String(f.branch) },
                  f.owner,
                )
              ).status,
              400,
            );
            assert.equal(
              (
                await request(
                  "/quote/quote",
                  { ...input, items: [...input.items, ...input.items] },
                  f.owner,
                )
              ).status,
              400,
            );
            const result = await request("/quote/quote", input, f.owner);
            assert.equal(result.status, 200);
            assert.equal(result.body.data.ownerId, undefined);
            assert.equal(result.body.data.requirements, undefined);
            const { ownerId, ...command } = q.command;
            void ownerId;
            assert.equal(
              (await request("/bookings", command, staffAccount)).status,
              403,
            );
            const created = await request("/bookings", command, f.owner);
            assert.equal(created.status, 201);
            assert.equal(
              (
                await request(
                  `/bookings/${created.body.data.bookingId}/cancel-checkout`,
                  {},
                  f.owner,
                )
              ).status,
              200,
            );
            assert.equal((await f.stockState()).reservedQuantity, 0);
          } finally {
            await new Promise((resolve) => listener.close(resolve));
          }
        },
      );
      await t.test(
        "changed recipe and inactive products cannot reuse a signed quote",
        async () => {
          const f = await fixture();
          const q = await f.make([
            { itemType: "COMBO", itemId: String(f.combo), quantity: 1 },
          ]);
          await db
            .collection("combos")
            .updateOne({ _id: f.combo }, { $set: { "items.0.quantity": 3 } });
          await assert.rejects(
            f.booking.createPendingBookingFromHold(q.command),
            { code: "CONCESSION_QUOTE_CHANGED" },
          );
          await db
            .collection("concessions")
            .updateOne({ _id: f.item }, { $set: { status: "INACTIVE" } });
          await assert.rejects(
            f.food.quote({
              ownerId: f.owner,
              holdId: String(q.holdId),
              items: q.command.concessionSelection.items,
            }),
          );
          assert.equal((await f.stockState()).reservedQuantity, undefined);
        },
      );
      await t.test(
        "failed Booking cancellation rolls back food release and seat release together",
        async () => {
          const f = await fixture(),
            q = await f.make();
          const b = await f.booking.createPendingBookingFromHold(q.command);
          const faulty = createBookingService({
            repository: {
              ...createBookingRepository(),
              markExpired: async () => null,
            },
            seatHoldPort,
            concessionPort: { ...f.food, fingerprint: selectionFingerprint },
            clock: f.clock,
          });
          await assert.rejects(
            faulty.cancelPendingCheckout({
              bookingId: b.bookingId,
              ownerId: f.owner,
            }),
          );
          assert.equal((await f.stockState()).reservedQuantity, 1);
          assert.equal(
            (await db.collection("seat_holds").findOne({ _id: q.holdId }))
              .status,
            "ACTIVE",
          );
          assert.equal(
            (
              await db
                .collection("orders")
                .findOne({
                  bookingId: new mongoose.Types.ObjectId(b.bookingId),
                })
            ).status,
            "PENDING_PAYMENT",
          );
        },
      );
      await t.test(
        "missing rollout indexes block only food, leaving Skip/ticket-only checkout usable",
        async () => {
          const f = await fixture(),
            q = await f.make();
          await db
            .collection("stock_transactions")
            .dropIndex("uniq_online_order_sale");
          try {
            await assert.rejects(
              f.food.quote({
                ownerId: f.owner,
                holdId: String(q.holdId),
                items: q.command.concessionSelection.items,
              }),
              { statusCode: 503 },
            );
            await assert.rejects(
              f.booking.createPendingBookingFromHold(q.command),
              { statusCode: 503 },
            );
            const ticket = await f.booking.createPendingBookingFromHold({
              ...q.command,
              concessionSelection: undefined,
            });
            assert.equal(ticket.amount, 90000);
            assert.equal(ticket.concessionOrder, undefined);
            assert.equal((await f.stockState()).reservedQuantity, undefined);
          } finally {
            await ensureConcessionCheckoutIndexes(db);
          }
        },
      );
    } finally {
      if (db && db.databaseName === dbName && dbName.startsWith("con102_test_"))
        await db.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
