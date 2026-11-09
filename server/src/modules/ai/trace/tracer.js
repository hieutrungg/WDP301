import { randomUUID } from "node:crypto";
import { redactText, redactValue, stripSecret } from "./redact.js";

// One trace per chat request (ai_traces) and one span per tool call (ai_tool_calls). Each event is
// also written to the console as one JSON line carrying the traceId. Logging never fails a chat.

export const consoleLogger = Object.freeze({
  info: (event) => console.info(JSON.stringify(event)),
  error: (event) => console.error(JSON.stringify(event)),
});

export const silentLogger = Object.freeze({ info: () => {}, error: () => {} });

export const createTracer = ({
  repository,
  clock = () => new Date(),
  idFactory = randomUUID,
  retentionDays = 30,
  logger = consoleLogger,
}) => {
  const expiry = (now) => new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

  const safely = async (label, traceId, work) => {
    try {
      await work();
    } catch (error) {
      logger.error({ at: clock().toISOString(), traceId, event: `ai.${label}.persist_failed`, message: error.message });
    }
  };

  const writeToolCall = async (context, { conversationId: callConversationId, ...call }) => {
    const at = clock();
    const document = {
      _id: idFactory(),
      traceId: context.traceId,
      conversationId: callConversationId ?? context.conversationId,
      accountId: call.accountId ?? context.accountId ?? null,
      tool: call.tool,
      kind: call.kind,
      status: call.status,
      args: redactValue(call.args ?? {}),
      httpStatus: call.httpStatus,
      errorCode: call.errorCode,
      outputChars: call.outputChars,
      latencyMs: call.latencyMs,
      pendingActionId: call.pendingActionId,
      at,
      expiresAt: expiry(at),
    };
    context.log("tool.call", {
      tool: document.tool,
      kind: document.kind,
      status: document.status,
      httpStatus: document.httpStatus,
      latencyMs: document.latencyMs,
      args: document.args,
    });
    await safely("tool_call", context.traceId, () => repository.insertToolCall(document));
  };

  const logFor = (traceId) => (event, data = {}) =>
    logger.info({ at: clock().toISOString(), traceId, event: `ai.${event}`, ...redactValue(data) });

  const start = ({ traceId = idFactory(), accountId, scope, conversationId, input, promptVersion }) => {
    const startedAt = clock();
    const state = {
      guardrails: {},
      cache: null,
      retrieval: [],
      llmCalls: [],
      toolNames: [],
      usage: { inputTokens: 0, cachedTokens: 0, outputTokens: 0, embeddingTokens: 0 },
    };
    const log = logFor(traceId);

    log("chat.start", { scope, conversationId, accountId });

    return {
      id: traceId,
      log,

      setGuardrail(stage, verdict) {
        state.guardrails[stage] = verdict;
        if (verdict?.allowed === false || verdict?.blocked) log("guardrail.blocked", { stage, reasons: verdict.reasons });
      },

      setCache(cache) {
        state.cache = cache;
        log("cache", cache);
      },

      addRetrieval(tool, hits) {
        for (const hit of hits) {
          state.retrieval.push({ tool, chunkId: hit._id, source: hit.sourceId, heading: hit.heading, score: hit.score });
        }
      },

      addEmbeddingTokens(tokens) {
        state.usage.embeddingTokens += tokens ?? 0;
      },

      addLlmCall({ round, model, latencyMs, usage, outputTypes, responseId }) {
        state.llmCalls.push({ round, model, latencyMs, usage, outputTypes, responseId });
        state.usage.inputTokens += usage?.inputTokens ?? 0;
        state.usage.cachedTokens += usage?.cachedTokens ?? 0;
        state.usage.outputTokens += usage?.outputTokens ?? 0;
        log("llm.call", { round, model, latencyMs, usage, outputTypes });
      },

      async recordToolCall(call) {
        state.toolNames.push(call.tool);
        await writeToolCall({ traceId, conversationId, accountId, log }, call);
      },

      async finish({ status, output, prompt, model, error, canary }) {
        const finishedAt = clock();
        const latencyMs = finishedAt.getTime() - startedAt.getTime();
        const document = {
          _id: traceId,
          accountId: accountId ?? null,
          scope,
          conversationId,
          promptVersion,
          model,
          status,
          input: redactText(input),
          output: redactText(output ?? ""),
          guardrails: state.guardrails,
          cache: state.cache,
          retrieval: state.retrieval,
          llmCalls: state.llmCalls,
          usage: state.usage,
          prompt: prompt ? redactValue(stripSecret(prompt, canary)) : undefined,
          toolNames: state.toolNames,
          error: error ? { message: error.message, code: error.code, status: error.status } : undefined,
          latencyMs,
          startedAt,
          expiresAt: expiry(startedAt),
        };
        log("chat.finish", { status, latencyMs, usage: state.usage, tools: state.toolNames, cache: state.cache?.mode });
        await safely("trace", traceId, () => repository.insertTrace(document));
      },
    };
  };

  // A later request (confirming a PendingAction) adds spans to the trace that created it.
  const attach = ({ traceId, accountId, conversationId }) => ({
    id: traceId,
    log: logFor(traceId),
    recordToolCall: (call) =>
      writeToolCall({ traceId, accountId, conversationId, log: logFor(traceId) }, call),
  });

  return { start, attach };
};
