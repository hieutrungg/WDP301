export const REVIEW_UNIQUE_INDEX_NAME = "uniq_movie_review_customer";
export const REVIEW_UNIQUE_INDEX_KEYS = { movieId: 1, customerAccountId: 1 };

export const isReviewUniqueIndex = (index) => index.unique === true &&
  !index.sparse && !index.partialFilterExpression && index.expireAfterSeconds === undefined &&
  (!index.collation || index.collation.locale === "simple") &&
  JSON.stringify(Object.entries(index.key)) === JSON.stringify(Object.entries(REVIEW_UNIQUE_INDEX_KEYS));

export const hasReviewUniqueIndex = async (database) => {
  try {
    return (await database.collection("movie_reviews").listIndexes().toArray()).some(isReviewUniqueIndex);
  } catch (error) {
    if (error.code === 26) return false;
    throw error;
  }
};
