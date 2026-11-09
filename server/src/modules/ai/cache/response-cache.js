import { CACHE_MODE, SEMANTIC_CACHE_MIN_SCORE } from "../ai.constants.js";
import { sha256 } from "../rag/chunker.js";

// Cache for repeated first-turn questions. A key is bound to the actor scope (GUEST, CUSTOMER,
// STAFF...), the prompt version and the knowledge version, so a cached answer never crosses roles
// and a new prompt or re-ingest invalidates everything at once.
//   exact     same normalized question in the same scope.
//   semantic  near-identical meaning (vector score ≥ 0.97); only for FAQ-only answers, because a
//             live-data answer for "phim A" must never serve "phim B".

export const normalizeQuestion = (text) =>
  text
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const createResponseCache = ({ repository, minScore = SEMANTIC_CACHE_MIN_SCORE }) => {
  const versionTag = ({ promptVersion, knowledgeVersion }) => `${promptVersion}|kb:${knowledgeVersion}`;
  const keyOf = ({ question, scope, versions }) =>
    sha256(`${scope}\n${versionTag(versions)}\n${normalizeQuestion(question)}`);

  return {
    keyOf,

    async lookup({ question, vector, scope, versions, now }) {
      const key = keyOf({ question, scope, versions });
      const exact = await repository.findCacheByKey(key, now);
      if (exact) {
        await repository.recordCacheHit(key);
        return { mode: CACHE_MODE.EXACT, key, entry: exact, score: 1 };
      }
      if (!vector) return { mode: CACHE_MODE.MISS, key };
      try {
        const [hit] = await repository.searchCache({ vector, scope, versionTag: versionTag(versions) });
        if (hit && hit.score >= minScore && new Date(hit.expiresAt) > now) {
          await repository.recordCacheHit(hit.key);
          return { mode: CACHE_MODE.SEMANTIC, key: hit.key, entry: hit, score: hit.score };
        }
      } catch {
        // No vector index yet: exact cache only.
      }
      return { mode: CACHE_MODE.MISS, key };
    },

    async store({ key, question, vector, scope, versions, answer, citations, semanticEligible, ttlSeconds, now }) {
      const semantic = Boolean(semanticEligible && vector);
      await repository.saveCache({
        key,
        scope,
        versionTag: versionTag(versions),
        question: question.slice(0, 2000),
        ...(semantic ? { embedding: vector } : {}),
        semanticEligible: semantic,
        answer,
        citations,
        hits: 0,
        expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      });
    },
  };
};
