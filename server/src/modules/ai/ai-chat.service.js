import { createHash, randomUUID } from "node:crypto";
import { AppError } from "../../utils/AppError.js";
import {
  AI_ERROR,
  AI_LIMITS,
  AI_MESSAGES,
  CACHE_MODE,
  FAQ_CACHE_TTL_SECONDS,
  PENDING_ACTION_STATUS,
  PROMPT_VERSION,
  TOOL_CALL_STATUS,
  TOOL_KIND,
  TRACE_STATUS,
} from "./ai.constants.js";
import { actorScope, isInternalActor, knowledgeAudiences } from "./ai-actor.js";
import { checkInput, checkOutput, normalizeInput } from "./guardrails/guardrails.js";
import { LlmProviderError } from "./llm/openai.client.js";
import { buildSystemPrompt } from "./prompt/system-prompt.js";
import { TOOLS } from "./tools/tool-registry.js";
import { isToolAllowed, parseToolArguments, toOpenAiTool, toolsForActor } from "./tools/tool-policy.js";
import { sanitizeForModel, toolEnvelope } from "./tools/sanitize.js";

// AI-001 orchestrator: guardrails → cache → model/tool loop → output guard → trace.
// Ports: llm (OpenAI), apiCaller (loopback REST with the user's session), retriever (vector
// search), cache, tracer, repository. Tests build it with in-memory fakes.

const notFound = (message, code) => new AppError(404, message, [], code);

const STATUS_HINT = {
  0: "The system did not answer in time. Suggest trying again.",
  400: "The request was not accepted. Explain the reason from error.message.",
  401: "The user must sign in first (/login).",
  403: "The user is not allowed to do this.",
  404: "Not found, or the user is not allowed to see it. Do not guess.",
  409: "A business rule blocked the request. Explain the reason from error.message.",
  422: "A business rule blocked the request. Explain the reason from error.message.",
  429: "Too many requests. Ask the user to wait a moment.",
};

const hintFor = (status) => STATUS_HINT[status] ?? (status >= 500 ? "System error. Suggest trying again later." : undefined);

const hashId = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 32);

const round3 = (value) => Math.round(value * 1000) / 1000;

const elapsed = (clock, started) => clock().getTime() - started.getTime();

// Encrypted reasoning items are large and useless in a log; keep only their type.
const promptForLog = ({ instructions, input, tools }) => ({
  instructions,
  tools,
  input: input.map((item) =>
    item.type === "reasoning" ? { type: "reasoning", id: item.id } : item,
  ),
});

const MOVIE_FIELDS = ["id", "title", "genres", "duration", "ageRating", "language", "releaseDate", "synopsis", "status"];

export const createAiChatService = ({
  llm,
  apiCaller,
  retriever,
  cache,
  tracer,
  repository,
  clock = () => new Date(),
  idFactory = randomUUID,
  catalog = TOOLS,
  moderationEnabled = true,
  traceRetentionDays = 30,
}) => {
  const catalogByName = new Map(catalog.map((tool) => [tool.name, tool]));
  const retentionMs = traceRetentionDays * 24 * 60 * 60 * 1000;

  const assertConversationAccess = (conversation, actor) => {
    if (!conversation || (conversation.accountId ?? null) !== (actor.accountId ?? null)) {
      throw notFound("Conversation not found", AI_ERROR.CONVERSATION_NOT_FOUND);
    }
  };

  const callApi = async (tool, args, accessToken) => {
    const response = await apiCaller({ ...tool.request(args), accessToken });
    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        payload: { status: response.status, data: response.body?.data ?? response.body, meta: response.body?.meta },
      };
    }
    const errorCode = response.body?.code ?? `HTTP_${response.status}`;
    return {
      ok: false,
      status: response.status,
      errorCode,
      payload: {
        status: response.status,
        error: { code: errorCode, message: response.body?.message },
        hint: hintFor(response.status),
      },
    };
  };

  const runLocalTool = async (tool, args, context) => {
    if (tool.local === "knowledge") {
      const result = await retriever.searchKnowledge({
        query: args.query,
        audiences: knowledgeAudiences(context.actor),
      });
      context.trace.addEmbeddingTokens(result.tokens);
      context.trace.addRetrieval(tool.name, result.hits);
      if (!result.available) {
        return {
          ok: false,
          status: 503,
          errorCode: "KNOWLEDGE_UNAVAILABLE",
          payload: { error: { code: "KNOWLEDGE_UNAVAILABLE" }, hint: "The policy library is not available. Say you cannot check policies right now." },
        };
      }
      for (const hit of result.hits) {
        context.citations.set(`${hit.sourceId}#${hit.heading}`, { source: hit.sourceId, title: hit.title, heading: hit.heading });
      }
      return {
        ok: true,
        status: 200,
        payload: {
          results: result.hits.map((hit) => ({ source: hit.sourceId, heading: hit.heading, text: hit.text, score: round3(hit.score) })),
          ...(result.hits.length ? {} : { hint: "No matching policy. Say you do not have that information." }),
        },
      };
    }

    // recommend_movies: vector match, then every hit is re-read live so only published movies
    // with current data are returned.
    const result = await retriever.searchMovies({ query: args.description });
    context.trace.addEmbeddingTokens(result.tokens);
    context.trace.addRetrieval(tool.name, result.hits);
    if (!result.available) {
      return {
        ok: false,
        status: 503,
        errorCode: "KNOWLEDGE_UNAVAILABLE",
        payload: { error: { code: "KNOWLEDGE_UNAVAILABLE" }, hint: "Use search_movies instead." },
      };
    }
    const movies = [];
    for (const hit of result.hits) {
      const live = await apiCaller({ method: "GET", path: `/movies/${encodeURIComponent(hit.sourceId)}` });
      if (live.ok && live.body?.data) {
        const movie = live.body.data;
        movies.push({ ...Object.fromEntries(MOVIE_FIELDS.map((field) => [field, movie[field]])), match: round3(hit.score) });
      }
    }
    return {
      ok: true,
      status: 200,
      payload: { movies, ...(movies.length ? {} : { hint: "No match. Try search_movies." }) },
    };
  };

  const runToolCall = async (call, context) => {
    const started = clock();
    const tool = context.toolsByName.get(call.name);
    const record = (fields) =>
      context.trace.recordToolCall({
        tool: call.name,
        kind: tool?.kind,
        latencyMs: elapsed(clock, started),
        ...fields,
      });

    if (!tool) {
      context.toolProblems += 1;
      await record({ status: TOOL_CALL_STATUS.DENIED, args: { raw: String(call.arguments ?? "").slice(0, 500) }, errorCode: "TOOL_NOT_AVAILABLE" });
      return toolEnvelope(`tool:${call.name}`, { error: { code: "TOOL_NOT_AVAILABLE" }, hint: "This tool is not available to this user." });
    }

    const parsed = parseToolArguments(tool, call.arguments);
    if (!parsed.success) {
      context.toolProblems += 1;
      await record({ status: TOOL_CALL_STATUS.INVALID_ARGS, args: { raw: String(call.arguments ?? "").slice(0, 500) }, errorCode: "INVALID_ARGUMENTS" });
      return toolEnvelope(`tool:${tool.name}`, { error: { code: "INVALID_ARGUMENTS", issues: parsed.issues } });
    }

    if (tool.kind === TOOL_KIND.WRITE) {
      const now = clock();
      const action = {
        _id: idFactory(),
        accountId: context.actor.accountId,
        conversationId: context.conversationId,
        traceId: context.trace.id,
        tool: tool.name,
        args: parsed.data,
        summary: tool.summarize(parsed.data).slice(0, 500),
        status: PENDING_ACTION_STATUS.PENDING,
        expiresAt: new Date(now.getTime() + AI_LIMITS.PENDING_ACTION_TTL_MS),
        purgeAt: new Date(now.getTime() + retentionMs),
      };
      await repository.createPendingAction(action);
      context.pendingActions.push({ id: action._id, tool: action.tool, summary: action.summary, expiresAt: action.expiresAt });
      await record({ status: TOOL_CALL_STATUS.PENDING_CONFIRMATION, args: parsed.data, pendingActionId: action._id });
      return toolEnvelope(`tool:${tool.name}`, {
        status: "PENDING_CONFIRMATION",
        summary: action.summary,
        hint: "Nothing has changed yet. Tell the user to check the card and press \"Xác nhận\" to do it (or \"Huỷ\").",
      });
    }

    let result;
    try {
      result = tool.local
        ? await runLocalTool(tool, parsed.data, context)
        : await callApi(tool, parsed.data, context.accessToken);
    } catch (error) {
      result = { ok: false, status: 0, errorCode: "TOOL_FAILED", payload: { error: { code: "TOOL_FAILED" }, hint: hintFor(0) }, error };
    }
    context.usedTools.push({ tool, ok: result.ok });
    if (!result.ok) context.toolProblems += 1;
    const output = toolEnvelope(`tool:${tool.name}`, result.payload);
    await record({
      status: result.ok ? TOOL_CALL_STATUS.EXECUTED : TOOL_CALL_STATUS.FAILED,
      args: parsed.data,
      httpStatus: result.status,
      errorCode: result.errorCode,
      outputChars: output.length,
    });
    return output;
  };

  const chat = async ({ actor, accessToken, conversationId, message }) => {
    const now = clock();
    const scope = actorScope(actor);
    const input = normalizeInput(message);
    if (!input || input.length > AI_LIMITS.MAX_INPUT_CHARS) {
      throw new AppError(400, "Message is empty or too long", [{ field: "message", message: `1-${AI_LIMITS.MAX_INPUT_CHARS} characters` }], AI_ERROR.INVALID_INPUT);
    }

    let conversation = null;
    if (conversationId) {
      conversation = await repository.findConversation(conversationId);
      assertConversationAccess(conversation, actor);
    }
    const id = conversation?._id ?? idFactory();
    const history = (conversation?.messages ?? []).slice(-AI_LIMITS.MAX_HISTORY_MESSAGES);
    const trace = tracer.start({ accountId: actor.accountId, scope, conversationId: id, input, promptVersion: PROMPT_VERSION });

    const finish = async ({ reply, status, cacheMode, pendingActions = [], citations = [], prompt, model, error, canary }) => {
      await repository.appendMessages({
        conversationId: id,
        accountId: actor.accountId,
        scope,
        messages: [
          { role: "user", content: input, traceId: trace.id, at: now },
          { role: "assistant", content: reply, traceId: trace.id, at: clock() },
        ],
        expiresAt: new Date(now.getTime() + AI_LIMITS.CONVERSATION_TTL_MS),
      });
      await trace.finish({ status, output: reply, prompt, model, error, canary });
      return { conversationId: id, traceId: trace.id, reply, pendingActions, citations, cache: cacheMode };
    };

    // 1. Input guardrail.
    const inputVerdict = await checkInput(input, { moderate: moderationEnabled ? (text) => llm.moderate(text) : undefined });
    trace.setGuardrail("input", inputVerdict);
    if (!inputVerdict.allowed) {
      return finish({ reply: AI_MESSAGES.BLOCKED, status: TRACE_STATUS.BLOCKED, cacheMode: CACHE_MODE.SKIPPED });
    }

    // 2. Cache, first turn only: a follow-up depends on the conversation before it.
    const firstTurn = history.length === 0;
    let versions = null;
    let questionVector = null;
    let cacheKey = null;
    if (firstTurn) {
      versions = { promptVersion: PROMPT_VERSION, knowledgeVersion: await repository.getKnowledgeVersion() };
      try {
        const embedded = await retriever.embed(input);
        questionVector = embedded.vector;
        trace.addEmbeddingTokens(embedded.tokens);
      } catch {
        // Without an embedding only the exact cache is used.
      }
      const hit = await cache.lookup({ question: input, vector: questionVector, scope, versions, now });
      cacheKey = hit.key;
      trace.setCache({ mode: hit.mode, score: hit.score });
      if (hit.mode !== CACHE_MODE.MISS) {
        return finish({ reply: hit.entry.answer, citations: hit.entry.citations ?? [], status: TRACE_STATUS.CACHED, cacheMode: hit.mode });
      }
    } else {
      trace.setCache({ mode: CACHE_MODE.SKIPPED, reason: "follow_up" });
    }

    // 3. Model and tool loop.
    const tools = toolsForActor(actor, catalog);
    const openAiTools = tools.map(toOpenAiTool);
    const canary = `FC-${idFactory().replace(/-/g, "").slice(0, 16)}`;
    const instructions = buildSystemPrompt({ actor, now, canary });
    const llmInput = [
      ...history.map((item) => ({ role: item.role, content: item.content })),
      { role: "user", content: input },
    ];
    const context = {
      actor,
      accessToken,
      trace,
      conversationId: id,
      toolsByName: new Map(tools.map((tool) => [tool.name, tool])),
      pendingActions: [],
      usedTools: [],
      toolProblems: 0,
      citations: new Map(),
    };
    const prompt = () => promptForLog({ instructions, input: llmInput, tools: tools.map((tool) => tool.name) });

    let reply = "";
    let model = llm.chatModel;
    try {
      // The last round forbids tool calls, so the model has to answer with what it has.
      for (let round = 1; round <= AI_LIMITS.MAX_TOOL_ROUNDS + 1; round += 1) {
        const started = clock();
        const response = await llm.respond({
          instructions,
          input: llmInput,
          tools: openAiTools,
          toolChoice: round <= AI_LIMITS.MAX_TOOL_ROUNDS ? "auto" : "none",
          user: actor.accountId ? hashId(actor.accountId) : undefined,
        });
        model = response.model ?? model;
        trace.addLlmCall({
          round,
          model,
          latencyMs: elapsed(clock, started),
          usage: response.usage,
          outputTypes: response.output.map((item) => item.type),
          responseId: response.id,
        });
        llmInput.push(...response.output);
        const calls = response.output.filter((item) => item.type === "function_call");
        if (!calls.length) {
          reply = response.outputText;
          break;
        }
        for (const call of calls) {
          const output = await runToolCall(call, context);
          llmInput.push({ type: "function_call_output", call_id: call.call_id, output });
        }
      }
    } catch (error) {
      if (!(error instanceof LlmProviderError)) throw error;
      return finish({
        reply: AI_MESSAGES.PROVIDER_FAILED,
        status: TRACE_STATUS.ERROR,
        cacheMode: firstTurn ? CACHE_MODE.MISS : CACHE_MODE.SKIPPED,
        pendingActions: context.pendingActions,
        prompt: prompt(),
        model,
        error,
        canary,
      });
    }

    // 4. Output guardrail.
    const outputVerdict = checkOutput(reply || AI_MESSAGES.TOO_MANY_STEPS, {
      canary,
      plainLanguage: !isInternalActor(actor),
    });
    trace.setGuardrail("output", outputVerdict);
    const finalReply = outputVerdict.blocked ? AI_MESSAGES.PROMPT_LEAK : outputVerdict.text;
    const citations = [...context.citations.values()];

    // 5. Cache only answers built from public data, with no pending action and no tool problem.
    const cacheable =
      firstTurn &&
      reply &&
      !outputVerdict.blocked &&
      context.pendingActions.length === 0 &&
      context.toolProblems === 0 &&
      context.usedTools.every(({ tool }) => tool.cacheTtlSeconds > 0);
    if (cacheable) {
      const ttlSeconds = Math.min(FAQ_CACHE_TTL_SECONDS, ...context.usedTools.map(({ tool }) => tool.cacheTtlSeconds));
      const semanticEligible = context.usedTools.every(({ tool }) => tool.local === "knowledge");
      try {
        await cache.store({ key: cacheKey, question: input, vector: questionVector, scope, versions, answer: finalReply, citations, semanticEligible, ttlSeconds, now });
      } catch (error) {
        trace.log("cache.store_failed", { message: error.message });
      }
    }

    return finish({
      reply: finalReply,
      status: outputVerdict.blocked ? TRACE_STATUS.BLOCKED : TRACE_STATUS.OK,
      cacheMode: firstTurn ? CACHE_MODE.MISS : CACHE_MODE.SKIPPED,
      pendingActions: context.pendingActions,
      citations,
      prompt: prompt(),
      model,
      canary,
    });
  };

  // Claims a PENDING action atomically, or explains why it cannot be handled.
  const claimAction = async ({ actor, actionId, nextStatus }) => {
    if (actor.kind !== "account") throw notFound("Action not found", AI_ERROR.ACTION_NOT_FOUND);
    const now = clock();
    const claimed = await repository.claimPendingAction({ actionId, accountId: actor.accountId, now, nextStatus });
    if (claimed) return claimed;
    const existing = await repository.findPendingAction(actionId);
    if (!existing || existing.accountId !== actor.accountId) {
      throw notFound("Action not found", AI_ERROR.ACTION_NOT_FOUND);
    }
    if (existing.status === PENDING_ACTION_STATUS.PENDING) {
      throw new AppError(410, "This action has expired. Ask the assistant again.", [], AI_ERROR.ACTION_EXPIRED);
    }
    throw new AppError(409, "This action was already handled", [], AI_ERROR.ACTION_ALREADY_HANDLED);
  };

  const noteInConversation = async (action, actor, content) => {
    const now = clock();
    await repository.appendMessages({
      conversationId: action.conversationId,
      accountId: actor.accountId,
      scope: actorScope(actor),
      messages: [{ role: "assistant", content, traceId: action.traceId, at: now }],
      expiresAt: new Date(now.getTime() + AI_LIMITS.CONVERSATION_TTL_MS),
    });
  };

  const confirmAction = async ({ actor, accessToken, actionId }) => {
    const action = await claimAction({ actor, actionId, nextStatus: PENDING_ACTION_STATUS.EXECUTING });
    const span = tracer.attach({ traceId: action.traceId, accountId: actor.accountId, conversationId: action.conversationId });
    const started = clock();
    const tool = catalogByName.get(action.tool);
    const parsed = tool ? tool.schema.safeParse(action.args) : null;

    // Rights are checked again now: a role or permission removed since the proposal applies.
    if (!tool || !parsed?.success || !isToolAllowed(tool, actor)) {
      await repository.finishPendingAction(action._id, { status: PENDING_ACTION_STATUS.FAILED, result: { code: "TOOL_NOT_AVAILABLE" } });
      await span.recordToolCall({ tool: action.tool, kind: TOOL_KIND.WRITE, status: TOOL_CALL_STATUS.DENIED, args: action.args, errorCode: "TOOL_NOT_AVAILABLE", pendingActionId: action._id, latencyMs: 0 });
      throw notFound("Action not found", AI_ERROR.ACTION_NOT_FOUND);
    }

    let response;
    try {
      response = await apiCaller({ ...tool.request(parsed.data), accessToken });
    } catch {
      response = { ok: false, status: 0, body: { code: "TOOL_FAILED" } };
    }
    const ok = response.ok === true;
    const errorCode = ok ? undefined : response.body?.code ?? `HTTP_${response.status}`;
    await repository.finishPendingAction(action._id, {
      status: ok ? PENDING_ACTION_STATUS.EXECUTED : PENDING_ACTION_STATUS.FAILED,
      result: { httpStatus: response.status, code: errorCode },
    });
    await span.recordToolCall({
      tool: tool.name,
      kind: TOOL_KIND.WRITE,
      status: ok ? TOOL_CALL_STATUS.CONFIRMED : TOOL_CALL_STATUS.FAILED,
      args: parsed.data,
      httpStatus: response.status,
      errorCode,
      pendingActionId: action._id,
      latencyMs: elapsed(clock, started),
    });

    const message = ok
      ? `Đã thực hiện: ${action.summary}.`
      : `Không thực hiện được "${action.summary}": ${response.body?.message ?? "hệ thống không phản hồi"}.`;
    await noteInConversation(action, actor, message);
    return {
      actionId: action._id,
      status: ok ? PENDING_ACTION_STATUS.EXECUTED : PENDING_ACTION_STATUS.FAILED,
      message,
      ...(ok
        ? { data: sanitizeForModel(response.body?.data ?? null) }
        : { error: { status: response.status, code: errorCode, message: response.body?.message } }),
    };
  };

  const cancelAction = async ({ actor, actionId }) => {
    const action = await claimAction({ actor, actionId, nextStatus: PENDING_ACTION_STATUS.CANCELLED });
    await tracer
      .attach({ traceId: action.traceId, accountId: actor.accountId, conversationId: action.conversationId })
      .recordToolCall({ tool: action.tool, kind: TOOL_KIND.WRITE, status: TOOL_CALL_STATUS.CANCELLED, args: action.args, pendingActionId: action._id, latencyMs: 0 });
    const message = `Đã huỷ: ${action.summary}.`;
    await noteInConversation(action, actor, message);
    return { actionId: action._id, status: PENDING_ACTION_STATUS.CANCELLED, message };
  };

  const getConversation = async ({ actor, conversationId }) => {
    const conversation = await repository.findConversation(conversationId);
    assertConversationAccess(conversation, actor);
    return {
      conversationId: conversation._id,
      messages: conversation.messages.map(({ role, content, at, traceId }) => ({ role, content, at, traceId })),
    };
  };

  const listTraces = (query) => repository.listTraces(query);

  const getTrace = async (traceId) => {
    const trace = await repository.getTrace(traceId);
    if (!trace) throw notFound("Trace not found", AI_ERROR.TRACE_NOT_FOUND);
    return trace;
  };

  return { chat, confirmAction, cancelAction, getConversation, listTraces, getTrace };
};
