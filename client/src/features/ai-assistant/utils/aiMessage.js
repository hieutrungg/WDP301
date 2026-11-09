// AI-001: renders the assistant's small markdown subset without HTML. Only internal links become
// links; anything else stays plain text. Pure functions, covered by client/test/ai-message.test.js.

const ALLOWED_PREFIXES = [
  '/movies', '/showtimes', '/concessions', '/booking/', '/bookings/', '/my-tickets',
  '/booking-history', '/refunds', '/profile', '/tickets', '/login', '/register',
  '/forgot-password', '/staff', '/manager', '/admin',
]

export function isInternalLink(href) {
  if (typeof href !== 'string' || href === '/') return href === '/'
  if (!/^\/(?!\/)[A-Za-z0-9\-._~/%?=&#]*$/.test(href) || href.includes('..')) return false
  return ALLOWED_PREFIXES.some((prefix) => prefix.endsWith('/')
    ? href.startsWith(prefix)
    : href === prefix || href.startsWith(`${prefix}/`) || href.startsWith(`${prefix}?`))
}

const INLINE = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)|\*\*([^*\n]{1,300})\*\*/g

// -> [{ type: 'text' | 'link' | 'bold', text, href? }]
export function parseInline(text) {
  const parts = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push({ type: 'text', text: text.slice(last, match.index) })
    if (match[3] !== undefined) parts.push({ type: 'bold', text: match[3] })
    else if (isInternalLink(match[2])) parts.push({ type: 'link', text: match[1], href: match[2] })
    else parts.push({ type: 'text', text: match[1] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  return parts
}

// -> [{ type: 'paragraph', text } | { type: 'list', items: string[] }]
export function parseBlocks(text) {
  const blocks = []
  let paragraph = []
  let list = null
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
    paragraph = []
  }
  const flushList = () => {
    if (list) blocks.push(list)
    list = null
  }
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    const item = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line)
    if (item) {
      flushParagraph()
      list ??= { type: 'list', items: [] }
      list.items.push(item[1].replace(/^#+\s*/, ''))
    } else if (!line.trim()) {
      flushParagraph()
      flushList()
    } else {
      flushList()
      paragraph.push(line.replace(/^#{1,6}\s+/, ''))
    }
  }
  flushParagraph()
  flushList()
  return blocks
}

export function formatActionExpiry(expiresAt, now = Date.now()) {
  const remaining = Date.parse(expiresAt) - now
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Đã hết hạn'
  const minutes = Math.ceil(remaining / 60000)
  return `Hết hạn sau ${minutes} phút`
}
