import { ZoomIn, ZoomOut } from 'lucide-react'
import { EDITOR_TOOLS, ZOOM_LEVELS } from '../utils/editorTools'

function SeatToolbar({ tool, onToolChange, zoomIndex, onZoomChange, readOnly }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-surface-container-low px-3 py-2.5">
      <div role="toolbar" aria-label="Seat map tools" className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-container p-1">
        {EDITOR_TOOLS.map(({ id, label, shortcut, icon: Icon, hint }) => {
          const active = tool === id
          const disabled = readOnly && id !== 'select'
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToolChange(id)}
              disabled={disabled}
              aria-pressed={active}
              title={`${hint} (${shortcut})`}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'bg-primary-container text-white shadow-crimson' : 'text-tertiary hover:bg-surface-container-high hover:text-on-surface'}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{label}</span>
              <kbd className={`hidden rounded px-1 text-[10px] font-bold sm:inline ${active ? 'bg-white/20' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                {shortcut}
              </kbd>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-1.5" aria-label="Zoom">
        <button
          type="button"
          onClick={() => onZoomChange(zoomIndex - 1)}
          disabled={zoomIndex === 0}
          aria-label="Zoom out (-)"
          className="grid size-8 place-items-center rounded-lg bg-surface-container text-tertiary transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-35"
        >
          <ZoomOut className="size-4" />
        </button>
        <span className="min-w-12 text-center text-xs font-bold text-on-surface" aria-live="polite">
          {Math.round((ZOOM_LEVELS[zoomIndex] / 28) * 100)}%
        </span>
        <button
          type="button"
          onClick={() => onZoomChange(zoomIndex + 1)}
          disabled={zoomIndex === ZOOM_LEVELS.length - 1}
          aria-label="Zoom in (+)"
          className="grid size-8 place-items-center rounded-lg bg-surface-container text-tertiary transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-35"
        >
          <ZoomIn className="size-4" />
        </button>
      </div>
    </div>
  )
}

export default SeatToolbar
