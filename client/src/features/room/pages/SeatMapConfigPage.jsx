import { CircleCheck, History, Info, Lock, RefreshCw, Save, TriangleAlert, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { createSeatLayoutRequest, updateSeatLayoutRequest } from '../api/roomApi'
import CapacityPanel from '../components/CapacityPanel'
import GridSetupPanel from '../components/GridSetupPanel'
import RoomPicker from '../components/RoomPicker'
import SeatGrid from '../components/SeatGrid'
import SeatInspector from '../components/SeatInspector'
import SeatLegend from '../components/SeatLegend'
import SeatToolbar from '../components/SeatToolbar'
import { useRoomList, useSeatLayout } from '../hooks/useRooms'
import { DEFAULT_ZOOM_INDEX, EDITOR_TOOLS, ZOOM_LEVELS } from '../utils/editorTools'
import {
  applyTool,
  createStarterDraft,
  draftFromLayout,
  draftsEqual,
  locateFieldError,
  seatNumbers,
  STARTER_GRID,
  summarizeDraft,
  toRequestBody,
  updateCells,
  validateDraft,
} from '../utils/seatLayout'

const RELOAD_CODES = new Set([
  'SEAT_LAYOUT_VERSION_CONFLICT',
  'SEAT_LAYOUT_ALREADY_EXISTS',
  'SEAT_LAYOUT_NOT_FOUND',
])

const getApiErrorCode = (error) => error?.response?.data?.code

// A-15: display times in Asia/Ho_Chi_Minh.
const formatSavedAt = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const layoutKey = (detail) => `${detail.room.id}:${detail.layout ? detail.layout.layoutVersion : 'new'}`

const createEditor = (detail) => {
  const draft = detail.layout ? draftFromLayout(detail.layout) : createStarterDraft()
  return {
    key: layoutKey(detail),
    roomId: detail.room.id,
    isNew: !detail.layout,
    version: detail.layout?.layoutVersion ?? 0,
    updatedAt: detail.layout?.updatedAt ?? null,
    baseline: draft,
    draft,
  }
}

const isTypingTarget = (target) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))

const toolButton =
  'inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3.5 py-2 text-sm text-on-surface transition-colors hover:bg-surface-bright disabled:pointer-events-none disabled:opacity-40'

function Banner({ tone, icon: Icon, title, children, action }) {
  const tones = {
    lock: 'border-secondary/25 bg-secondary/5 text-secondary',
    info: 'border-blue-400/20 bg-blue-500/5 text-blue-300',
    error: 'border-primary-container/40 bg-error-container/20 text-primary',
  }
  return (
    <div role={tone === 'info' ? 'status' : 'alert'} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-heading text-sm font-bold text-on-surface">{title}</p>
          <div className="mt-0.5 text-xs leading-5 text-on-surface-variant">{children}</div>
        </div>
      </div>
      {action}
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading seat map" className="grid min-h-[480px] place-items-center rounded-2xl bg-surface-container-lowest">
      <div className="grid gap-2">
        {Array.from({ length: 6 }, (_, row) => (
          <div key={row} className="flex gap-1.5">
            {Array.from({ length: 12 }, (__, column) => (
              <span key={column} className="size-6 animate-pulse rounded-t-md bg-surface-container-high" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function SeatMapConfigPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [listToken, setListToken] = useState(0)
  const [layoutToken, setLayoutToken] = useState(0)
  const [editor, setEditor] = useState(null)
  const [selection, setSelection] = useState(null)
  const [tool, setTool] = useState('STANDARD')
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState([])
  const [conflict, setConflict] = useState('')

  const roomList = useRoomList(listToken)
  const rooms = roomList.data?.items
  const requestedRoomId = searchParams.get('roomId')
  const roomId = rooms?.some(({ id }) => id === requestedRoomId) ? requestedRoomId : (rooms?.[0]?.id ?? null)

  const detailRequest = useSeatLayout(roomId, layoutToken)
  // `current` may be a stale copy while a reload is in flight; `settled` is only the fresh result.
  const current = detailRequest.data?.room.id === roomId ? detailRequest.data : null
  const settled = current && !detailRequest.loading ? current : null

  // Start (or restart) the editor whenever a different room or layout version arrives. A reload
  // of the same version keeps the Manager's draft.
  if (settled && editor?.key !== layoutKey(settled)) {
    setEditor(createEditor(settled))
    setSelection(null)
    setServerErrors([])
    setConflict('')
  }

  const active = editor && editor.roomId === roomId ? editor : null
  const editability = current?.editability ?? { locked: false, protectedShowtimeCount: 0 }
  const readOnly = !active || editability.locked || saving
  const draft = active?.draft
  const changed = Boolean(active && !draftsEqual(active.draft, active.baseline))
  const clientErrors = draft ? validateDraft(draft) : []
  const canSave = Boolean(active) && !readOnly && (active.isNew || changed) && clientErrors.length === 0

  const summary = draft ? summarizeDraft(draft) : null
  const numbers = draft ? seatNumbers(draft) : []

  const rowErrors = new Map()
  const invalidCells = new Set()
  const generalErrors = []
  for (const error of [...clientErrors, ...serverErrors]) {
    const target = draft ? locateFieldError(error.field, draft.columnCount) : null
    if (target?.type === 'row') rowErrors.set(target.rowIndex, error.message)
    else if (target?.type === 'cell') {
      invalidCells.add(`${target.rowIndex}-${target.columnIndex}`)
      generalErrors.push(error.message)
    } else generalErrors.push(error.message)
  }

  const selected =
    selection && draft && selection.roomId === roomId && selection.rowIndex < draft.rowLabels.length && selection.columnIndex < draft.columnCount
      ? selection
      : null

  const updateDraft = useCallback((update) => {
    setEditor((previous) => {
      if (!previous) return previous
      const next = typeof update === 'function' ? update(previous.draft) : update
      return next === previous.draft ? previous : { ...previous, draft: next }
    })
    setServerErrors((previous) => (previous.length ? [] : previous))
  }, [])

  const handlePaint = useCallback(
    (rowIndex, columnIndex, toggleValue) =>
      updateDraft((previous) =>
        updateCells(previous, [[rowIndex, columnIndex]], (cell) => applyTool(cell, tool, toggleValue)),
      ),
    [tool, updateDraft],
  )

  const handleSelect = useCallback(
    (rowIndex, columnIndex) => setSelection({ roomId, rowIndex, columnIndex }),
    [roomId],
  )

  const selectRoom = (nextRoomId) => {
    if (nextRoomId === roomId) return
    if (changed && !window.confirm('Discard your unsaved seat map changes?')) return
    setSearchParams({ roomId: nextRoomId }, { replace: true })
  }

  const revert = () => {
    if (!changed || !window.confirm('Revert to the last saved layout? Unsaved changes will be lost.')) return
    setEditor((previous) => ({ ...previous, draft: previous.baseline }))
    setServerErrors([])
  }

  const reloadLatest = () => {
    setEditor(null)
    setConflict('')
    setLayoutToken((token) => token + 1)
  }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setServerErrors([])
    setConflict('')

    try {
      const body = toRequestBody(active.draft)
      const result = active.isNew
        ? await createSeatLayoutRequest(roomId, body)
        : await updateSeatLayoutRequest(roomId, { ...body, expectedLayoutVersion: active.version })

      setEditor(createEditor(result))
      setLayoutToken((token) => token + 1)
      setListToken((token) => token + 1)

      if (result.changed) {
        toast.success(`Seat map saved as version ${result.layout.layoutVersion}`, {
          description: `${result.room.roomName}: ${result.layout.summary.operationalSeatCapacity} operational seats.`,
        })
      } else {
        toast.info('No changes to save')
      }
    } catch (error) {
      const code = getApiErrorCode(error)

      if (code === 'INVALID_SEAT_LAYOUT') {
        setServerErrors(getApiFieldErrors(error))
        toast.error('The seat map has problems. Fix the highlighted items and save again.')
      } else if (code === 'SEAT_LAYOUT_IN_USE') {
        toast.error(getApiErrorMessage(error))
        setLayoutToken((token) => token + 1)
      } else if (RELOAD_CODES.has(code)) {
        setConflict(getApiErrorMessage(error))
      } else if (code === 'ROOM_NOT_FOUND') {
        toast.error(getApiErrorMessage(error))
        setListToken((token) => token + 1)
      } else {
        toast.error(getApiErrorMessage(error))
      }
    } finally {
      setSaving(false)
    }
  }

  // Keyboard shortcuts read the latest state through a ref so the listener is attached once.
  const shortcutRef = useRef(null)
  useEffect(() => {
    shortcutRef.current = { save, readOnly }
  })

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        shortcutRef.current?.save()
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return

      const matchingTool = EDITOR_TOOLS.find(({ shortcut }) => shortcut.toLowerCase() === event.key.toLowerCase())
      if (matchingTool && (matchingTool.id === 'select' || !shortcutRef.current?.readOnly)) setTool(matchingTool.id)
      else if (event.key === '+' || event.key === '=') setZoomIndex((index) => Math.min(index + 1, ZOOM_LEVELS.length - 1))
      else if (event.key === '-') setZoomIndex((index) => Math.max(index - 1, 0))
      else if (event.key === 'Escape') setSelection(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!changed) return undefined
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changed])

  const room = current?.room ?? rooms?.find(({ id }) => id === roomId) ?? null
  const savedAt = formatSavedAt(active?.updatedAt)
  const effectiveTool = editability.locked ? 'select' : tool

  let status
  if (!active) status = null
  else if (editability.locked) status = { icon: Lock, text: 'Locked by published showtimes', tone: 'text-secondary' }
  else if (active.isNew) status = { icon: Info, text: 'Not saved yet', tone: 'text-blue-300' }
  else if (changed) status = { icon: TriangleAlert, text: 'Unsaved changes', tone: 'text-primary' }
  else status = { icon: CircleCheck, text: savedAt ? `Saved ${savedAt}` : 'Saved', tone: 'text-tertiary' }

  let canvas
  if (!roomId) {
    canvas = null
  } else if (detailRequest.error && !active) {
    canvas = (
      <Banner
        tone="error"
        icon={TriangleAlert}
        title="The seat map could not be loaded"
        action={
          <button type="button" onClick={() => setLayoutToken((token) => token + 1)} className={toolButton}>
            <RefreshCw className="size-4" />
            Try again
          </button>
        }
      >
        {getApiErrorMessage(detailRequest.error)}
      </Banner>
    )
  } else if (!active) {
    canvas = <EditorSkeleton />
  } else {
    canvas = (
      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest px-4 py-6 shadow-inner sm:px-6">
        <SeatGrid
          draft={draft}
          numbers={numbers}
          tool={effectiveTool}
          size={ZOOM_LEVELS[zoomIndex]}
          readOnly={readOnly}
          selected={selected}
          invalidCells={invalidCells}
          onSelect={handleSelect}
          onPaint={handlePaint}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-surface-container-low px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-[26px] font-bold leading-9 text-on-surface sm:text-[28px]">
              Configure Room Seat Maps
            </h1>
            {active && !active.isNew && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">
                <History className="size-3" />
                Layout v{active.version}
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
            <span>
              {room ? `${room.branch?.branchName ?? 'Unknown branch'} · ${room.roomName}` : 'Seating matrix editor and tier allocation'}
            </span>
            {status && (
              <span className={`inline-flex items-center gap-1 font-semibold ${status.tone}`} aria-live="polite">
                <status.icon className="size-3.5" />
                {status.text}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={revert} disabled={!changed || saving} className={toolButton} title="Revert to the last saved layout">
            <Undo2 className="size-4" />
            Revert
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            title={clientErrors.length ? 'Fix the listed problems before saving' : 'Save layout (Ctrl+S)'}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
          >
            <Save className={`size-4 ${saving ? 'animate-pulse' : ''}`} />
            {saving ? 'Saving...' : active?.isNew ? 'Create layout' : 'Save layout'}
            <kbd className="hidden rounded bg-white/20 px-1 text-[10px] sm:inline">Ctrl+S</kbd>
          </button>
        </div>
      </section>

      {conflict && (
        <Banner
          tone="error"
          icon={TriangleAlert}
          title="This seat map changed elsewhere"
          action={
            <button type="button" onClick={reloadLatest} className={toolButton}>
              <RefreshCw className="size-4" />
              Load latest (discard my draft)
            </button>
          }
        >
          {conflict}
        </Banner>
      )}

      {active && editability.locked && (
        <Banner tone="lock" icon={Lock} title={`Layout v${active.version} is locked`}>
          It is linked to {editability.protectedShowtimeCount} upcoming published showtime
          {editability.protectedShowtimeCount === 1 ? '' : 's'}, so its grid cannot be changed. You
          can still review every position. Structural changes become possible once no published
          future showtime uses this version.
        </Banner>
      )}

      {active?.isNew && !editability.locked && (
        <Banner tone="info" icon={Info} title="This room has no seat map yet">
          A starter {STARTER_GRID.rows} × {STARTER_GRID.columns} grid of Standard seats is ready. Adjust
          it, then choose Create layout to save version 1.
        </Banner>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-12">
        <div className="grid gap-5 xl:col-span-3">
          <RoomPicker
            rooms={rooms}
            loading={roomList.loading}
            error={roomList.error}
            roomId={roomId}
            room={room}
            onSelectRoom={selectRoom}
            onRetry={() => setListToken((token) => token + 1)}
          />
          {summary && <CapacityPanel summary={summary} dirty={changed || Boolean(active?.isNew)} />}
          {draft && (
            <GridSetupPanel draft={draft} readOnly={readOnly} rowErrors={rowErrors} onChange={updateDraft} />
          )}
        </div>

        <div className="grid min-w-0 gap-4 xl:col-span-6">
          {roomId && (
            <SeatToolbar
              tool={effectiveTool}
              onToolChange={setTool}
              zoomIndex={zoomIndex}
              onZoomChange={(index) => setZoomIndex(Math.min(Math.max(index, 0), ZOOM_LEVELS.length - 1))}
              readOnly={readOnly}
            />
          )}

          {generalErrors.length > 0 && (
            <div role="alert" className="rounded-2xl border border-primary-container/40 bg-error-container/20 p-4">
              <p className="flex items-center gap-2 font-heading text-sm font-bold text-on-surface">
                <TriangleAlert className="size-4 text-primary" />
                Fix before saving
              </p>
              <ul className="mt-2 grid gap-1 text-xs text-on-error-container">
                {[...new Set(generalErrors)].map((message) => (
                  <li key={message}>• {message}</li>
                ))}
              </ul>
            </div>
          )}

          {canvas}
          {active && <SeatLegend />}
        </div>

        <div className="xl:col-span-3">
          {draft && (
            <SeatInspector draft={draft} numbers={numbers} selected={selected} readOnly={readOnly} onChange={updateDraft} />
          )}
        </div>
      </div>
    </div>
  )
}

export default SeatMapConfigPage
