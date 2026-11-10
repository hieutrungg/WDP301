import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatActionExpiry, isInternalLink, parseBlocks, parseInline } from '../src/features/ai-assistant/utils/aiMessage.js'

test('AI-001 only internal app routes become links', () => {
  for (const href of ['/', '/movies', '/movies/64b0000000000000000000bb', '/booking/abc/seats', '/refunds', '/manager/refunds', '/showtimes?date=2026-11-09']) {
    assert.equal(isInternalLink(href), true, href)
  }
  for (const href of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/moviesX', '/api/ai/chat', '/movies/../admin', '', null]) {
    assert.equal(isInternalLink(href), false, String(href))
  }
})

test('AI-001 assistant markdown renders links, bold and lists as plain parts', () => {
  assert.deepEqual(parseInline('Xem [Chọn ghế](/booking/a/seats) **ngay** hoặc [đây](https://x.y)'), [
    { type: 'text', text: 'Xem ' },
    { type: 'link', text: 'Chọn ghế', href: '/booking/a/seats' },
    { type: 'text', text: ' ' },
    { type: 'bold', text: 'ngay' },
    { type: 'text', text: ' hoặc ' },
    { type: 'text', text: 'đây' },
  ])
  assert.deepEqual(parseBlocks('## Suất chiếu\n- 19:00\n- 21:30\n\nChúc xem phim vui'), [
    { type: 'paragraph', text: 'Suất chiếu' },
    { type: 'list', items: ['19:00', '21:30'] },
    { type: 'paragraph', text: 'Chúc xem phim vui' },
  ])
  assert.deepEqual(parseBlocks('<img src=x onerror=alert(1)>'), [{ type: 'paragraph', text: '<img src=x onerror=alert(1)>' }])
})

test('AI-001 a pending action shows its remaining time', () => {
  const now = Date.parse('2026-11-09T05:00:00Z')
  assert.equal(formatActionExpiry('2026-11-09T05:04:01Z', now), 'Hết hạn sau 5 phút')
  assert.equal(formatActionExpiry('2026-11-09T04:59:00Z', now), 'Đã hết hạn')
})

test('AI-001 a short typed "xác nhận" or "huỷ" answers the one waiting card', async () => {
  const { matchActionReply, singlePendingAction } = await import('../src/features/ai-assistant/utils/aiMessage.js')
  for (const text of ['Xác nhận', 'xac nhan!', ' Đồng ý ', 'OK', 'gửi đi']) assert.equal(matchActionReply(text), 'confirm', text)
  for (const text of ['Huỷ', 'hủy bỏ', 'thôi']) assert.equal(matchActionReply(text), 'cancel', text)
  for (const text of ['xác nhận giúp tôi suất 19h', 'Vé đã xác nhận chưa?', '']) assert.equal(matchActionReply(text), null, text)

  const later = new Date(Date.now() + 60000).toISOString()
  const card = (id, state = 'pending', expiresAt = later) => ({ id, state, expiresAt })
  assert.equal(singlePendingAction([{ actions: [card('a')] }, { actions: [card('b', 'done')] }]).id, 'a')
  assert.equal(singlePendingAction([{ actions: [card('a'), card('b')] }]), null, 'two cards: ambiguous')
  assert.equal(singlePendingAction([{ actions: [card('a', 'pending', '2000-01-01T00:00:00Z')] }]), null, 'expired')
  assert.equal(singlePendingAction([{ role: 'user', content: 'hi' }]), null)
})
