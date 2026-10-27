import mongoose from "mongoose";
import { hasReviewUniqueIndex } from "./movie-review.indexes.js";

export const createMovieReviewWriteRepository = (connection = mongoose.connection) => ({
  ready() { return hasReviewUniqueIndex(connection.db); },
  findOwn(movieId, accountId, session) {
    return connection.db.collection("movie_reviews").findOne({
      movieId: new mongoose.Types.ObjectId(movieId), customerAccountId: new mongoose.Types.ObjectId(accountId),
    }, { projection: { _id: 1 }, ...(session ? { session } : {}) });
  },
  async insert({ movieId, accountId, rating, content, now }, session) {
    const document = { _id: new mongoose.Types.ObjectId(), movieId: new mongoose.Types.ObjectId(movieId),
      customerAccountId: new mongoose.Types.ObjectId(accountId), rating, content, createdAt: now, updatedAt: now };
    await connection.db.collection("movie_reviews").insertOne(document, { session });
    return document;
  },
  async withTransaction(work) {
    const session = await connection.startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await work(session); }, {
        readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
      });
      return result;
    } finally { await session.endSession(); }
  },
});

export const movieReviewWriteRepository = createMovieReviewWriteRepository();
