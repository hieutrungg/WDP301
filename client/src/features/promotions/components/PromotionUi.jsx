import { getApiErrorMessage } from "../../../lib/api/apiError";

export const inputClass =
  "w-full rounded-lg border border-white/15 bg-surface-container-high px-3 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";
export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#e50914] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary";
export const panelClass =
  "rounded-2xl border border-white/10 bg-surface-container-low p-5 sm:p-6";
export function ErrorNotice({ error, retry }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-error"
    >
      <p>{error.isAxiosError ? getApiErrorMessage(error) : error.message}</p>
      {error.response?.data?.errors?.map((e) => (
        <p key={e.field}>
          {e.field}: {e.message}
        </p>
      ))}
      {retry && (
        <button type="button" className="mt-2 underline" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
export function StatusBadge({ children }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${children === "Active" || children === "ACTIVE" ? "bg-emerald-400/10 text-emerald-400" : children === "Scheduled" ? "bg-cyan-400/10 text-cyan-300" : "bg-white/10 text-on-surface-variant"}`}
    >
      {children}
    </span>
  );
}
export function Pagination({ page, meta, onPage }) {
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
    >
      <span className="text-on-surface-variant">
        {meta?.total ?? 0} results · Page {page} of{" "}
        {Math.max(1, meta?.totalPages ?? 1)}
      </span>
      <div className="flex gap-3">
        <button
          className={buttonClass}
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          className={buttonClass}
          type="button"
          disabled={page >= (meta?.totalPages ?? 1)}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
