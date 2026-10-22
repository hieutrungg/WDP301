import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { CatalogBadges, CatalogImage } from "./CatalogCard";
import { catalogPrice } from "../utils/catalogPresentation";

export default function CatalogDetail({ item, combo, branchName, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="catalog-detail-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-surface-container-low p-0 text-on-surface shadow-2xl backdrop:bg-black/75"
    >
      <div className="relative">
        <CatalogImage item={item} combo={combo} />
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label="Close details"
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/75 text-white"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <CatalogBadges item={item} />
        </div>
        <h2
          id="catalog-detail-title"
          className="font-heading text-2xl font-bold text-white"
        >
          {item.name}
        </h2>
        <p className="mt-2 text-sm text-on-surface/60">
          {branchName}
          {item.size ? ` · ${item.size}` : ""}
        </p>
        <p className="mt-5 font-heading text-3xl font-extrabold text-secondary">
          {catalogPrice(item.price)}
        </p>
        {item.description && (
          <p className="mt-4 text-sm leading-6 text-on-surface/70">
            {item.description}
          </p>
        )}
        {combo && item.items.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface/60">
              Combo contents
            </h3>
            <ul className="mt-3 grid gap-3">
              {item.items.map((line) => (
                <li key={line.concessionId} className="flex gap-3 text-sm">
                  <span className="font-bold text-secondary">
                    {line.quantity}×
                  </span>
                  <span>
                    {line.name}
                    {line.size ? ` · ${line.size}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!item.available && (
          <p className="mt-5 rounded-lg bg-white/5 p-3 text-sm">
            This item is currently unavailable at the selected branch.
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-surface-container-high px-4 py-3 text-sm font-bold text-white hover:bg-surface-container-highest"
        >
          Continue browsing
        </button>
      </div>
    </dialog>
  );
}
