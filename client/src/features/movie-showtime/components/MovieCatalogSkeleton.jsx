function MovieCatalogSkeleton({ count = 8, className = 'grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6' }) {
  return (
    <div aria-label="Loading movies" className={`grid ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-white/5 bg-surface-container" aria-hidden="true">
          <div className="aspect-[2/3] animate-pulse bg-surface-container-high" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface-container-high" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-container-high" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-surface-container-high" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default MovieCatalogSkeleton
