import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Account } from "../src/modules/account/account.model.js";
import { createBookingRouter } from "../src/modules/booking/booking.routes.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";

test("Booking route enforces current account status and role/direct grants", async (t) => {
  const previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "booking-route-test-secret";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });
  const permission = { _id: new mongoose.Types.ObjectId(), name: "booking.create" };
  const account = {
    _id: new mongoose.Types.ObjectId(), status: "ACTIVE", roleIds: [], directPermissionIds: [],
  };
  let currentAccount = account;
  const lookup = t.mock.method(Account, "findById", (id) => {
    assert.equal(id, account._id.toString());
    const query = { populate: () => query, exec: async () => currentAccount };
    return query;
  });
  let creates = 0;
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/api/bookings", createBookingRouter({
    createPending: (_req, res) => { creates += 1; res.status(201).json({ success: true }); },
  }));
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const token = jwt.sign({ sub: account._id.toString() }, process.env.JWT_ACCESS_SECRET);
  const request = async (authenticated = true) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? { Cookie: `accessToken=${token}` } : {}),
      },
      body: JSON.stringify({ holdId: new mongoose.Types.ObjectId().toString(), requestKey: "booking-route-request" }),
    });
    return { status: response.status, body: await response.json() };
  };

  await t.test("anonymous requests are rejected before account lookup", async () => {
    assert.equal((await request(false)).status, 401);
    assert.equal(lookup.mock.callCount(), 0);
    assert.equal(creates, 0);
  });
  await t.test("an account without booking.create is forbidden", async () => {
    const result = await request();
    assert.equal(result.status, 403);
    assert.equal(result.body.code, "FORBIDDEN");
    assert.equal(creates, 0);
  });
  await t.test("a role grant permits creation", async () => {
    account.roleIds = [{ _id: new mongoose.Types.ObjectId(), name: "CUSTOMER", permissionIds: [permission] }];
    assert.equal((await request()).status, 201);
    assert.equal(creates, 1);
  });
  await t.test("revocation takes effect with the same JWT on the next request", async () => {
    account.roleIds[0].permissionIds = [];
    assert.equal((await request()).status, 403);
    assert.equal(creates, 1);
  });
  await t.test("a direct grant permits creation without a role grant", async () => {
    account.directPermissionIds = [permission];
    assert.equal((await request()).status, 201);
    assert.equal(creates, 2);
  });
  await t.test("a locked account cannot create despite its direct grant", async () => {
    account.status = "LOCKED";
    assert.equal((await request()).status, 403);
    assert.equal(creates, 2);
  });
  await t.test("a missing account cannot use an existing JWT", async () => {
    currentAccount = null;
    assert.equal((await request()).status, 401);
    assert.equal(creates, 2);
  });
});
