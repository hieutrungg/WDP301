import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { validate } from "../../middlewares/validateMiddleware.js";
import { AppError } from "../../utils/AppError.js";
import { AI_ERROR } from "./ai.constants.js";
import { createAiActorMiddleware, requireAiAccount, requireAiAdmin } from "./ai-actor.middleware.js";
import {
  actionParamsSchema,
  chatBodySchema,
  conversationParamsSchema,
  knowledgeSyncBodySchema,
  traceListQuerySchema,
  traceParamsSchema,
} from "./ai.validation.js";

// Mounted at /api/ai. Every route first resolves the actor (guest or account).
//   POST /chat                              everyone (guests 10/min per IP, accounts 20/min)
//   POST /actions/:actionId/confirm|cancel  owner of the PendingAction
//   GET  /conversations/:conversationId     owner of the conversation (guest: holder of the id)
//   GET  /traces, /traces/:traceId          ADMIN
//   POST /knowledge/sync                    ADMIN

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: (req) => (req.ai?.actor.kind === "account" ? 20 : 10),
  keyGenerator: (req) => req.ai?.actor.accountId ?? ipKeyGenerator(req.ip ?? ""),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new AppError(429, "Bạn hỏi hơi nhanh, vui lòng thử lại sau ít giây.", [], AI_ERROR.RATE_LIMITED)),
});

export const createAiRouter = ({ controller, ensureEnabled, actorMiddleware = createAiActorMiddleware() }) => {
  const router = Router();
  router.use(ensureEnabled, actorMiddleware);

  router.post("/chat", chatLimiter, validate(chatBodySchema, { code: AI_ERROR.INVALID_INPUT }), controller.chat);

  const actionParams = validate(actionParamsSchema, { source: "params", code: AI_ERROR.ACTION_NOT_FOUND });
  router.post("/actions/:actionId/confirm", requireAiAccount, actionParams, controller.confirmAction);
  router.post("/actions/:actionId/cancel", requireAiAccount, actionParams, controller.cancelAction);

  router.get(
    "/conversations/:conversationId",
    validate(conversationParamsSchema, { source: "params", code: AI_ERROR.CONVERSATION_NOT_FOUND }),
    controller.getConversation,
  );

  router.get(
    "/traces",
    requireAiAdmin,
    validate(traceListQuerySchema, { source: "query", code: "INVALID_QUERY" }),
    controller.listTraces,
  );
  router.get(
    "/traces/:traceId",
    requireAiAdmin,
    validate(traceParamsSchema, { source: "params", code: AI_ERROR.TRACE_NOT_FOUND }),
    controller.getTrace,
  );
  router.post(
    "/knowledge/sync",
    requireAiAdmin,
    validate(knowledgeSyncBodySchema, { code: "INVALID_BODY" }),
    controller.syncKnowledge,
  );

  return router;
};
