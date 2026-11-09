import { AI_LIMITS } from "../ai.constants.js";

// Thin OpenAI API port over the built-in fetch (no SDK dependency). Three calls only:
//   respond   Responses API with function tools
//   embed     Embeddings API
//   moderate  Moderation API
// Tests replace the whole port with a fake.

export class LlmProviderError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "LlmProviderError";
    this.status = status;
    this.code = code;
  }
}

// Reasoning models spend output tokens on reasoning; "low" keeps a chat turn fast and cheap.
// Non-reasoning models reject the `reasoning` parameter, so it is only sent for these families.
export const defaultReasoningEffort = (model = "") =>
  /^(gpt-5|o\d)/i.test(model) ? "low" : null;

export const createOpenAiClient = ({
  apiKey,
  baseUrl = "https://api.openai.com/v1",
  chatModel,
  embeddingModel,
  moderationModel,
  storeResponses = false,
  reasoningEffort = defaultReasoningEffort(chatModel),
  fetchImpl = globalThis.fetch,
  timeoutMs = AI_LIMITS.LLM_TIMEOUT_MS,
}) => {
  const post = async (path, payload) => {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new LlmProviderError(`OpenAI request failed: ${error?.name ?? "network"}`, {
        code: error?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK",
      });
    }
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    if (!response.ok) {
      throw new LlmProviderError(body?.error?.message ?? `OpenAI HTTP ${response.status}`, {
        status: response.status,
        code: body?.error?.code ?? body?.error?.type,
      });
    }
    return body;
  };

  return {
    chatModel,
    embeddingModel,

    async respond({ instructions, input, tools, toolChoice = "auto", maxOutputTokens = AI_LIMITS.MAX_OUTPUT_TOKENS, user }) {
      const body = await post("/responses", {
        model: chatModel,
        instructions,
        input,
        // tool_choice "none" keeps the tool list (earlier function_call items refer to it) but
        // forces a text answer.
        ...(tools?.length ? { tools, tool_choice: toolChoice, parallel_tool_calls: toolChoice !== "none" } : {}),
        max_output_tokens: maxOutputTokens,
        store: storeResponses,
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
        // Reasoning items must travel back with the next request when nothing is stored.
        ...(storeResponses || !reasoningEffort ? {} : { include: ["reasoning.encrypted_content"] }),
        ...(user ? { safety_identifier: user } : {}),
      });
      const output = Array.isArray(body.output) ? body.output : [];
      const outputText = output
        .filter((item) => item.type === "message")
        .flatMap((item) => item.content ?? [])
        .filter((part) => part.type === "output_text")
        .map((part) => part.text)
        .join("")
        .trim();
      return {
        id: body.id,
        model: body.model ?? chatModel,
        status: body.status,
        output,
        outputText,
        usage: {
          inputTokens: body.usage?.input_tokens ?? 0,
          cachedTokens: body.usage?.input_tokens_details?.cached_tokens ?? 0,
          outputTokens: body.usage?.output_tokens ?? 0,
        },
      };
    },

    async embed(texts) {
      const body = await post("/embeddings", { model: embeddingModel, input: texts });
      return {
        vectors: (body.data ?? [])
          .sort((left, right) => left.index - right.index)
          .map((item) => item.embedding),
        tokens: body.usage?.total_tokens ?? 0,
      };
    },

    async moderate(text) {
      const body = await post("/moderations", { model: moderationModel, input: text });
      const result = body.results?.[0] ?? {};
      return {
        flagged: result.flagged === true,
        categories: Object.entries(result.categories ?? {})
          .filter(([, flagged]) => flagged)
          .map(([name]) => name),
      };
    },
  };
};
