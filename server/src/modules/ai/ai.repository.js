import {
  AiConversation,
  AiKnowledgeChunk,
  AiMeta,
  AiPendingAction,
  AiResponseCache,
  AiToolCall,
  AiTrace,
} from "./ai.models.js";
import { AI_LIMITS, PENDING_ACTION_STATUS, VECTOR_INDEX } from "./ai.constants.js";

// Mongo persistence of the AI module. The chat service only sees this object (tests use an
// in-memory fake with the same methods).

const KNOWLEDGE_VERSION_ID = "knowledge_version";

const vectorSearch = async (Model, { index, vector, filter, limit, project }) =>
  Model.aggregate([
    {
      $vectorSearch: {
        index,
        path: "embedding",
        queryVector: vector,
        numCandidates: Math.max(limit * 20, 100),
        limit,
        filter,
      },
    },
    { $project: { ...project, score: { $meta: "vectorSearchScore" } } },
  ]);

export const createAiRepository = () => ({
  // --- Conversations ---------------------------------------------------------------------------
  async findConversation(conversationId) {
    return AiConversation.findById(conversationId).lean();
  },

  async appendMessages({ conversationId, accountId, scope, messages, expiresAt }) {
    await AiConversation.updateOne(
      { _id: conversationId },
      {
        $setOnInsert: { accountId, scope },
        $set: { expiresAt },
        $push: { messages: { $each: messages, $slice: -AI_LIMITS.MAX_STORED_MESSAGES } },
      },
      { upsert: true },
    );
  },

  // --- Pending actions -------------------------------------------------------------------------
  async createPendingAction(action) {
    await AiPendingAction.create(action);
  },

  async findPendingAction(actionId) {
    return AiPendingAction.findById(actionId).lean();
  },

  // Atomic PENDING -> next status, so a double click or a replay runs the action once.
  async claimPendingAction({ actionId, accountId, now, nextStatus }) {
    return AiPendingAction.findOneAndUpdate(
      {
        _id: actionId,
        accountId,
        status: PENDING_ACTION_STATUS.PENDING,
        expiresAt: { $gt: now },
      },
      { $set: { status: nextStatus } },
      { returnDocument: "after" },
    ).lean();
  },

  async finishPendingAction(actionId, { status, result }) {
    await AiPendingAction.updateOne({ _id: actionId }, { $set: { status, result } });
  },

  // --- Knowledge -------------------------------------------------------------------------------
  async searchKnowledge({ vector, audiences, sourceTypes, limit }) {
    return vectorSearch(AiKnowledgeChunk, {
      index: VECTOR_INDEX.KNOWLEDGE,
      vector,
      limit,
      filter: { audience: { $in: audiences }, sourceType: { $in: sourceTypes } },
      project: { _id: 1, sourceType: 1, sourceId: 1, title: 1, heading: 1, text: 1, metadata: 1 },
    });
  },

  async listChunkHashes(sourceType) {
    const chunks = await AiKnowledgeChunk.find({ sourceType }, { contentHash: 1 }).lean();
    return new Map(chunks.map((chunk) => [chunk._id, chunk.contentHash]));
  },

  async upsertChunks(chunks) {
    if (!chunks.length) return;
    await AiKnowledgeChunk.bulkWrite(
      chunks.map((chunk) => ({
        replaceOne: { filter: { _id: chunk._id }, replacement: chunk, upsert: true },
      })),
    );
  },

  async deleteChunks(chunkIds) {
    if (!chunkIds.length) return 0;
    const result = await AiKnowledgeChunk.deleteMany({ _id: { $in: chunkIds } });
    return result.deletedCount ?? 0;
  },

  async getKnowledgeVersion() {
    const meta = await AiMeta.findById(KNOWLEDGE_VERSION_ID).lean();
    return meta?.value ?? "0";
  },

  async setKnowledgeVersion(version) {
    await AiMeta.updateOne(
      { _id: KNOWLEDGE_VERSION_ID },
      { $set: { value: version } },
      { upsert: true },
    );
  },

  // --- Response cache --------------------------------------------------------------------------
  async findCacheByKey(key, now) {
    return AiResponseCache.findOne({ key, expiresAt: { $gt: now } }).lean();
  },

  async searchCache({ vector, scope, versionTag }) {
    return vectorSearch(AiResponseCache, {
      index: VECTOR_INDEX.CACHE,
      vector,
      limit: 1,
      filter: { scope, versionTag, semanticEligible: true },
      project: { _id: 1, key: 1, answer: 1, citations: 1, question: 1, expiresAt: 1 },
    });
  },

  async saveCache(entry) {
    await AiResponseCache.updateOne({ key: entry.key }, { $set: entry }, { upsert: true });
  },

  async recordCacheHit(key) {
    await AiResponseCache.updateOne({ key }, { $inc: { hits: 1 } });
  },

  // --- Traces ----------------------------------------------------------------------------------
  async insertTrace(trace) {
    await AiTrace.create(trace);
  },

  async insertToolCall(toolCall) {
    await AiToolCall.create(toolCall);
  },

  async listTraces({ page, limit, status, accountId }) {
    const filter = {};
    if (status) filter.status = status;
    if (accountId) filter.accountId = accountId;
    const [items, total] = await Promise.all([
      AiTrace.find(filter, { prompt: 0, llmCalls: 0 })
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AiTrace.countDocuments(filter),
    ]);
    return { items, total };
  },

  async getTrace(traceId) {
    const [trace, toolCalls] = await Promise.all([
      AiTrace.findById(traceId).lean(),
      AiToolCall.find({ traceId }).sort({ at: 1 }).lean(),
    ]);
    return trace ? { ...trace, toolCalls } : null;
  },
});
