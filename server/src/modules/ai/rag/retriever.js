import { AI_LIMITS, KNOWLEDGE_AUDIENCE, KNOWLEDGE_SOURCE, RETRIEVAL_MIN_SCORE } from "../ai.constants.js";

// Vector retrieval over ai_knowledge_chunks (Atlas $vectorSearch). The audience filter runs inside
// the vector index, so a customer's query can never return an internal chunk. If Atlas Vector
// Search is not set up the search fails closed: no results, and the caller says so.

export const createRetriever = ({ llm, repository, minScore = RETRIEVAL_MIN_SCORE }) => {
  const embed = async (text) => {
    const { vectors, tokens } = await llm.embed([text]);
    if (!Array.isArray(vectors[0])) throw new Error("Embedding response is empty");
    return { vector: vectors[0], tokens };
  };

  const search = async ({ query, vector, audiences, sourceTypes, limit = AI_LIMITS.RETRIEVAL_LIMIT }) => {
    let tokens = 0;
    let queryVector = vector;
    if (!queryVector) {
      const embedded = await embed(query);
      queryVector = embedded.vector;
      tokens = embedded.tokens;
    }
    try {
      const hits = await repository.searchKnowledge({ vector: queryVector, audiences, sourceTypes, limit });
      return { available: true, tokens, hits: hits.filter((hit) => hit.score >= minScore) };
    } catch (error) {
      return { available: false, tokens, hits: [], error: error.message };
    }
  };

  return {
    embed,

    searchKnowledge: ({ query, audiences }) =>
      search({ query, audiences, sourceTypes: [KNOWLEDGE_SOURCE.FAQ] }),

    searchMovies: ({ query, limit = AI_LIMITS.MOVIE_RECOMMENDATION_LIMIT }) =>
      search({
        query,
        audiences: [KNOWLEDGE_AUDIENCE.PUBLIC],
        sourceTypes: [KNOWLEDGE_SOURCE.MOVIE],
        limit,
      }),
  };
};
