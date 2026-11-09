import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KNOWLEDGE_AUDIENCE, KNOWLEDGE_SOURCE } from "../ai.constants.js";
import { chunkMarkdown, parseFrontmatter, sha256 } from "./chunker.js";

// Builds ai_knowledge_chunks from two sources:
//   faq    docs/ai-knowledge/*.md (only `status: approved` unless includeDraft)
//   movie  published movies, read through the Movie module's exported service
// Unchanged chunks (same contentHash) are not embedded again. Any change bumps the knowledge
// version, which invalidates the response cache.

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_KNOWLEDGE_DIR = path.resolve(HERE, "../../../../../docs/ai-knowledge");

const EMBED_BATCH = 64;

const embedAll = async (llm, texts) => {
  const vectors = [];
  let tokens = 0;
  for (let start = 0; start < texts.length; start += EMBED_BATCH) {
    const batch = await llm.embed(texts.slice(start, start + EMBED_BATCH));
    if (batch.vectors.length !== Math.min(EMBED_BATCH, texts.length - start)) {
      throw new Error("Embedding count does not match the input");
    }
    vectors.push(...batch.vectors);
    tokens += batch.tokens;
  }
  return { vectors, tokens };
};

// What is embedded: the heading path gives each piece its topic.
const embeddingText = (chunk) => `${chunk.title}\n${chunk.heading}\n\n${chunk.text}`;

const syncChunks = async ({ repository, llm, sourceType, chunks }) => {
  const existing = await repository.listChunkHashes(sourceType);
  const changed = chunks.filter((chunk) => existing.get(chunk._id) !== chunk.contentHash);
  const keep = new Set(chunks.map((chunk) => chunk._id));
  const stale = [...existing.keys()].filter((id) => !keep.has(id));

  const { vectors, tokens } = changed.length
    ? await embedAll(llm, changed.map(embeddingText))
    : { vectors: [], tokens: 0 };
  await repository.upsertChunks(
    changed.map((chunk, index) => ({ ...chunk, embedding: vectors[index], embeddingModel: llm.embeddingModel })),
  );
  const deleted = await repository.deleteChunks(stale);
  return { total: chunks.length, embedded: changed.length, deleted, tokens };
};

export const loadFaqChunks = async ({ dir = DEFAULT_KNOWLEDGE_DIR, includeDraft = false } = {}) => {
  const files = (await readdir(dir)).filter((name) => name.endsWith(".md") && name !== "README.md").sort();
  const chunks = [];
  const skipped = [];
  for (const file of files) {
    const { meta, body } = parseFrontmatter(await readFile(path.join(dir, file), "utf8"));
    const status = meta.status ?? "draft";
    if (status !== "approved" && !(includeDraft && status === "draft")) {
      skipped.push({ file, status });
      continue;
    }
    const audience = meta.audience === KNOWLEDGE_AUDIENCE.INTERNAL ? KNOWLEDGE_AUDIENCE.INTERNAL : KNOWLEDGE_AUDIENCE.PUBLIC;
    const title = meta.title || file.replace(/\.md$/, "");
    chunkMarkdown(body, title).forEach((piece, chunkIndex) => {
      chunks.push({
        _id: `${KNOWLEDGE_SOURCE.FAQ}:${file}#${chunkIndex}`,
        sourceType: KNOWLEDGE_SOURCE.FAQ,
        sourceId: file,
        chunkIndex,
        audience,
        title,
        heading: piece.heading,
        text: piece.text,
        contentHash: sha256(`${audience}\n${title}\n${piece.heading}\n${piece.text}`),
        metadata: { status, sources: meta.sources ?? [] },
      });
    });
  }
  return { chunks, files: files.length, skipped };
};

export const movieChunk = (movie) => {
  const lines = [
    `Phim: ${movie.title}`,
    movie.genres?.length && `Thể loại: ${movie.genres.join(", ")}`,
    movie.director && `Đạo diễn: ${movie.director}`,
    movie.cast?.length && `Diễn viên: ${movie.cast.join(", ")}`,
    movie.language && `Ngôn ngữ: ${movie.language}`,
    movie.duration && `Thời lượng: ${movie.duration} phút`,
    movie.ageRating && `Phân loại độ tuổi: ${movie.ageRating}`,
    movie.releaseDate && `Khởi chiếu: ${String(movie.releaseDate).slice(0, 10)}`,
    movie.synopsis && `Nội dung: ${movie.synopsis}`,
  ].filter(Boolean);
  const text = lines.join("\n");
  return {
    _id: `${KNOWLEDGE_SOURCE.MOVIE}:${movie.id}`,
    sourceType: KNOWLEDGE_SOURCE.MOVIE,
    sourceId: movie.id,
    chunkIndex: 0,
    audience: KNOWLEDGE_AUDIENCE.PUBLIC,
    title: movie.title,
    heading: "Phim",
    text,
    contentHash: sha256(text),
    metadata: { genres: movie.genres ?? [], ageRating: movie.ageRating ?? null },
  };
};

// listMoviePage(page) → { data, meta: { totalPages } } of published movies only.
export const loadMovieChunks = async ({ listMoviePage }) => {
  const chunks = [];
  for (let page = 1; page <= 200; page += 1) {
    const result = await listMoviePage(page);
    chunks.push(...result.data.map(movieChunk));
    if (page >= (result.meta?.totalPages ?? 0)) break;
  }
  return chunks;
};

export const runKnowledgeIngest = async ({
  repository,
  llm,
  listMoviePage,
  faq = true,
  movies = true,
  includeDraft = false,
  dir,
  clock = () => new Date(),
}) => {
  const report = {};
  if (faq) {
    const loaded = await loadFaqChunks({ dir, includeDraft });
    report.faq = {
      files: loaded.files,
      skipped: loaded.skipped,
      ...(await syncChunks({ repository, llm, sourceType: KNOWLEDGE_SOURCE.FAQ, chunks: loaded.chunks })),
    };
  }
  if (movies) {
    const chunks = await loadMovieChunks({ listMoviePage });
    report.movies = await syncChunks({ repository, llm, sourceType: KNOWLEDGE_SOURCE.MOVIE, chunks });
  }
  const changed = Object.values(report).some((part) => part.embedded > 0 || part.deleted > 0);
  if (changed) {
    report.knowledgeVersion = clock().toISOString();
    await repository.setKnowledgeVersion(report.knowledgeVersion);
  }
  return report;
};
