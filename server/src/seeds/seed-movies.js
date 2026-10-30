import { deterministicObjectId, summarizeBulkWrite } from "./seed-utils.js";
import { MOVIE_STATUSES } from "../modules/movie/movie.constants.js";

export const movieSeeds = [
  {
    seedKey: "movie:aurora-station",
    title: "Dune: Part Two",
    synopsis:
      "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. Facing a choice between love and the fate of the universe, he works to prevent a terrible future only he can foresee.",
    genres: ["Science Fiction", "Adventure", "Drama"],
    cast: [
      "Timothée Chalamet",
      "Zendaya",
      "Rebecca Ferguson",
      "Javier Bardem",
      "Josh Brolin",
    ],
    duration: 166,
    releaseDate: "2024-02-28T00:00:00.000Z",
    language: "English",
    director: "Denis Villeneuve",
    ageRating: "T13",
    posterUrl:
      "https://image.tmdb.org/t/p/original/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    landscapePosterUrl:
      "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
    trailerUrl: "https://www.youtube.com/watch?v=U2Qp5pL3ovA",
    status: MOVIE_STATUSES.PUBLISHED,
  },
  {
    seedKey: "movie:saigon-after-rain",
    title: "Oppenheimer",
    synopsis:
      "During World War II, physicist J. Robert Oppenheimer is appointed scientific director of the secret Manhattan Project. His work changes history, but the political and moral consequences follow him long after the atomic bomb is created.",
    genres: ["Drama", "History"],
    cast: [
      "Cillian Murphy",
      "Emily Blunt",
      "Matt Damon",
      "Robert Downey Jr.",
      "Florence Pugh",
    ],
    duration: 181,
    releaseDate: "2023-07-19T00:00:00.000Z",
    language: "English",
    director: "Christopher Nolan",
    ageRating: "T13",
    posterUrl:
      "https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    landscapePosterUrl:
      "https://image.tmdb.org/t/p/original/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg",
    trailerUrl: "https://www.youtube.com/watch?v=uYPbbksJxIg",
    status: MOVIE_STATUSES.PUBLISHED,
  },
  {
    seedKey: "movie:the-last-projectionist",
    title: "Inside Out 2",
    synopsis:
      "Riley enters her teenage years and the headquarters inside her mind is suddenly demolished to make room for new emotions. Joy, Sadness, Anger, Fear and Disgust face an unexpected arrival: Anxiety.",
    genres: ["Animation", "Family", "Adventure", "Comedy"],
    cast: [
      "Amy Poehler",
      "Maya Hawke",
      "Kensington Tallman",
      "Liza Lapira",
      "Tony Hale",
    ],
    duration: 96,
    releaseDate: "2024-06-11T00:00:00.000Z",
    language: "English",
    director: "Kelsey Mann",
    ageRating: "P",
    posterUrl:
      "https://image.tmdb.org/t/p/original/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg",
    landscapePosterUrl:
      "https://image.tmdb.org/t/p/original/p5ozvmdgsmbWe0H8Xk7Rc8SCwAB.jpg",
    trailerUrl: "https://www.youtube.com/watch?v=LEjhY15eCx0",
    status: MOVIE_STATUSES.PUBLISHED,
  },
  {
    seedKey: "movie:orbit-kids",
    title: "The Wild Robot",
    synopsis:
      "After a shipwreck, an intelligent robot named Roz is stranded on an uninhabited island. To survive the harsh environment, Roz builds relationships with the animals and becomes the adoptive parent of an orphaned gosling.",
    genres: ["Animation", "Science Fiction", "Family", "Adventure"],
    cast: [
      "Lupita Nyong'o",
      "Pedro Pascal",
      "Kit Connor",
      "Bill Nighy",
      "Stephanie Hsu",
    ],
    duration: 102,
    releaseDate: "2024-09-12T00:00:00.000Z",
    language: "English",
    director: "Chris Sanders",
    ageRating: "P",
    posterUrl:
      "https://image.tmdb.org/t/p/original/wTnV3PCVW5O92JMrFvvrRcV39RU.jpg",
    landscapePosterUrl:
      "https://image.tmdb.org/t/p/original/v9acaWVVFdZT5yAU7J2QjwfhXyD.jpg",
    trailerUrl: "https://www.youtube.com/watch?v=67vbA5ZJdKQ",
    status: MOVIE_STATUSES.PUBLISHED,
  },
  {
    seedKey: "movie:midnight-frequency",
    title: "Inception",
    synopsis:
      "Dom Cobb is a skilled thief who steals secrets through shared dreams. Offered a chance to erase his criminal past, he must accomplish the impossible task of inception: planting an idea in a target's subconscious.",
    genres: ["Science Fiction", "Action", "Thriller"],
    cast: [
      "Leonardo DiCaprio",
      "Joseph Gordon-Levitt",
      "Elliot Page",
      "Tom Hardy",
      "Ken Watanabe",
    ],
    duration: 148,
    releaseDate: "2010-07-15T00:00:00.000Z",
    language: "English",
    director: "Christopher Nolan",
    ageRating: "T16",
    posterUrl:
      "https://image.tmdb.org/t/p/original/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    landscapePosterUrl:
      "https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
    trailerUrl: "https://www.youtube.com/watch?v=YoHD9XEInc0",
    status: MOVIE_STATUSES.DRAFT,
  },
  {
    seedKey: "movie:river-of-stars",
    title: "Parasite",
    synopsis:
      "The struggling Kim family gradually works its way into the home of the wealthy Park family. Their carefully constructed arrangement begins to unravel when an unexpected discovery exposes secrets hidden beneath the house.",
    genres: ["Drama", "Thriller", "Comedy"],
    cast: [
      "Song Kang-ho",
      "Lee Sun-kyun",
      "Cho Yeo-jeong",
      "Choi Woo-shik",
      "Park So-dam",
    ],
    duration: 133,
    releaseDate: "2019-05-30T00:00:00.000Z",
    language: "Korean",
    director: "Bong Joon Ho",
    ageRating: "T16",
    posterUrl:
      "https://image.tmdb.org/t/p/original/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    landscapePosterUrl:
      "https://image.tmdb.org/t/p/original/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg",
    trailerUrl: "https://www.youtube.com/watch?v=5xH0HfJHsaY",
    status: MOVIE_STATUSES.ARCHIVED,
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
          $set: {
            ...movie,
            releaseDate: new Date(releaseDate),
            releaseYear: new Date(releaseDate).getUTCFullYear(),
            updatedAt: now,
          },
          $setOnInsert: { _id, createdAt: now },
        },
        upsert: true,
      },
    };
  });
  const result = await database
    .collection("movies")
    .bulkWrite(operations, { ordered: true });
  return summarizeBulkWrite(result);
};
