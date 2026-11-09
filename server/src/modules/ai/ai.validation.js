import { z } from "zod";
import { AI_LIMITS, TRACE_STATUS } from "./ai.constants.js";

const uuid = z.string().uuid("Must be a UUID");

export const chatBodySchema = z.strictObject({
  conversationId: uuid.optional(),
  message: z
    .string({ error: "Message is required" })
    .trim()
    .min(1, "Message is required")
    .max(AI_LIMITS.MAX_INPUT_CHARS, `Message must be at most ${AI_LIMITS.MAX_INPUT_CHARS} characters`),
});

export const actionParamsSchema = z.strictObject({ actionId: uuid });

export const conversationParamsSchema = z.strictObject({ conversationId: uuid });

export const traceParamsSchema = z.strictObject({ traceId: uuid });

export const traceListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(Object.values(TRACE_STATUS)).optional(),
  accountId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

export const knowledgeSyncBodySchema = z.strictObject({
  faq: z.boolean().default(true),
  movies: z.boolean().default(true),
});
