// Manual browser integration fixture: node test/fixtures/checkout-preview.mjs --serve
// Runs the real frontend on loopback :5174. All /api requests are intercepted in memory.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

// A broad node --test discovery must never start a persistent preview server.
if (!process.argv.includes('--serve')) process.exit(0)

const showtimeId = '111111111111111111111111'
const ownerId = '222222222222222222222222'
const seatId = '333333333333333333333333'
const holds = new Map(), bookings = new Map()
const requests = []
let scenario = 'normal'
const server = await createServer({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  plugins: [{
    name: 'checkout-fixture-only',
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/') && !req.url.startsWith('/__fixture')) return next()
        const send = (data, status = 200) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        }
        if (req.url === '/__fixture') return send({ scenario, requests, holds: holds.size, bookings: bookings.size })
        if (req.url.startsWith('/__fixture/scenario/')) {
          scenario = req.url.split('/').at(-1)
          return send({ scenario })
        }
        let raw = ''
        for await (const chunk of req) raw += chunk
        const body = raw ? JSON.parse(raw) : {}
        requests.push({ method: req.method, url: req.url, body })
        if (req.url === '/api/auth/me') return send({ success: true, data: { id: ownerId, username: 'checkout-fixture', status: 'ACTIVE', roles: [{ name: 'CUSTOMER' }], permissions: [{ code: 'booking.create' }] } })
        if (req.url.endsWith('/seats')) return send({ success: true, data: {
          showtimeId, roomLayoutVersion: 1, generatedAt: new Date().toISOString(),
          showtime: { movie: { title: 'FLOW-002 · Test session', duration: 120 }, room: { roomName: 'Room 01', roomType: 'STANDARD' }, cinema: { branchName: 'Local test cinema' }, startAt: new Date(Date.now() + 3600000).toISOString() },
          seats: [{ seatId, row: 'B', number: 3, type: 'VIP', price: 110500, availability: 'AVAILABLE' }],
        } })
        if (req.url === '/api/seat-holds') {
          if (scenario === 'conflict') return send({ success: false, code: 'SEAT_UNAVAILABLE', message: 'Another customer has reserved this seat.' }, 409)
          if (!holds.has(body.checkoutKey)) holds.set(body.checkoutKey, {
            holdId: '444444444444444444444444', ownerId, showtimeId, seatIds: [seatId], status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 600000).toISOString(),
            priceQuote: { quoteId: 'fixture-quote', currency: 'VND', lines: [{ seatId, unitPrice: 110500 }], totalAmount: 110500 },
          })
          const hold = holds.get(body.checkoutKey)
          return send({ success: true, data: { ...hold, serverNow: new Date().toISOString(), ...(scenario === 'expired' ? { serverNow: new Date(Date.parse(hold.expiresAt) + 1000).toISOString(), status: 'EXPIRED' } : {}) } })
        }
        if (req.url.startsWith('/api/seat-holds/') && req.method === 'DELETE') {
          for (const hold of holds.values()) hold.status = 'RELEASED'
          return send({ success: true, data: { status: 'RELEASED' } })
        }
        if (req.url === '/api/bookings') {
          if (!bookings.has(body.requestKey)) bookings.set(body.requestKey, {
            bookingId: '555555555555555555555555', payableReference: 'PAY-FIXTURE-ONLY', status: 'PENDING_PAYMENT',
            amount: 110500, currency: 'VND', expiresAt: [...holds.values()].at(-1).expiresAt,
          })
          if (scenario === 'lost-response') {
            scenario = 'normal'
            return send({ success: false, message: 'Simulated response failure after commit' }, 503)
          }
          return send({ success: true, data: bookings.get(body.requestKey) })
        }
        // Never proxy unknown fixture routes to the development backend.
        return send({ success: false, message: 'No fixture for this endpoint', data: [] }, 404)
      })
    },
  }],
})
await server.listen()
console.log(`Fixture only: http://127.0.0.1:5174/booking/${showtimeId}/seats`)
