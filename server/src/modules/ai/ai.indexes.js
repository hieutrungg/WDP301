import { AI_COLLECTION, EMBEDDING_DIMENSIONS, VECTOR_INDEX } from "./ai.constants.js";

// Regular indexes, created by migrations/20261109-ai-001-indexes.js.
export const AI_INDEXES = Object.freeze({
  [AI_COLLECTION.CONVERSATIONS]: [
    { fields: { expiresAt: 1 }, options: { name: "ai_conversation_ttl", expireAfterSeconds: 0 } },
  ],
  [AI_COLLECTION.PENDING_ACTIONS]: [
    { fields: { purgeAt: 1 }, options: { name: "ai_pending_action_ttl", expireAfterSeconds: 0 } },
    { fields: { accountId: 1, status: 1 }, options: { name: "ai_pending_action_owner" } },
  ],
  [AI_COLLECTION.KNOWLEDGE_CHUNKS]: [
    {
      fields: { sourceType: 1, sourceId: 1, chunkIndex: 1 },
      options: { name: "ai_chunk_source_unique", unique: true },
    },
  ],
  [AI_COLLECTION.RESPONSE_CACHE]: [
    { fields: { key: 1 }, options: { name: "ai_cache_key_unique", unique: true } },
    { fields: { expiresAt: 1 }, options: { name: "ai_cache_ttl", expireAfterSeconds: 0 } },
  ],
  [AI_COLLECTION.TRACES]: [
    { fields: { expiresAt: 1 }, options: { name: "ai_trace_ttl", expireAfterSeconds: 0 } },
    { fields: { startedAt: -1 }, options: { name: "ai_trace_recent" } },
    { fields: { accountId: 1, startedAt: -1 }, options: { name: "ai_trace_account_recent" } },
  ],
  [AI_COLLECTION.TOOL_CALLS]: [
    { fields: { expiresAt: 1 }, options: { name: "ai_tool_call_ttl", expireAfterSeconds: 0 } },
    { fields: { traceId: 1, at: 1 }, options: { name: "ai_tool_call_trace" } },
  ],
});

// Atlas Vector Search index definitions. Create them in the Atlas UI (JSON editor) or with
// `node src/migrations/20261109-ai-001-indexes.js --vector`. Filter fields must be listed here
// to be usable in $vectorSearch.filter.
export const AI_VECTOR_INDEXES = Object.freeze([
  {
    collection: AI_COLLECTION.KNOWLEDGE_CHUNKS,
    name: VECTOR_INDEX.KNOWLEDGE,
    definition: {
      fields: [
        { type: "vector", path: "embedding", numDimensions: EMBEDDING_DIMENSIONS, similarity: "cosine" },
        { type: "filter", path: "audience" },
        { type: "filter", path: "sourceType" },
      ],
    },
  },
  {
    collection: AI_COLLECTION.RESPONSE_CACHE,
    name: VECTOR_INDEX.CACHE,
    definition: {
      fields: [
        { type: "vector", path: "embedding", numDimensions: EMBEDDING_DIMENSIONS, similarity: "cosine" },
        { type: "filter", path: "scope" },
        { type: "filter", path: "versionTag" },
        { type: "filter", path: "semanticEligible" },
      ],
    },
  },
]);
