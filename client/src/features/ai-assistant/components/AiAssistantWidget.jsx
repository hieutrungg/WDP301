import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Loader2, RotateCcw, Send, X } from 'lucide-react'
import popoAvatar from '../../../assets/icons/popo.svg'
import { useAiChat } from '../hooks/useAiChat'
import {
  clampLauncherPosition,
  defaultLauncherPosition,
  DRAG_THRESHOLD,
  LAUNCHER_SIZE,
  panelLayout,
  parseStoredPosition,
} from '../utils/widgetPosition'
import AiMessageContent from './AiMessageContent'
import PendingActionCard from './PendingActionCard'

const POSITION_STORAGE_KEY = 'fcinema.popo.position'

const readViewport = () => ({ width: window.innerWidth, height: window.innerHeight })

const readStoredPosition = () => {
  try {
    return parseStoredPosition(window.localStorage.getItem(POSITION_STORAGE_KEY))
  } catch {
    return null
  }
}

// Lets the viewer drag Popo (the launcher or the panel header) anywhere on screen so it does not
// cover the page. The spot is remembered per browser; a drag never counts as a click.
function useDraggablePosition() {
  const [viewport, setViewport] = useState(readViewport)
  const [stored, setStored] = useState(readStoredPosition)
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)
  const position = clampLauncherPosition(stored ?? defaultLauncherPosition(viewport), viewport)

  useEffect(() => {
    const onResize = () => setViewport(readViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!stored) return
    try {
      window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(stored))
    } catch {
      // Storage may be blocked; the position then lasts for this page view only.
    }
  }, [stored])

  const onPointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('[data-no-drag]')) return
    dragRef.current = { startX: event.clientX, startY: event.clientY, origin: position, moved: false }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    drag.moved = true
    setStored(clampLauncherPosition({ x: drag.origin.x + dx, y: drag.origin.y + dy }, readViewport()))
  }

  const onPointerUp = () => {
    if (dragRef.current?.moved) suppressClickRef.current = true
    dragRef.current = null
  }

  // Returns true once for the click that ends a drag, so the launcher does not toggle.
  const consumeDragClick = () => {
    const wasDrag = suppressClickRef.current
    suppressClickRef.current = false
    return wasDrag
  }

  return {
    position,
    viewport,
    consumeDragClick,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}

const SUGGESTIONS = {
  guest: ['Popo là ai?', 'Hôm nay có phim gì?', 'Chính sách hoàn tiền thế nào?'],
  account: ['Tối nay có suất nào?', 'Vé của tôi', 'Ghế được giữ bao lâu?'],
}

// Popo, the popcorn mascot. Loaded through <img>, so the SVG can never run script.
function PopoAvatar({ className = 'size-9', imageClassName = 'size-[85%]' }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-[#fff6e2] ${className}`}>
      <img src={popoAvatar} alt="" aria-hidden="true" className={`${imageClassName} object-contain`} draggable="false" />
    </span>
  )
}

// AI-001 floating assistant "Popo", mounted once inside the router. Hidden on the fullscreen E-Ticket.
function AiAssistantWidget() {
  const { pathname } = useLocation()
  const chat = useAiChat()
  const [draft, setDraft] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const { open, messages, isSending } = chat
  const { position, viewport, consumeDragClick, dragHandlers } = useDraggablePosition()
  const panel = panelLayout(position, viewport)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (pathname.startsWith('/tickets/')) return null

  const submit = (event) => {
    event.preventDefault()
    chat.ask(draft)
    setDraft('')
  }
  const close = () => chat.setOpen(false)

  return (
    <>
      {open ? (
        <section
          aria-label="Popo – trợ lý ảo F-Cinema"
          style={{ left: panel.left, top: panel.top, width: panel.width, height: panel.height }}
          className="fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low text-sm text-on-surface shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        >
          <header
            {...dragHandlers}
            title="Kéo để di chuyển Popo"
            className="flex cursor-grab touch-none select-none items-center gap-3 border-b border-white/5 px-4 py-3 active:cursor-grabbing"
          >
            <PopoAvatar className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-white">Popo</p>
              <p className="text-[11px] text-on-surface-variant">Trợ lý ảo của F-Cinema</p>
            </div>
            <button type="button" data-no-drag onClick={chat.newConversation} aria-label="Cuộc trò chuyện mới" title="Cuộc trò chuyện mới" className="grid size-8 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-white">
              <RotateCcw className="size-4" aria-hidden="true" />
            </button>
            <button type="button" data-no-drag onClick={close} aria-label="Đóng Popo" className="grid size-8 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-white">
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <PopoAvatar className="size-12" />
                  <p className="text-on-surface-variant"><span className="font-semibold text-white">Xin chào! Mình là Popo.</span> Mình có thể giúp bạn tìm phim, suất chiếu, bắp nước và giải đáp chính sách của F-Cinema.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS[chat.signedIn ? 'account' : 'guest'].map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => chat.ask(suggestion)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-on-surface hover:border-primary hover:text-white">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => message.role === 'user' ? (
              <div key={message.id} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary-container/90 px-3 py-2 text-white">
                {message.content}
              </div>
            ) : (
              <div key={message.id} className="flex max-w-[94%] items-end gap-2">
                <PopoAvatar className="size-6" imageClassName="size-[80%]" />
                <div className={`min-w-0 flex-1 rounded-2xl rounded-bl-sm px-3 py-2 ${message.error ? 'border border-primary/40 bg-primary-container/10' : 'bg-surface-container'}`}>
                  <AiMessageContent content={message.content} onNavigate={close} />
                  {message.actions?.map((action) => (
                    <PendingActionCard key={action.id} action={action} onConfirm={chat.confirmAction} onCancel={chat.cancelAction} />
                  ))}
                  {message.citations?.length > 0 && (
                    <p className="mt-2 border-t border-white/5 pt-1.5 text-[10px] text-on-surface-variant">
                      Nguồn: {[...new Set(message.citations.map(({ title }) => title))].join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant" role="status">
                <PopoAvatar className="size-6" imageClassName="size-[80%]" />
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Popo đang tra cứu…
              </div>
            )}
          </div>

          <form onSubmit={submit} className="flex items-end gap-2 border-t border-white/5 p-3">
            <label className="flex-1">
              <span className="sr-only">Nhập câu hỏi</span>
              <textarea
                ref={inputRef}
                rows={1}
                maxLength={2000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event)
                }}
                placeholder="Hỏi về phim, suất chiếu, vé…"
                className="max-h-28 min-h-10 w-full resize-none rounded-xl border-0 bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:bg-surface-container-high"
              />
            </label>
            <button type="submit" disabled={isSending || !draft.trim()} aria-label="Gửi" className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-container text-white disabled:opacity-40">
              <Send className="size-4" aria-hidden="true" />
            </button>
          </form>
          <p className="px-4 pb-2 text-center text-[10px] text-on-surface-variant/70">Popo có thể nhầm. Thao tác thay đổi dữ liệu luôn cần bạn xác nhận.</p>
        </section>
      ) : null}

      <button
        type="button"
        {...dragHandlers}
        onClick={() => {
          if (!consumeDragClick()) chat.setOpen(!open)
        }}
        aria-expanded={open}
        aria-label={open ? 'Đóng Popo' : 'Mở Popo – trợ lý ảo F-Cinema'}
        title={open ? undefined : 'Hỏi Popo · kéo để di chuyển'}
        style={{ left: position.x, top: position.y, width: LAUNCHER_SIZE, height: LAUNCHER_SIZE }}
        className={`fixed z-[60] grid cursor-grab touch-none select-none place-items-center overflow-hidden rounded-full shadow-[0_8px_24px_rgba(229,9,20,0.45)] ring-2 ring-primary-container transition-transform hover:scale-105 active:cursor-grabbing ${open ? 'bg-primary-container text-white' : 'bg-[#fff6e2]'}`}
      >
        {open ? <X className="size-6" aria-hidden="true" /> : <img src={popoAvatar} alt="" aria-hidden="true" className="size-11 object-contain" draggable="false" />}
      </button>
    </>
  )
}

export default AiAssistantWidget
