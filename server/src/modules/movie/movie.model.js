import mongoose from "mongoose";
import { MOVIE_STATUSES } from "./movie.constants.js";

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    synopsis: {
      type: String,
      required: true,
      trim: true,
    },
    genres: [{ type: String, required: true, trim: true }],
    cast: [{ type: String, trim: true }],
    duration: { type: Number, required: true, min: 1 },
    releaseDate: { type: Date, required: true },
    releaseYear: { type: Number },
    language: { type: String, required: true, trim: true },
    director: { type: String, required: true, trim: true },
    ageRating: { type: String, required: true, trim: true },
    posterUrl: { type: String, required: true, trim: true },
    trailerUrl: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: Object.values(MOVIE_STATUSES),
      default: MOVIE_STATUSES.DRAFT,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

movieSchema.index({ status: 1, releaseDate: -1, _id: -1 });
movieSchema.pre("validate", function () {
  if (this.releaseDate instanceof Date && !Number.isNaN(this.releaseDate.getTime())) {
    this.releaseYear = this.releaseDate.getUTCFullYear();
  }
});
movieSchema.index({ status: 1, genres: 1, releaseDate: -1 });
// Legacy records are backfilled by the explicit MOV-101 migration before rollout.
movieSchema.index({ title: 1, releaseYear: 1 }, {
  unique: true,
  name: "movie_title_release_year_unique",
  partialFilterExpression: { releaseYear: { $type: "number" } },
});

export const Movie = mongoose.models.Movie || mongoose.model("Movie", movieSchema);
