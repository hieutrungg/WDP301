// QA only: node test/fixtures/movie-reviews-preview.mjs --serve
// All API responses terminate in memory. No MongoDB connection, seeds or external reviews.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

if (!process.argv.includes('--serve')) process.exit(0)
let mode = 'list'
let failOnce = false
let failPostOnce = false
let published = null
const a = '111111111111111111111111', b = '222222222222222222222222'
const server = await createServer({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port: 5177, strictPort: true },
  plugins: [{ name: 'rev101-isolated-qa', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://127.0.0.1:5177')
      const send = (data, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)) }
      if (url.pathname.startsWith('/__review-mode/')) {
        mode = url.pathname.split('/').at(-1); failOnce = mode === 'error'; failPostOnce = mode === 'post-error'; published = null
        return send({ mode })
      }
      if (url.pathname === '/__review-preview') {
        res.setHeader('Content-Type', 'text/html')
        return res.end(await vite.transformIndexHtml(req.url, `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>REV-101 isolated QA</title><div id="root"></div><script type="module">
          import React,{useState} from 'react';
          import {createRoot} from 'react-dom/client';
          import MovieReviews from '/src/features/movie-showtime/components/MovieReviews.jsx';
          import {useAuthStore} from '/src/features/auth/store/authStore.js';
          import '/src/index.css';
          function Harness(){const [movie,setMovie]=useState('${a}');const [version,setVersion]=useState(0);
            async function scenario(name){await fetch('/__review-mode/'+name);setVersion(v=>v+1)}
            return React.createElement('main',{style:{paddingTop:24}},
              React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:12,padding:'0 24px 24px'}},
                React.createElement('strong',null,'QA fixtures only'),
                ...['list','empty','error','ineligible','already','post-error','write-not-ready'].map(s=>React.createElement('button',{key:s,onClick:()=>scenario(s)},s)),
                ...['Guest','Customer','Staff'].map(role=>React.createElement('button',{key:role,onClick:()=>useAuthStore.setState({account:role==='Guest'?null:{id:'fixture-account',status:'ACTIVE',roles:[{name:role.toUpperCase()}]}})},role)),
                React.createElement('button',{onClick:()=>setMovie('${a}')},'Movie A'),React.createElement('button',{onClick:()=>setMovie('${b}')},'Movie B')),
              React.createElement(MovieReviews,{key:movie+version,movieId:movie}))}
          createRoot(document.getElementById('root')).render(React.createElement(Harness));
        </script></html>`))
      }
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname.endsWith('/review-eligibility')) return send({ success: true, data: {
          canReview: !published && !['ineligible','already'].includes(mode), reason: published || mode === 'already' ? 'ALREADY_REVIEWED' : mode === 'ineligible' ? 'NO_ELIGIBLE_BOOKING' : null,
        } })
        const match = url.pathname.match(/^\/api\/movies\/([a-f0-9]{24})\/reviews$/)
        if (!match) return send({ success: false, message: 'QA route not found' }, 404)
        const movieId = match[1], page = Number(url.searchParams.get('page') || 1)
        if (req.method === 'POST') {
          let raw = ''; for await (const chunk of req) raw += chunk
          const input = JSON.parse(raw)
          await new Promise(resolve => setTimeout(resolve, 600))
          if (mode === 'write-not-ready') return send({ success:false, code:'REVIEW_WRITE_NOT_READY', message:'Review submission is temporarily unavailable. Please try again later.' },503)
          if (failPostOnce) { failPostOnce = false; return send({success:false,message:'Test-only network/server failure'},500) }
          if (published) return send({success:false,code:'REVIEW_ALREADY_EXISTS',message:'You have already reviewed this movie'},409)
          published = {id:'qa-published',authorDisplayName:'Fixture Customer',rating:input.rating,content:input.content,createdAt:'2026-10-27T00:00:00Z'}
          return send({success:true,data:published},201)
        }
        const currentMode = mode, shouldFail = failOnce
        failOnce = false
        await new Promise(resolve => setTimeout(resolve, movieId === b ? 100 : page === 2 ? 1800 : 650))
        if (shouldFail) return send({ success: false, message: 'Internal server error' }, 500)
        const total = currentMode === 'empty' ? 0 : movieId === a ? 12 : 1
        const count = Math.min(10, Math.max(0, total - (page - 1) * 10))
        const data = Array.from({ length: count }, (_, i) => ({
          id: `${movieId}-${page}-${i}`, authorDisplayName: `Fixture ${movieId === a ? 'A' : 'B'} ${(page - 1) * 10 + i + 1}`,
          rating: i % 5 + 1, content: i === 1 ? '' : 'Test-only content: tiếng Việt <script> stays plain text.\n' + (i === 2 ? 'LongUnbrokenContent'.repeat(12) : 'Whitespace is preserved.'),
          createdAt: '2026-10-26T23:30:00Z',
        }))
        if (published && page === 1) data.unshift(published)
        return send({ success: true, data: data.slice(0,10), meta: { page, limit: 10, total:total+(published?1:0), totalPages: Math.ceil((total+(published?1:0))/10) } })
      }
      next()
    })
  } }],
})
await server.listen()
console.log('REV-101 QA: http://127.0.0.1:5177/__review-preview')
