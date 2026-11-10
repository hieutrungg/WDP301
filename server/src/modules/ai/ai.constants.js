// AI-001 assistant constants. Module-local; nothing here is a shared contract yet.

// v2 (2026-11-09): the assistant is named Popo.
// v3 (2026-11-09): plain language for guests/customers; never promise features that do not exist.
// v4 (2026-11-10): per-session list of write actions; cards only after a real tool call.
// A new version invalidates every cached answer.
export const PROMPT_VERSION = "ai-001.v4";

export const AI_LIMITS = Object.freeze({
  MAX_INPUT_CHARS: 2000,
  MAX_TOOL_ROUNDS: 5,
  MAX_HISTORY_MESSAGES: 12,
  MAX_STORED_MESSAGES: 40,
  MAX_OUTPUT_TOKENS: 4000,
  TOOL_TIMEOUT_MS: 8000,
  LLM_TIMEOUT_MS: 45000,
  MAX_TOOL_OUTPUT_CHARS: 6000,
  PENDING_ACTION_TTL_MS: 5 * 60 * 1000,
  CONVERSATION_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  RETRIEVAL_LIMIT: 5,
  MOVIE_RECOMMENDATION_LIMIT: 5,
});

// Atlas $vectorSearch scores cosine as (1 + cos) / 2, so 0.97 ≈ cos 0.94.
export const RETRIEVAL_MIN_SCORE = 0.7;
export const SEMANTIC_CACHE_MIN_SCORE = 0.97;
export const FAQ_CACHE_TTL_SECONDS = 24 * 60 * 60;

export const EMBEDDING_DIMENSIONS = 1536;

// Names of the Atlas Vector Search indexes (docs/AI-001-ATLAS-SETUP.md).
export const VECTOR_INDEX = Object.freeze({
  KNOWLEDGE: "ai_knowledge_vector",
  CACHE: "ai_cache_vector",
});

export const AI_COLLECTION = Object.freeze({
  CONVERSATIONS: "ai_conversations",
  PENDING_ACTIONS: "ai_pending_actions",
  KNOWLEDGE_CHUNKS: "ai_knowledge_chunks",
  RESPONSE_CACHE: "ai_response_cache",
  TRACES: "ai_traces",
  TOOL_CALLS: "ai_tool_calls",
  META: "ai_meta",
});

export const KNOWLEDGE_AUDIENCE = Object.freeze({
  PUBLIC: "public",
  INTERNAL: "internal",
});

export const KNOWLEDGE_SOURCE = Object.freeze({
  FAQ: "faq",
  MOVIE: "movie",
});

// Scope of an actor: who the answer was written for. Cache entries never cross scopes.
export const ACTOR_SCOPE = Object.freeze({
  GUEST: "GUEST",
  CUSTOMER: "CUSTOMER",
  STAFF: "STAFF",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
});

export const TOOL_KIND = Object.freeze({ READ: "read", WRITE: "write" });

export const TOOL_CALL_STATUS = Object.freeze({
  EXECUTED: "executed",
  FAILED: "failed",
  PENDING_CONFIRMATION: "pending_confirmation",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  DENIED: "denied",
  INVALID_ARGS: "invalid_args",
});

export const PENDING_ACTION_STATUS = Object.freeze({
  PENDING: "PENDING",
  EXECUTING: "EXECUTING",
  EXECUTED: "EXECUTED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
});

export const TRACE_STATUS = Object.freeze({
  OK: "ok",
  BLOCKED: "blocked",
  CACHED: "cached",
  ERROR: "error",
});

export const CACHE_MODE = Object.freeze({
  MISS: "miss",
  EXACT: "exact",
  SEMANTIC: "semantic",
  SKIPPED: "skipped",
});

export const AI_ERROR = Object.freeze({
  DISABLED: "AI_DISABLED",
  INVALID_INPUT: "AI_INVALID_INPUT",
  RATE_LIMITED: "AI_RATE_LIMITED",
  CONVERSATION_NOT_FOUND: "AI_CONVERSATION_NOT_FOUND",
  ACTION_NOT_FOUND: "AI_ACTION_NOT_FOUND",
  ACTION_EXPIRED: "AI_ACTION_EXPIRED",
  ACTION_ALREADY_HANDLED: "AI_ACTION_ALREADY_HANDLED",
  PROVIDER_FAILED: "AI_PROVIDER_FAILED",
  TRACE_NOT_FOUND: "AI_TRACE_NOT_FOUND",
});

export const AI_MESSAGES = Object.freeze({
  BLOCKED:
    "Xin lỗi, mình không thể xử lý yêu cầu này. Mình có thể giúp bạn tìm phim, suất chiếu, giá vé, bắp nước hoặc giải đáp chính sách của F-Cinema.",
  PROMPT_LEAK:
    "Xin lỗi, mình không thể chia sẻ thông tin đó. Bạn cần hỗ trợ gì về phim hay đặt vé không?",
  TOO_MANY_STEPS:
    "Xin lỗi, yêu cầu này cần quá nhiều bước tra cứu. Bạn thử hỏi cụ thể hơn (ví dụ tên phim, rạp, ngày) nhé.",
  PROVIDER_FAILED:
    "Trợ lý đang tạm thời gián đoạn. Bạn thử lại sau ít phút nhé.",
  NO_ACTION_CARD:
    "Xin lỗi, Popo chưa làm được việc này cho tài khoản của bạn nên chưa có gì thay đổi. Bạn có thể tự thực hiện trên trang tương ứng của F-Cinema nhé.",
});
