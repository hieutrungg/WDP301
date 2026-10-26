import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 pb-12 pt-28 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-primary">
        404 · Page not found
      </p>
      <h1 className="mt-4 font-heading text-3xl font-bold text-white">
        This page is unavailable
      </h1>
      <p className="mt-3 text-sm text-on-surface-variant">
        Check the address or return to F-Cinema to continue browsing.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-primary-container px-5 py-3 text-sm font-bold text-white"
      >
        Back to Home
      </Link>
    </section>
  );
}
