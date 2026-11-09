import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { AppError } from "../src/utils/AppError.js";
import { createAiController } from "../src/modules/ai/ai.controller.js";
import { createAiRouter } from "../src/modules/ai/ai.routes.js";
import { createAiActorMiddleware } from "../src/modules/ai/ai-actor.middleware.js";

process.env.JWT_ACCESS_SECRET ||= "ai-routes-test-secret";

const ACCOUNTS = {
  "64b000000000000000000001": { id: "64b000000000000000000001", username: "cus", roles: [{ name: "CUSTOMER" }], permissions: [{ name: "refund.request" }] },
  "64b000000000000000000002": { id: "64b000000000000000000002", username: "adm", roles: [{ name: "ADMIN" }], permissions: [] },
};
const LOCKED = "64b000000000000000000009";

const loadAccount = async (accountId) => {
  if (accountId === LOCKED) throw new AppError(403, "This account is not allowed to sign in");
  const account = ACCOUNTS[accountId];
  if (!account) throw new AppError(401, "Authentication required");
  return account;
};

const cookieFor = (accountId) => `accessToken=${jwt.sign({ sub: accountId }, process.env.JWT_ACCESS_SECRET)}`;

const startServer = async ({ enabled = true } = {}) => {
  const calls = [];
  const service = {
    chat: async (input) => {
      calls.push({ name: "chat", ...input });
      return { conversationId: "c", reply: "ok" };
    },
    confirmAction: async (input) => {
      calls.push({ name: "confirm", ...input });
      return { status: "EXECUTED" };
    },
    cancelAction: async () => ({ status: "CANCELLED" }),
    getConversation: async () => ({ messages: [] }),
    listTraces: async () => ({ items: [], total: 0 }),
    getTrace: async () => ({}),
  };
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/ai",
    createAiRouter({
      controller: createAiController({ getService: () => service, runKnowledgeSync: async () => ({}) }),
      ensureEnabled: (_req, _res, next) =>
        enabled ? next() : next(new AppError(503, "disabled", [], "AI_DISABLED")),
      actorMiddleware: createAiActorMiddleware({ loadAccount }),
    }),
  );
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/ai`;
  const request = (path, { method = "GET", body, cookie } = {}) =>
    fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  return { request, calls, close: () => new Promise((resolve) => server.close(resolve)) };
};

test("AI-001 routes answer 503 AI_DISABLED without an API key", async () => {
  const server = await startServer({ enabled: false });
  try {
    const response = await server.request("/chat", { method: "POST", body: { message: "hi" } });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "AI_DISABLED");
  } finally {
    await server.close();
  }
});

test("AI-001 a guest can chat; a valid session is resolved and forwarded", async () => {
  const server = await startServer();
  try {
    assert.equal((await server.request("/chat", { method: "POST", body: { message: "Phim hay?" } })).status, 200);
    assert.equal(server.calls[0].actor.kind, "guest");
    assert.equal(server.calls[0].accessToken, null);

    const cookie = cookieFor("64b000000000000000000001");
    await server.request("/chat", { method: "POST", body: { message: "Vé của tôi" }, cookie });
    assert.equal(server.calls[1].actor.accountId, "64b000000000000000000001");
    assert.ok(server.calls[1].actor.roles.has("CUSTOMER"));
    assert.equal(server.calls[1].accessToken, cookie.split("=")[1]);

    // A forged token or a locked account is a guest, and its token is never forwarded.
    await server.request("/chat", { method: "POST", body: { message: "hi" }, cookie: "accessToken=forged" });
    await server.request("/chat", { method: "POST", body: { message: "hi" }, cookie: cookieFor(LOCKED) });
    assert.deepEqual(server.calls.slice(2).map(({ actor, accessToken }) => [actor.kind, accessToken]), [["guest", null], ["guest", null]]);
  } finally {
    await server.close();
  }
});

test("AI-001 chat input is validated", async () => {
  const server = await startServer();
  try {
    for (const body of [{ message: "" }, { message: "x".repeat(2001) }, { message: "hi", extra: 1 }, { message: "hi", conversationId: "nope" }]) {
      const response = await server.request("/chat", { method: "POST", body });
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 60));
      assert.equal((await response.json()).code, "AI_INVALID_INPUT");
    }
    assert.equal(server.calls.length, 0);
  } finally {
    await server.close();
  }
});

test("AI-001 confirming needs an account; traces and knowledge sync need ADMIN", async () => {
  const server = await startServer();
  const actionId = "00000000-0000-4000-8000-000000000001";
  try {
    assert.equal((await server.request(`/actions/${actionId}/confirm`, { method: "POST" })).status, 404);
    const customer = cookieFor("64b000000000000000000001");
    assert.equal((await server.request(`/actions/${actionId}/confirm`, { method: "POST", cookie: customer })).status, 200);
    assert.equal(server.calls.at(-1).actionId, actionId);

    assert.equal((await server.request("/traces", { cookie: customer })).status, 404);
    assert.equal((await server.request("/knowledge/sync", { method: "POST", body: {}, cookie: customer })).status, 404);
    const admin = cookieFor("64b000000000000000000002");
    assert.equal((await server.request("/traces", { cookie: admin })).status, 200);
    assert.equal((await server.request("/knowledge/sync", { method: "POST", body: {}, cookie: admin })).status, 200);
  } finally {
    await server.close();
  }
});
