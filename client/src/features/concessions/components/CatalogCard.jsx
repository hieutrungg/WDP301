import { ArrowUpRight, Layers, Popcorn } from "lucide-react";
import { useState } from "react";
import { catalogBadges, catalogPrice } from "../utils/catalogPresentation";

export function CatalogImage({ item, combo = false }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(245,197,24,0.13),transparent_65%)]">
      {item.imageUrl && !failed ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="grid justify-items-center gap-3 text-secondary/70">
          {combo ? (
            <Layers className="size-16 stroke-1" />
          ) : (
            <Popcorn className="size-16 stroke-1" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
            F-Cinema {combo ? "Combo" : "Menu"}
          </span>
        </div>
      )}
    </div>
  );
}
export function CatalogBadges({ item }) {
  return catalogBadges(item).map(({ key, label }) => (
    <span
      key={key}
      className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold ${key === "special" ? "bg-secondary text-on-secondary-container" : "bg-[#28292e] text-white ring-1 ring-white/20"}`}
    >
      {label}
    </span>
  ));
}
export default function CatalogCard({ item, combo, onDetails }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/8 bg-surface-container-low transition-colors hover:border-white/20">
      <div className="relative">
        <CatalogImage key={item.imageUrl} item={item} combo={combo} />
        <div className="absolute inset-x-3 top-3 flex flex-wrap gap-2">
          <CatalogBadges item={item} />
        </div>
      </div>
      <div className="flex flex-col p-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">
          {combo ? "Combo" : item.category?.name || "Food & drink"}
        </p>
        <h2 className="min-h-12 font-heading text-base font-bold leading-6 text-white">
          {item.name}
        </h2>
        <p className="mt-1 min-h-5 text-xs text-on-surface/55">
          {combo
            ? item.items.length
              ? `${item.items.reduce((n, line) => n + line.quantity, 0)} items in this combo`
              : "Contents currently unavailable"
            : item.size || "Food & drink"}
        </p>
        <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/8 pt-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-on-surface/45">
              Price
            </p>
            <p className="mt-1 font-heading text-xl font-extrabold text-white">
              {catalogPrice(item.price)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDetails(item)}
            aria-label={`View details: ${item.name}`}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-container text-white transition-colors hover:bg-primary-container/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
          >
            <ArrowUpRight className="size-5" />
          </button>
        </div>
      </div>
    </article>
  );
}
