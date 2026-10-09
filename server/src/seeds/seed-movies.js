import { deterministicObjectId, summarizeBulkWrite } from "./seed-utils.js";

export const movieSeeds = [
  {
    seedKey: "movie:aurora-station",
    title: "Aurora Station",
    synopsis: "A rescue crew follows a signal from an abandoned research station above the Arctic Circle.",
    genres: ["Science Fiction", "Adventure"],
    cast: ["Linh Nguyen", "Minh Tran"],
    duration: 118,
    releaseDate: "2026-09-18T00:00:00.000Z",
    language: "English",
    director: "An Le",
    ageRating: "T13",
    posterUrl: "https://placehold.co/600x900/png?text=Aurora+Station",
    trailerUrl: "https://example.com/trailers/aurora-station",
    status: "PUBLISHED",
  },
  {
    seedKey: "movie:saigon-after-rain",
    title: "Saigon After Rain",
    synopsis: "Two old friends cross the city during one rainy night to return a forgotten letter.",
    genres: ["Drama", "Romance"],
    cast: ["Mai Pham", "Bao Nguyen"],
    duration: 104,
    releaseDate: "2026-08-28T00:00:00.000Z",
    language: "Vietnamese",
    director: "Ha Vu",
    ageRating: "T13",
    posterUrl: "https://placehold.co/600x900/png?text=Saigon+After+Rain",
    trailerUrl: "https://example.com/trailers/saigon-after-rain",
    status: "PUBLISHED",
  },
  {
    seedKey: "movie:the-last-projectionist",
    title: "The Last Projectionist",
    synopsis: "A retiring projectionist discovers one final film reel that changes the history of his cinema.",
    genres: ["Drama", "Mystery"],
    cast: ["Quang Ho", "Thao Do"],
    duration: 111,
    releaseDate: "2026-07-10T00:00:00.000Z",
    language: "Vietnamese",
    director: "Khanh Bui",
    ageRating: "T16",
    posterUrl: "https://placehold.co/600x900/png?text=The+Last+Projectionist",
    trailerUrl: "https://example.com/trailers/the-last-projectionist",
    status: "PUBLISHED",
  },
  {
    seedKey: "movie:orbit-kids",
    title: "Orbit Kids",
    synopsis: "Young inventors accidentally launch their school science project into low Earth orbit.",
    genres: ["Animation", "Family"],
    cast: ["F-Cinema Voice Ensemble"],
    duration: 92,
    releaseDate: "2026-06-05T00:00:00.000Z",
    language: "Vietnamese",
    director: "Vy Lam",
    ageRating: "P",
    posterUrl: "https://placehold.co/600x900/png?text=Orbit+Kids",
    trailerUrl: "https://example.com/trailers/orbit-kids",
    status: "PUBLISHED",
  },
  {
    seedKey: "movie:midnight-frequency",
    title: "Midnight Frequency",
    synopsis: "A radio host receives calls that appear to come from twenty-four hours in the future.",
    genres: ["Thriller", "Mystery"],
    cast: ["Nhi Le", "Duc Phan"],
    duration: 109,
    releaseDate: "2026-12-04T00:00:00.000Z",
    language: "English",
    director: "Son Dao",
    ageRating: "T16",
    posterUrl: "https://placehold.co/600x900/png?text=Midnight+Frequency",
    trailerUrl: "https://example.com/trailers/midnight-frequency",
    status: "DRAFT",
  },
  {
    seedKey: "movie:river-of-stars",
    title: "River of Stars",
    synopsis: "A family follows an ancient river map while rebuilding their home after a storm.",
    genres: ["Drama"],
    cast: ["Lan Vo", "Tuan Huynh"],
    duration: 101,
    releaseDate: "2025-02-14T00:00:00.000Z",
    language: "Vietnamese",
    director: "My Nguyen",
    ageRating: "T13",
    posterUrl: "https://placehold.co/600x900/png?text=River+of+Stars",
    trailerUrl: "https://example.com/trailers/river-of-stars",
    status: "ARCHIVED",
  },
];

export const seedMovies = async (database) => {
  const now = new Date();
  const operations = movieSeeds.map(({ seedKey, releaseDate, ...movie }) => {
    const _id = deterministicObjectId(seedKey);

    return {
      updateOne: {
        filter: { _id },
        update: {
          $set: { ...movie, releaseDate: new Date(releaseDate), updatedAt: now },
          $setOnInsert: { _id, createdAt: now },
        },
        upsert: true,
      },
    };
  });

  const result = await database.collection("movies").bulkWrite(operations, { ordered: true });
  return summarizeBulkWrite(result);
};
