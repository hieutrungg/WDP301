// Local manual QA only: node test/fixtures/movie-archive-preview.mjs --serve
// Every /api request terminates here in memory; never uses the development DB.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

if (!process.argv.includes('--serve')) process.exit(0)
let scenario = 'success'
const requests = []
const movie = { id: '111111111111111111111111', title: 'MOV-103 · The Last Screening', duration: 120,
  releaseDate: '2026-01-01T00:00:00Z', ageRating: 'T13', status: 'PUBLISHED', posterUrl: '/src/assets/hero.png' }
const server = await createServer({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port: 5176, strictPort: true },
  plugins: [{ name: 'movie-archive-qa-only', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (!req.url.startsWith('/api/') && !req.url.startsWith('/__fixture')) return next()
      const send = (data, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)) }
      if (req.url === '/__fixture') return send({ scenario, requests, movie })
      if (req.url.startsWith('/__fixture/scenario/')) {
        scenario = req.url.split('/').at(-1); movie.status = 'PUBLISHED'; requests.length = 0
        return send({ scenario })
      }
      requests.push({ method: req.method, url: req.url })
      if (req.url === '/api/auth/me') return send({ success: true, data: { id: '222222222222222222222222', username: 'archive-qa', status: 'ACTIVE', roles: [{ name: 'MANAGER' }], permissions: [{ name: 'movie.update' }, ...(scenario === 'no-grant' ? [] : [{ name: 'movie.archive' }])] } })
      if (req.method === 'GET' && req.url.startsWith('/api/movies/manage')) return send({ success: true, data: [{ ...movie }], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } })
      if (req.method === 'POST' && req.url === `/api/movies/${movie.id}/archive`) {
        await new Promise((resolve) => setTimeout(resolve, 1800))
        if (scenario === 'conflict') return send({ success: false, code: 'INVALID_MOVIE_INPUT', message: 'Movie cannot be archived until its showtime dependencies are resolved', errors: [{ field: 'showtimes', id: '333333333333333333333333', message: 'Upcoming showtime' }] }, 409)
        if (scenario === 'forbidden') return send({ success: false, code: 'FORBIDDEN', message: 'Forbidden' }, 403)
        if (scenario === 'missing') return send({ success: false, code: 'MOVIE_NOT_FOUND', message: 'Movie not found' }, 404)
        if (scenario === 'failure') return send({ success: false, message: 'Internal server error' }, 500)
        movie.status = 'ARCHIVED'
        return send({ success: true, data: { ...movie, updatedAt: new Date().toISOString() } })
      }
      return send({ success: false, message: 'No fixture route' }, 404)
    })
  } }],
})
await server.listen()
console.log('MOV-103 QA fixture at http://127.0.0.1:5176/manager/movies')
