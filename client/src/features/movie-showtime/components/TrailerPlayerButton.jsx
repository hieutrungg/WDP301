import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CirclePlay, Play, X } from 'lucide-react'

function getYouTubeVideoId(trailerUrl) {
  if (!trailerUrl) return ''

  try {
    const url = new URL(trailerUrl)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (!['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return ''

    const videoId = host === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.pathname === '/watch'
        ? url.searchParams.get('v')
        : url.pathname.split('/').filter(Boolean).at(-1)

    return /^[\w-]{11}$/.test(videoId ?? '') ? videoId : ''
  } catch {
    return ''
  }
}

function TrailerPlayerButton({
  trailerUrl,
  title,
  label = 'Watch Trailer',
  className = '',
  iconClassName = 'size-5',
  iconOnly = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const videoId = getYouTubeVideoId(trailerUrl)

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  const buttonContent = iconOnly
    ? <Play className={iconClassName} aria-hidden="true" />
    : <><CirclePlay className={iconClassName} aria-hidden="true" />{label}</>

  if (!trailerUrl) {
    return (
      <button
        type="button"
        aria-label={`Trailer unavailable for ${title}`}
        title="Trailer unavailable"
        disabled
        className={`${className} cursor-not-allowed opacity-50`}
      >
        {buttonContent}
      </button>
    )
  }

  if (!videoId) {
    return (
      <a
        href={trailerUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={iconOnly ? `Watch ${title} trailer` : undefined}
        className={className}
      >
        {buttonContent}
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={iconOnly ? `Watch ${title} trailer` : undefined}
        className={className}
      >
        {buttonContent}
      </button>
      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false)
          }}
        >
          <section role="dialog" aria-modal="true" aria-label={`${title} trailer`} className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low shadow-2xl">
            <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
              <h2 className="truncate font-heading text-sm font-bold text-on-surface sm:text-base">{title} · Trailer</h2>
              <button type="button" autoFocus onClick={() => setIsOpen(false)} aria-label="Close trailer" className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-on-surface transition-colors hover:bg-surface-bright">
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>
            <div className="aspect-video w-full bg-black">
              <iframe
                className="size-full"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
                title={`${title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}

export default TrailerPlayerButton
