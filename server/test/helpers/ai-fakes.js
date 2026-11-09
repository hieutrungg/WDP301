// In-memory ports for the AI-001 chat service tests.

export const createFakeAiRepository = () => {
  const conversations = new Map();
  const pendingActions = new Map();
  const cache = new Map();
  const traces = [];
  const toolCalls = [];
  const knowledgeQueries = [];
  let knowledgeVersion = "1";
  let knowledgeHits = [];
  let movieHits = [];

  return {
    conversations,
    pendingActions,
    cache,
    traces,
    toolCalls,
    knowledgeQueries,
    setKnowledgeHits: (hits) => { knowledgeHits = hits; },
    setMovieHits: (hits) => { movieHits = hits; },
    bumpKnowledgeVersion: () => { knowledgeVersion = String(Number(knowledgeVersion) + 1); },

    async findConversation(id) {
      return conversations.get(id) ?? null;
    },
    async appendMessages({ conversationId, accountId, scope, messages, expiresAt }) {
      const current = conversations.get(conversationId) ?? { _id: conversationId, accountId, scope, messages: [] };
      current.messages = [...current.messages, ...messages];
      current.expiresAt = expiresAt;
      conversations.set(conversationId, current);
    },
    async createPendingAction(action) {
      pendingActions.set(action._id, { ...action });
    },
    async findPendingAction(id) {
      return pendingActions.get(id) ?? null;
    },
    async claimPendingAction({ actionId, accountId, now, nextStatus }) {
      const action = pendingActions.get(actionId);
      if (!action || action.accountId !== accountId || action.status !== "PENDING" || !(action.expiresAt > now)) return null;
      action.status = nextStatus;
      return { ...action };
    },
    async finishPendingAction(id, { status, result }) {
      Object.assign(pendingActions.get(id), { status, result });
    },
    async searchKnowledge({ audiences, sourceTypes }) {
      knowledgeQueries.push({ audiences, sourceTypes });
      const hits = sourceTypes.includes("movie") ? movieHits : knowledgeHits;
      return hits.filter((hit) => audiences.includes(hit.audience ?? "public"));
    },
    async getKnowledgeVersion() {
      return knowledgeVersion;
    },
    async findCacheByKey(key, now) {
      const entry = cache.get(key);
      return entry && entry.expiresAt > now ? entry : null;
    },
    async searchCache() {
      return [];
    },
    async saveCache(entry) {
      cache.set(entry.key, entry);
    },
    async recordCacheHit(key) {
      const entry = cache.get(key);
      if (entry) entry.hits += 1;
    },
    async insertTrace(trace) {
      traces.push(trace);
    },
    async insertToolCall(call) {
      toolCalls.push(call);
    },
    async listTraces() {
      return { items: traces, total: traces.length };
    },
    async getTrace(id) {
      const trace = traces.find((item) => item._id === id);
      return trace ? { ...trace, toolCalls: toolCalls.filter((call) => call.traceId === id) } : null;
    },
  };
};

// Scripted model: each entry is one Responses API turn. A function receives the request.
export const createFakeLlm = (script = []) => {
  const requests = [];
  const queue = [...script];
  const llm = {
    chatModel: "fake-model",
    embeddingModel: "fake-embedding",
    requests,
    moderations: [],
    flagModeration: false,
    push: (...turns) => queue.push(...turns),
    async respond(request) {
      requests.push(structuredClone(request));
      const next = queue.shift();
      if (!next) throw new Error("Fake LLM script is empty");
      const turn = typeof next === "function" ? next(request) : next;
      return { id: `resp_${requests.length}`, model: "fake-model", usage: { inputTokens: 10, cachedTokens: 0, outputTokens: 5 }, ...turn };
    },
    async embed(texts) {
      return { vectors: texts.map(() => [0.1, 0.2, 0.3]), tokens: texts.length };
    },
    async moderate(text) {
      llm.moderations.push(text);
      return { flagged: llm.flagModeration, categories: llm.flagModeration ? ["harassment"] : [] };
    },
  };
  return llm;
};

export const say = (text) => ({
  output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }],
  outputText: text,
});

export const callTool = (name, args = {}, callId = `call_${name}`) => ({
  output: [{ type: "function_call", call_id: callId, name, arguments: JSON.stringify(args) }],
  outputText: "",
});

export const createFakeApiCaller = (handler = () => ({ ok: true, status: 200, body: { success: true, data: [] } })) => {
  const calls = [];
  const caller = async (request) => {
    calls.push(request);
    return handler(request);
  };
  caller.calls = calls;
  return caller;
};

export const actor = (roles = [], permissions = [], accountId = "64b000000000000000000001") => ({
  kind: "account",
  accountId,
  roles: new Set(roles),
  permissions: new Set(permissions),
  displayName: "Test",
});
