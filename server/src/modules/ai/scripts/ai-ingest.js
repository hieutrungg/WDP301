import "dotenv/config";
import mongoose from "mongoose";
import { configureMongoDns } from "../../../config/mongo-dns.js";
import { env } from "../../../config/env.js";
import { createAiRepository } from "../ai.repository.js";
import { createLlmFromEnv, listPublishedMoviePage } from "../ai.module.js";
import { runKnowledgeIngest } from "../rag/knowledge-ingest.js";

// Embeds docs/ai-knowledge/*.md and the published movie catalog into ai_knowledge_chunks.
//   npm run ai:ingest                    FAQ (approved only) + movies
//   npm run ai:ingest -- --include-draft also FAQ files still marked `status: draft` (dev only)
//   npm run ai:ingest -- --faq           FAQ only
//   npm run ai:ingest -- --movies        movies only
// Re-running is cheap: unchanged chunks are not embedded again.

const args = new Set(process.argv.slice(2));
const onlyFaq = args.has("--faq");
const onlyMovies = args.has("--movies");

const run = async () => {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) throw new Error("MONGODB_URI is required");
  if (!env.ai) throw new Error("OPENAI_API_KEY is required");

  configureMongoDns();
  await mongoose.connect(mongodbUri);
  try {
    const report = await runKnowledgeIngest({
      repository: createAiRepository(),
      llm: createLlmFromEnv(),
      listMoviePage: listPublishedMoviePage,
      faq: !onlyMovies,
      movies: !onlyFaq,
      includeDraft: args.has("--include-draft"),
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("AI ingest failed:", error.message);
  process.exitCode = 1;
});
