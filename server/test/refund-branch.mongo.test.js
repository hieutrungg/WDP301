import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { createRefundController } from "../src/modules/refund/refund.controller.js";
import { refundRepository } from "../src/modules/refund/refund.repository.js";
import { createRefundRouter } from "../src/modules/refund/refund.routes.js";
import { createRefundService } from "../src/modules/refund/refund.service.js";
import showtimeRoutes from "../src/modules/showtime/showtime.routes.js";

const oid = () => new mongoose.Types.ObjectId();

test(
  "Manager refund APIs enforce the booking's cinema",
  { skip: !process.env.MONGODB_URI },
  async () => {
    const database = `refund_test_${process.pid}_${randomUUID().slice(0, 8)}`;
    const previousSecret = process.env.JWT_ACCESS_SECRET;
    const secret = "refund-branch-integration-secret";
    process.env.JWT_ACCESS_SECRET = secret;
    let db;
    let server;
    try {
      configureMongoDns();
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName: database,
        autoCreate: false,
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
      });
      db = mongoose.connection.db;
      assert.equal(db.databaseName, database);

      const branchA = oid(),
        branchB = oid();
      const roomA = oid(),
        roomB = oid();
      const showtimeA = oid(),
        showtimeB = oid();
      const permission = oid(),
        cancelPermission = oid(),
        role = oid();
      const managerA = oid(),
        managerB = oid(),
        unassigned = oid();
      const accounts = db.collection("accounts");
      await Promise.all([
        db.collection("permissions").insertMany([
          { _id: permission, name: "refund.manage" },
          { _id: cancelPermission, name: "showtime.cancel" },
        ]),
        db.collection("roles").insertOne({
          _id: role,
          name: "MANAGER",
          permissionIds: [permission, cancelPermission],
        }),
        accounts.insertMany([
          {
            _id: managerA,
            status: "ACTIVE",
            roleIds: [role],
            employeeProfile: { branchId: branchA },
          },
          {
            _id: managerB,
            status: "ACTIVE",
            roleIds: [role],
            employeeProfile: { branchId: branchB },
          },
          { _id: unassigned, status: "ACTIVE", roleIds: [role] },
        ]),
        db.collection("rooms").insertMany([
          { _id: roomA, branchId: branchA },
          { _id: roomB, branchId: branchB },
        ]),
        db.collection("showtimes").insertMany([
          { _id: showtimeA, roomId: roomA },
          { _id: showtimeB, roomId: roomB },
        ]),
        db.createCollection("showtime_seats"),
        db.createCollection("orders"),
      ]);

      const bookings = [],
        payments = [],
        refunds = [];
      const addRefund = (showtimeId, overrides = {}) => {
        const bookingId = oid(),
          paymentId = oid();
        if (showtimeId)
          bookings.push({ _id: bookingId, showtimeId, status: "CONFIRMED" });
        payments.push({ _id: paymentId, status: "PAID" });
        const refund = {
          _id: oid(),
          bookingId,
          paymentId,
          customerAccountId: oid(),
          status: "REQUESTED",
          reason: "Customer could not attend",
          paymentMethod: "VNPAY_QR",
          ticketAmount: 100000,
          concessionAmount: 0,
          paymentAmount: 100000,
          refundAmount: 100000,
          currency: "VND",
          fulfillmentSnapshot: "NONE",
          requestedAt: new Date(1000),
          ...overrides,
        };
        refund.idempotencyKey = `refund:${refund._id}`;
        refunds.push(refund);
        return refund;
      };
      const foreign = addRefund(showtimeB, { showtimeId: showtimeA });
      for (let i = 0; i < 200; i++) addRefund(showtimeB);
      const orphan = addRefund(null, { showtimeId: showtimeA });
      const approve = addRefund(showtimeA, { requestedAt: new Date(2000) });
      const retry = addRefund(showtimeA, {
        status: "FAILED",
        requestedAt: new Date(3000),
      });
      const cash = addRefund(showtimeA, {
        paymentMethod: "CASH",
        requestedAt: new Date(4000),
      });
      const reject = addRefund(showtimeA, { requestedAt: new Date(5000) });
      const foreignRetry = addRefund(showtimeB, { status: "FAILED" });
      const foreignCash = addRefund(showtimeB, { paymentMethod: "CASH" });
      await Promise.all([
        db.collection("bookings").insertMany(bookings),
        db.collection("payments").insertMany(payments),
        db.collection("refund_requests").insertMany(refunds),
      ]);

      const providerCalls = [];
      const provider = {
        async refund({ paymentId }) {
          providerCalls.push(paymentId);
          return { reference: `TEST-${paymentId}` };
        },
      };
      const app = express();
      app.use(express.json(), cookieParser());
      const service = createRefundService({
        repository: refundRepository,
        provider,
      });
      app.use("/refunds", createRefundRouter(createRefundController(service)));
      app.use(showtimeRoutes);
      app.use(errorHandler);
      server = app.listen(0, "127.0.0.1");
      await new Promise((resolve) => server.once("listening", resolve));
      const token = (actor) => jwt.sign({ sub: String(actor) }, secret);
      const tokenA = token(managerA),
        tokenB = token(managerB),
        tokenUnassigned = token(unassigned);
      const request = async (path, jwtToken, method = "GET", body) => {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/refunds${path}`,
          {
            method,
            headers: {
              Cookie: `accessToken=${jwtToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
        );
        return { status: response.status, body: await response.json() };
      };
      const runAction = (action, refund, jwtToken) =>
        request(
          `/${refund._id}/${action}`,
          jwtToken,
          "POST",
          action === "reject" ? { reason: "Review declined" } : undefined,
        );

      const list = await request("/manager", tokenA);
      assert.equal(list.status, 200);
      assert.deepEqual(
        list.body.data.items.map((item) => item.refundId),
        [approve, retry, cash, reject].map((row) => String(row._id)),
      );
      assert.equal(list.body.data.items[0].showtimeId, null);
      const unassignedList = await request("/manager", tokenUnassigned);
      assert.equal(unassignedList.status, 403);
      assert.equal(unassignedList.body.code, "BRANCH_NOT_ASSIGNED");
      assert.equal(
        (await runAction("approve", approve, tokenUnassigned)).status,
        403,
      );

      for (const [action, refund] of [
        ["approve", foreign],
        ["retry", foreignRetry],
        ["confirm-cash", foreignCash],
        ["reject", foreign],
        ["reject", orphan],
      ]) {
        const denied = await runAction(action, refund, tokenA);
        assert.equal(denied.status, 404);
        assert.equal(denied.body.code, "REFUND_NOT_FOUND");
        const persisted = await db
          .collection("refund_requests")
          .findOne({ _id: refund._id });
        assert.equal(persisted.status, refund.status);
      }
      assert.equal((await runAction("approve", approve, tokenB)).status, 404);
      assert.deepEqual(providerCalls, []);

      for (const [action, refund, status] of [
        ["approve", approve, "REFUNDED"],
        ["retry", retry, "REFUNDED"],
        ["confirm-cash", cash, "REFUNDED"],
        ["reject", reject, "REJECTED"],
      ]) {
        const result = await runAction(action, refund, tokenA);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.data.status, status);
      }
      assert.deepEqual(providerCalls, [
        String(approve.paymentId),
        String(retry.paymentId),
      ]);

      await accounts.updateOne(
        { _id: managerA },
        { $set: { "employeeProfile.branchId": branchB } },
      );
      const movedList = await request("/manager", tokenA);
      assert.equal(movedList.status, 200);
      assert.equal(movedList.body.data.items.length, 200);
      assert.ok(
        movedList.body.data.items.every(
          ({ refundId }) =>
            !list.body.data.items.some((item) => item.refundId === refundId),
        ),
      );
      assert.equal((await runAction("approve", approve, tokenA)).status, 404);

      const cancellable = oid(),
        paidBooking = oid(),
        pendingBooking = oid();
      const cashPayment = oid(),
        consumed = oid(),
        reserved = oid(),
        voucher = oid();
      const customerAccountId = oid();
      await Promise.all([
        db.collection("showtimes").insertOne({
          _id: cancellable,
          roomId: roomA,
          status: "PUBLISHED",
          startAt: new Date(Date.now() + 3600000),
        }),
        db.collection("bookings").insertMany([
          {
            _id: paidBooking,
            showtimeId: cancellable,
            customerAccountId,
            paymentId: cashPayment,
            status: "CONFIRMED",
            subtotal: 100000,
            discountAmount: 10000,
            voucherSnapshot: { reservationId: consumed },
          },
          {
            _id: pendingBooking,
            showtimeId: cancellable,
            status: "PENDING_PAYMENT",
            voucherSnapshot: { reservationId: reserved },
          },
        ]),
        db
          .collection("payments")
          .insertOne({
            _id: cashPayment,
            status: "PAID",
            method: "CASH",
            amount: 90000,
          }),
        db
          .collection("vouchers")
          .insertOne({ _id: voucher, usedCount: 1, reservedCount: 1 }),
        db.collection("voucher_redemptions").insertMany([
          {
            _id: consumed,
            voucherId: voucher,
            state: "CONSUMED",
            blocking: true,
          },
          {
            _id: reserved,
            voucherId: voucher,
            state: "RESERVED",
            blocking: true,
          },
        ]),
        db.createCollection("seat_holds"),
      ]);
      const cancel = async (jwtToken) => {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/showtimes/${cancellable}/cancel`,
          { method: "POST", headers: { Cookie: `accessToken=${jwtToken}` } },
        );
        return { status: response.status, body: await response.json() };
      };
      const crossBranchCancellation = await cancel(tokenB);
      assert.equal(crossBranchCancellation.status, 403);
      assert.equal(crossBranchCancellation.body.code, "ROOM_WRONG_BRANCH");
      assert.equal(
        (await cancel(tokenUnassigned)).body.code,
        "BRANCH_NOT_ASSIGNED",
      );
      assert.equal(
        (await db.collection("showtimes").findOne({ _id: cancellable })).status,
        "PUBLISHED",
      );
      assert.equal(
        await db
          .collection("refund_requests")
          .countDocuments({ bookingId: paidBooking }),
        0,
      );
      assert.equal(
        (await db.collection("voucher_redemptions").findOne({ _id: reserved }))
          .state,
        "RESERVED",
      );

      await accounts.updateOne(
        { _id: managerA },
        { $set: { "employeeProfile.branchId": branchA } },
      );
      const ownCancellation = await cancel(tokenA);
      assert.equal(
        ownCancellation.status,
        200,
        JSON.stringify(ownCancellation.body),
      );
      assert.equal(ownCancellation.body.data.refunds.awaitingManual, 1);
      assert.equal(
        ownCancellation.body.data.refunds.items[0].refundAmount,
        90000,
      );
      assert.equal(
        (await db.collection("bookings").findOne({ _id: pendingBooking }))
          .status,
        "EXPIRED",
      );
      assert.equal(
        (await db.collection("voucher_redemptions").findOne({ _id: reserved }))
          .state,
        "RELEASED",
      );
      assert.equal(
        (await db.collection("voucher_redemptions").findOne({ _id: consumed }))
          .state,
        "CONSUMED",
      );
      const updatedVoucher = await db
        .collection("vouchers")
        .findOne({ _id: voucher });
      assert.equal(updatedVoucher.reservedCount, 0);
      assert.equal(updatedVoucher.usedCount, 1);
    } finally {
      try {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (
          db?.databaseName === database &&
          /^refund_test_\d+_[a-f0-9]{8}$/.test(database)
        )
          await db.dropDatabase();
      } finally {
        await mongoose.disconnect();
        if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
        else process.env.JWT_ACCESS_SECRET = previousSecret;
      }
    }
  },
);
