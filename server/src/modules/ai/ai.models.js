import mongoose from "mongoose";
import { AI_COLLECTION } from "./ai.constants.js";

// AI-001 collections. All set autoIndex: false; TTL and unique indexes come from
// migrations/20261109-ai-001-indexes.js and the two vector indexes from Atlas
// (docs/AI-001-ATLAS-SETUP.md).

const { Mixed } = mongoose.Schema.Types;
const options = (collection, extra = {}) => ({
  collection,
  versionKey: false,
  autoIndex: false,
  ...extra,
});

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 8000 },
    traceId: { type: String },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    _id: { type: String },
    // null for a guest; a signed-in conversation is readable by its owner only.
    accountId: { type: String, default: null },
    scope: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },
    expiresAt: { type: Date, required: true },
  },
  options(AI_COLLECTION.CONVERSATIONS, { timestamps: true }),
);

const pendingActionSchema = new mongoose.Schema(
  {
    _id: { type: String },
    accountId: { type: String, required: true },
    conversationId: { type: String, required: true },
    traceId: { type: String, required: true },
    tool: { type: String, required: true },
    args: { type: Mixed, required: true },
    summary: { type: String, required: true, maxlength: 500 },
    status: { type: String, required: true },
    result: { type: Mixed },
    expiresAt: { type: Date, required: true },
    // Kept for the audit trail after the action is handled; removed by the TTL index.
    purgeAt: { type: Date, required: true },
  },
  options(AI_COLLECTION.PENDING_ACTIONS, { timestamps: true }),
);

const knowledgeChunkSchema = new mongoose.Schema(
  {
    _id: { type: String },
    sourceType: { type: String, required: true },
    sourceId: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    audience: { type: String, required: true },
    title: { type: String, required: true },
    heading: { type: String, default: "" },
    text: { type: String, required: true },
    contentHash: { type: String, required: true },
    embedding: { type: [Number], required: true },
    embeddingModel: { type: String, required: true },
    metadata: { type: Mixed },
  },
  options(AI_COLLECTION.KNOWLEDGE_CHUNKS, { timestamps: true }),
);

const responseCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    scope: { type: String, required: true },
    versionTag: { type: String, required: true },
    question: { type: String, required: true },
    embedding: { type: [Number] },
    semanticEligible: { type: Boolean, required: true },
    answer: { type: String, required: true },
    citations: { type: Mixed, default: [] },
    hits: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  options(AI_COLLECTION.RESPONSE_CACHE, { timestamps: true }),
);

const traceSchema = new mongoose.Schema(
  {
    _id: { type: String },
    accountId: { type: String, default: null },
    scope: { type: String, required: true },
    conversationId: { type: String },
    promptVersion: { type: String, required: true },
    model: { type: String },
    status: { type: String, required: true },
    input: { type: String },
    output: { type: String },
    guardrails: { type: Mixed },
    cache: { type: Mixed },
    retrieval: { type: Mixed, default: [] },
    llmCalls: { type: Mixed, default: [] },
    usage: { type: Mixed },
    prompt: { type: Mixed },
    toolNames: { type: [String], default: [] },
    error: { type: Mixed },
    latencyMs: { type: Number },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  options(AI_COLLECTION.TRACES),
);

const toolCallSchema = new mongoose.Schema(
  {
    _id: { type: String },
    traceId: { type: String, required: true },
    conversationId: { type: String },
    accountId: { type: String, default: null },
    tool: { type: String, required: true },
    kind: { type: String },
    status: { type: String, required: true },
    args: { type: Mixed },
    httpStatus: { type: Number },
    errorCode: { type: String },
    outputChars: { type: Number },
    latencyMs: { type: Number },
    pendingActionId: { type: String },
    at: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  options(AI_COLLECTION.TOOL_CALLS),
);

const metaSchema = new mongoose.Schema(
  {
    _id: { type: String },
    value: { type: Mixed },
  },
  options(AI_COLLECTION.META, { timestamps: true }),
);

const model = (name, schema) => mongoose.models[name] ?? mongoose.model(name, schema);

export const AiConversation = model("AiConversation", conversationSchema);
export const AiPendingAction = model("AiPendingAction", pendingActionSchema);
export const AiKnowledgeChunk = model("AiKnowledgeChunk", knowledgeChunkSchema);
export const AiResponseCache = model("AiResponseCache", responseCacheSchema);
export const AiTrace = model("AiTrace", traceSchema);
export const AiToolCall = model("AiToolCall", toolCallSchema);
export const AiMeta = model("AiMeta", metaSchema);
