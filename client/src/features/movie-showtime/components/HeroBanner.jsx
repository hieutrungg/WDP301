import { CheckCircle2, Clock3, Film, Flame } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import TrailerPlayerButton from "./TrailerPlayerButton";

const releaseDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function HeroBanner({ movie, loading }) {
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const [failedLandscapeUrl, setFailedLandscapeUrl] = useState("");
  const hasImage =
    Boolean(movie?.posterUrl) && failedImageUrl !== movie.posterUrl;
  const hasLandscapeImage =
    Boolean(movie?.landscapePosterUrl) &&
    failedLandscapeUrl !== movie.landscapePosterUrl;
  const genres = Array.isArray(movie?.genres)
    ? movie.genres
    : (movie?.genres
        ?.split(",")
        .map((genre) => genre.trim())
        .filter(Boolean) ?? []);
  const releaseYear = movie?.releaseDate
    ? new Date(movie.releaseDate).getFullYear()
    : null;

  if (loading) {
    return (
      <section
        aria-label="Loading featured movie"
        className="relative -mt-20 min-h-[720px] overflow-hidden bg-background pb-20 pt-28"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-surface-container-highest/20 via-background/80 to-background"
        />
        <div className="relative mx-auto grid min-h-[620px] max-w-[1440px] grid-cols-12 items-center gap-4 px-4 sm:gap-6 sm:px-6 lg:gap-8 lg:px-8">
          <div className="col-span-7 min-w-0 space-y-5">
            <div className="h-7 w-52 animate-pulse rounded bg-surface-container-high" />
            <div className="h-16 max-w-xl animate-pulse rounded bg-surface-container-high" />
            <div className="h-28 max-w-2xl animate-pulse rounded bg-surface-container-high" />
            <div className="h-12 w-48 animate-pulse rounded bg-surface-container-high" />
          </div>
          <div className="col-span-5 mx-auto aspect-[2/3] w-full max-w-[360px] animate-pulse rounded-2xl bg-surface-container-high justify-self-end" />
        </div>
      </section>
    );
  }

  if (!movie) {
    return (
      <section className="flex min-h-[520px] items-center bg-[radial-gradient(circle_at_75%_35%,rgba(229,9,20,0.2),transparent_35%)] px-4 pt-20 text-center">
        <div className="mx-auto max-w-2xl">
          <Film className="mx-auto size-12 text-primary" aria-hidden="true" />
          <h1 className="mt-5 font-heading text-4xl font-extrabold text-white sm:text-5xl">
            Experience cinema at F-Cinema
          </h1>
          <p className="mt-4 leading-7 text-on-surface-variant">
            Published movies will appear here when the current cinema lineup is
            available.
          </p>
          <Link
            to="/movies"
            className="mt-7 inline-flex rounded-lg bg-primary-container px-5 py-3 text-sm font-bold text-white shadow-crimson"
          >
            Browse movies
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative isolate -mt-20 flex min-h-[720px] w-full items-center overflow-hidden bg-background pb-20 pt-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {hasLandscapeImage && (
          <img
            src={movie.landscapePosterUrl}
            alt=""
            fetchPriority="high"
            className="absolute inset-0 size-full scale-[1.02] object-cover object-center opacity-80 blur-[1px]"
            onError={() => setFailedLandscapeUrl(movie.landscapePosterUrl)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/35 to-background/5" />
        <div className="absolute -right-20 -top-32 size-[600px] rounded-full bg-secondary-container/15 blur-3xl" />
        <div className="absolute right-1/4 top-1/3 size-[480px] rounded-full bg-primary-container/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 size-[500px] rounded-full bg-surface-container-high/40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-surface-container-highest/10 via-background/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background/90" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 items-center gap-4 sm:gap-6 lg:gap-10">
          <div className="col-span-7 flex min-w-0 flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded bg-primary-container px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-primary-container shadow-md sm:text-xs">
                <span className="size-1.5 animate-pulse rounded-full bg-white" />
                Now Showing
              </span>
              {movie.ageRating && (
                <span className="rounded bg-error-container px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-error-container sm:text-xs">
                  {movie.ageRating}
                </span>
              )}
              {genres.slice(0, 2).map((genre, index) => (
                <span
                  key={genre}
                  className={`rounded border border-white/10 bg-surface-container-high px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider sm:text-xs ${index === 0 ? "text-secondary" : "text-tertiary-fixed"}`}
                >
                  {genre}
                </span>
              ))}
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2 text-secondary">
                <Flame className="size-5" aria-hidden="true" />
                <span className="font-heading text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
                  Blockbuster Spotlight
                </span>
              </div>
              <h1 className="font-heading text-[clamp(2rem,4.2vw,3.5rem)] font-extrabold leading-tight tracking-tight text-white drop-shadow-2xl">
                {movie.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-on-surface-variant sm:text-sm">
              {movie.director && (
                <>
                  <span className="font-medium text-on-surface">
                    {movie.director}
                  </span>
                  <span className="text-outline">•</span>
                </>
              )}
              {genres.length > 0 && (
                <>
                  <span>{genres.join(", ")}</span>
                  <span className="text-outline">•</span>
                </>
              )}
              {movie.duration && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-4" />
                  {movie.duration} min
                </span>
              )}
              {releaseYear && (
                <>
                  <span className="text-outline">•</span>
                  <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-[11px] font-semibold text-on-surface">
                    {releaseYear}
                  </span>
                </>
              )}
            </div>

            {movie.synopsis && (
              <p className="max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base sm:leading-7">
                {movie.synopsis}
              </p>
            )}

            {movie.cast?.length > 0 && (
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="shrink-0 font-medium text-on-surface-variant">
                  Starring:
                </span>
                <span className="truncate text-on-surface">
                  {movie.cast.slice(0, 4).join(", ")}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to={`/movies/${movie.id}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-container px-6 py-3 text-sm font-bold text-on-primary-container shadow-[0_0_24px_rgba(229,9,20,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(229,9,20,0.75)] sm:text-base"
              >
                <Film className="size-5" aria-hidden="true" />
                Explore Movie
              </Link>
              {movie.trailerUrl && (
                <TrailerPlayerButton
                  trailerUrl={movie.trailerUrl}
                  title={movie.title}
                  label="Watch Trailer"
                  iconClassName="size-5 fill-secondary text-secondary"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-high/80 px-6 py-3 text-sm font-semibold text-on-surface shadow-lg backdrop-blur-md transition-all hover:bg-surface-container-high sm:text-base"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-on-surface-variant sm:text-sm">
              {movie.language && (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-secondary" />
                  {movie.language}
                </span>
              )}
              {movie.releaseDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-secondary" />
                  {releaseDateFormatter.format(new Date(movie.releaseDate))}
                </span>
              )}
            </div>
          </div>

          <div className="col-span-5 flex min-w-0 items-center justify-end pr-2 lg:pr-5">
            <div className="group relative w-full max-w-[360px]">
              <div
                aria-hidden="true"
                className="absolute -inset-4 rounded-2xl bg-gradient-to-tr from-primary-container/30 via-secondary-container/25 to-surface-tint/20 opacity-80 blur-2xl transition-all duration-500 group-hover:opacity-100 group-hover:blur-3xl"
              />
              <div
                aria-hidden="true"
                className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary-container/40 via-secondary-container/40 to-tertiary-fixed/30 opacity-60 blur-sm"
              />
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                {hasImage ? (
                  <img
                    src={movie.posterUrl}
                    alt={`${movie.title} poster`}
                    className="size-full object-cover"
                    fetchPriority="high"
                    onError={() => setFailedImageUrl(movie.posterUrl)}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Film className="size-14 text-primary" aria-hidden="true" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroBanner;
