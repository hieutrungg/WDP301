import { ImagePlus } from "lucide-react";
import { useState } from "react";
import GenreMultiSelect from "./GenreMultiSelect";
import { MOVIE_AGE_RATINGS } from "../data/ageRatings";

const inputClass =
  "mt-2 w-full rounded-lg border border-white/10 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-60 read-only:cursor-default read-only:text-on-surface-variant";

function Field({ name, label, errors, children }) {
  return (
    <div>
      <label
        htmlFor={name}
        className="text-xs font-bold uppercase tracking-wide text-on-surface-variant"
      >
        {label}
      </label>
      {children}
      {errors[name] && (
        <p
          id={`${name}-error`}
          className="mt-1 text-sm text-red-400"
          role="alert"
        >
          {errors[name]}
        </p>
      )}
    </div>
  );
}

export default function MovieFormFields({
  form,
  errors,
  onChange,
  onGenresChange,
  disabled,
  posterFailed,
  onPosterError,
  editing = false,
  canEditDuration = false,
}) {
  const [failedLandscapeUrl, setFailedLandscapeUrl] = useState("");
  function input(name, label, options = {}) {
    return (
      <Field name={name} label={label} errors={errors} key={name}>
        <input
          id={name}
          name={name}
          value={form[name]}
          onChange={onChange}
          className={inputClass}
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `${name}-error` : undefined}
          {...options}
        />
      </Field>
    );
  }

  const ageRatings =
    form.ageRating && !MOVIE_AGE_RATINGS.includes(form.ageRating)
      ? [form.ageRating, ...MOVIE_AGE_RATINGS]
      : MOVIE_AGE_RATINGS;

  return (
    <>
      <div className="space-y-6 rounded-2xl border border-white/10 bg-surface-container-low p-5 sm:p-7">
        <h2 className="text-lg font-bold">Movie information</h2>
        {input("title", "Official theatrical title *", { required: true })}
        <div className="grid gap-5 sm:grid-cols-2">
          {input("releaseDate", "Release date *", {
            type: "date",
            required: true,
          })}
          <div>
            {input(
              "duration",
              editing ? "Runtime (minutes)" : "Duration (minutes) *",
              {
                type: "number",
                min: 1,
                step: 1,
                required: !editing || canEditDuration,
                readOnly: editing && !canEditDuration,
                "aria-describedby":
                  [
                    editing && "duration-help",
                    errors.duration && "duration-error",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined,
              },
            )}
            {editing && (
              <p
                id="duration-help"
                className="mt-2 text-xs leading-5 text-on-surface-variant"
              >
                {canEditDuration
                  ? "Runtime can be edited until a showtime references this movie."
                  : "Runtime is locked because a showtime references this movie."}
              </p>
            )}
          </div>
          <Field name="genres" label="Film genres *" errors={errors}>
            <GenreMultiSelect
              value={form.genres}
              disabled={disabled}
              invalid={!!errors.genres}
              describedBy={errors.genres ? "genres-error" : undefined}
              onChange={onGenresChange}
            />
          </Field>
          <Field name="ageRating" label="Age rating *" errors={errors}>
            <select
              id="ageRating"
              name="ageRating"
              value={form.ageRating}
              onChange={onChange}
              required
              className={`${inputClass} [color-scheme:dark]`}
              aria-invalid={!!errors.ageRating}
              aria-describedby={
                errors.ageRating ? "ageRating-error" : undefined
              }
            >
              <option value="" disabled>
                Select age rating…
              </option>
              {ageRatings.map((rating) => (
                <option key={rating} value={rating}>
                  {rating}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {input("language", "Language *", {
          required: true,
          placeholder: "e.g. Vietnamese",
        })}
        {input("director", "Director *", { required: true })}
        {input("cast", "Cast", {
          placeholder: "Separate cast members with commas",
        })}
        {input("trailerUrl", "Trailer URL", {
          type: "url",
          pattern: "https?://.*",
          placeholder: "https://",
        })}
        <Field name="synopsis" label="Synopsis *" errors={errors}>
          <textarea
            id="synopsis"
            name="synopsis"
            value={form.synopsis}
            onChange={onChange}
            required
            rows={6}
            aria-invalid={!!errors.synopsis}
            aria-describedby={errors.synopsis ? "synopsis-error" : undefined}
            className={inputClass}
          />
        </Field>
      </div>
      <aside className="space-y-5 self-start rounded-2xl border border-white/10 bg-surface-container-low p-5 sm:p-7">
        <h2 className="text-lg font-bold">
          {editing ? "Current poster" : "Poster & preview"}
        </h2>
        {input("posterUrl", "Poster URL *", {
          type: "url",
          pattern: "https?://.*",
          required: true,
          placeholder: "https://…/poster.jpg",
        })}
        <div className="mx-auto flex aspect-[2/3] w-full max-w-72 items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-surface-container-lowest">
          {form.posterUrl &&
          /^https?:\/\//i.test(form.posterUrl) &&
          !posterFailed ? (
            <img
              src={form.posterUrl}
              alt={
                form.title ? `${form.title} poster preview` : "Poster preview"
              }
              className="h-full w-full object-cover"
              onError={onPosterError}
            />
          ) : (
            <div className="p-6 text-center text-on-surface-variant">
              <ImagePlus className="mx-auto mb-3 size-10" />
              <p className="text-sm">
                {posterFailed
                  ? "Unable to load this poster. Check the image URL."
                  : "Add a poster URL to see the preview."}
              </p>
            </div>
          )}
        </div>
        <div>
          {input("landscapePosterUrl", "Landscape poster URL", {
            type: "url",
            pattern: "https?://.*",
            placeholder: "https://…/landscape.jpg",
          })}
          <div className="mt-3 flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-surface-container-lowest">
            {form.landscapePosterUrl &&
            /^https?:\/\//i.test(form.landscapePosterUrl) &&
            failedLandscapeUrl !== form.landscapePosterUrl ? (
              <img
                src={form.landscapePosterUrl}
                alt={
                  form.title
                    ? `${form.title} landscape poster preview`
                    : "Landscape poster preview"
                }
                className="size-full object-cover"
                onError={() => setFailedLandscapeUrl(form.landscapePosterUrl)}
              />
            ) : (
              <div className="p-4 text-center text-on-surface-variant">
                <ImagePlus className="mx-auto mb-2 size-8" />
                <p className="text-sm">
                  {failedLandscapeUrl === form.landscapePosterUrl &&
                  form.landscapePosterUrl
                    ? "Unable to load this image. Check the URL."
                    : "Optional wide image for movie banners."}
                </p>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs leading-5 text-on-surface-variant">
          Use an image URL accessible to your audience. Cast members are
          separated by commas.
        </p>
      </aside>
    </>
  );
}
