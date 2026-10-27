import mongoose from "mongoose";

export const REVIEW_PAGE_SIZE = 10;

// Native read adapter intentionally creates no model, collection, validator or index.
// This is the existing movie_reviews source, not a second review store.
export const createMovieReviewRepository = (getDb = () => mongoose.connection.db) => ({
  async list(movieId, page) {
    const [result] = await getDb().collection("movie_reviews").aggregate([
      { $match: { movieId: new mongoose.Types.ObjectId(movieId) } },
      { $facet: {
        items: [
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: (page - 1) * REVIEW_PAGE_SIZE },
          { $limit: REVIEW_PAGE_SIZE },
          { $project: {
            _id: 1, customerAccountId: 1, rating: 1, content: 1, createdAt: 1,
            // Inspect field names before discarding unknown moderation/privacy fields.
            storedFields: { $map: { input: { $objectToArray: "$$ROOT" }, as: "field", in: "$$field.k" } },
          } },
        ],
        count: [{ $count: "total" }],
      } },
    ]).toArray();
    return { items: result?.items ?? [], total: result?.count[0]?.total ?? 0 };
  },
});

export const movieReviewRepository = createMovieReviewRepository();
