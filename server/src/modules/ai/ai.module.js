import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { movieService } from "../movie/movie.service.js";
import { parseMovieListQuery } from "../movie/movie.validation.js";
import { AI_ERROR } from "./ai.constants.js";
import { createAiChatService } from "./ai-chat.service.js";
import { createAiController } from "./ai.controller.js";
import { createAiRepository } from "./ai.repository.js";
import { createAiRouter } from "./ai.routes.js";
import { createResponseCache } from "./cache/response-cache.js";
import { createOpenAiClient } from "./llm/openai.client.js";
import { runKnowledgeIngest } from "./rag/knowledge-ingest.js";
import { createRetriever } from "./rag/retriever.js";
import { createApiCaller } from "./tools/api-caller.js";
import { createTracer } from "./trace/tracer.js";

// AI-001 composition root. Built lazily on the first request, so the server starts normally
// (and every /api/ai route answers 503 AI_DISABLED) while OPENAI_API_KEY is not configured.

export const createLlmFromEnv = (config = env.ai) =>
  createOpenAiClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    chatModel: config.chatModel,
    embeddingModel: config.embeddingModel,
    moderationModel: config.moderationModel,
    storeResponses: config.storeResponses,
  });

// Published movies through the Movie module's own service and query parser (read-only).
export const listPublishedMoviePage = (page) =>
  movieService.listMovies(parseMovieListQuery({ page: String(page), limit: "24" }));

let instance = null;

const build = () => {
  const config = env.ai;
  const repository = createAiRepository();
  const llm = createLlmFromEnv(config);
  const service = createAiChatService({
    llm,
    repository,
    apiCaller: createApiCaller({ baseUrl: `http://127.0.0.1:${env.port}/api` }),
    retriever: createRetriever({ llm, repository }),
    cache: createResponseCache({ repository }),
    tracer: createTracer({ repository, retentionDays: config.traceRetentionDays }),
    traceRetentionDays: config.traceRetentionDays,
  });
  return { service, llm, repository };
};

const getInstance = () => {
  instance ??= build();
  return instance;
};

const ensureEnabled = (_req, _res, next) =>
  env.ai
    ? next()
    : next(new AppError(503, "The assistant is not configured on this server", [], AI_ERROR.DISABLED));

const controller = createAiController({
  getService: () => getInstance().service,
  runKnowledgeSync: ({ faq, movies }) => {
    const { llm, repository } = getInstance();
    return runKnowledgeIngest({ repository, llm, listMoviePage: listPublishedMoviePage, faq, movies });
  },
});

export const aiRoutes = createAiRouter({ controller, ensureEnabled });
