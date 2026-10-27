import { useQuery } from '@tanstack/react-query'
import { Activity, Armchair, Banknote, CalendarDays, CircleAlert, Clock3, RotateCw, TicketCheck, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { getManagerDashboard } from '../api/managerDashboardApi'

const periods = [
  { value: 'TODAY', label: 'Today' },
  { value: 'WTD', label: 'Week to date' },
  { value: 'QTD', label: 'Quarter to date' },
]
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const dateTime = (value, options = { month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
const percent = (value) => value == null ? 'Not available' : `${value.toFixed(1)}%`

function MetricCard({ icon: Icon, label, value, caption, tone = 'text-secondary', glow = 'bg-secondary/5' }) {
  return <article className="group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-xl bg-surface-container p-5 shadow-md transition-colors hover:bg-surface-container-high/70 sm:p-6">
    <div className={`pointer-events-none absolute -bottom-5 -right-5 size-28 rounded-full blur-2xl ${glow}`} />
    <div className="relative">
      <div className="mb-4 flex items-center justify-between gap-3"><span className="text-[11px] font-bold uppercase tracking-wider text-outline">{label}</span><span className="rounded-lg bg-surface-container-low p-2"><Icon className={`size-4 ${tone}`} /></span></div>
      <p className="break-words font-heading text-2xl font-extrabold leading-tight tracking-tight text-on-surface sm:text-[28px]">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{caption}</p>
    </div>
  </article>
}

function RevenueChart({ series }) {
  const max = Math.max(1, ...series.flatMap((row) => [row.grossAmount, row.refundedAmount, Math.abs(row.netAmount)]))
  return <div className="mt-5">
    <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-on-surface-variant">
      <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-primary-container" />Gross sales</span>
      <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-secondary" />Refunds</span>
      <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-emerald-400" />Net revenue</span>
    </div>
    <div className="overflow-x-auto">
      <div className="grid h-56 min-w-[660px] grid-flow-col auto-cols-fr items-end gap-2 border-b border-outline-variant/20 px-1 sm:gap-4">
        {series.map((row) => <div key={row.date} className="flex h-full min-w-0 flex-col justify-end">
          <div className="flex h-[82%] items-end justify-center gap-1 border-b border-dashed border-outline-variant/20">
            <div title={`Gross: ${money.format(row.grossAmount)}`} className="w-1/4 min-w-1 rounded-t-sm bg-primary-container" style={{ height: `${Math.max(2, row.grossAmount / max * 100)}%` }} />
            <div title={`Refunds: ${money.format(row.refundedAmount)}`} className="w-1/4 min-w-1 rounded-t-sm bg-secondary" style={{ height: `${Math.max(2, row.refundedAmount / max * 100)}%` }} />
            <div title={`Net: ${money.format(row.netAmount)}`} className={`w-1/4 min-w-1 rounded-t-sm ${row.netAmount < 0 ? 'bg-error' : 'bg-emerald-400'}`} style={{ height: `${Math.max(2, Math.abs(row.netAmount) / max * 100)}%` }} />
          </div>
          <span className="mt-2 truncate text-center text-[10px] text-outline">{dateTime(`${row.date}T12:00:00+07:00`, { weekday: 'short', day: 'numeric' })}</span>
        </div>)}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-outline"><span>Payments and refunds are grouped by transaction date in Vietnam time.</span><strong className="text-emerald-400">Net {money.format(series.reduce((sum, row) => sum + row.netAmount, 0))}</strong></div>
  </div>
}

function OccupancyPanel({ occupancy }) {
  const rate = occupancy.ratePercent
  const ring = rate == null ? 'conic-gradient(#343439 0deg 360deg)' : `conic-gradient(#e50914 ${Math.min(rate, 100) * 3.6}deg, #343439 0deg)`
  return <article className="rounded-xl bg-surface-container p-5 shadow-md sm:p-6">
    <div className="flex items-center gap-3"><span className="rounded-lg bg-primary-container/15 p-2.5 text-primary"><Armchair className="size-4" /></span><div><h2 className="font-heading text-lg font-bold">Completed-showtime occupancy</h2><p className="text-xs text-on-surface-variant">Valid tickets / available seat capacity</p></div></div>
    <div className="mt-7 flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
      <div className="grid size-40 shrink-0 place-items-center rounded-full p-3" style={{ background: ring }} role="img" aria-label={`Occupancy ${percent(rate)}`}><div className="grid size-full place-items-center rounded-full bg-surface-container"><div className="text-center"><strong className="font-heading text-3xl font-extrabold">{percent(rate)}</strong><span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-outline">Occupancy</span></div></div></div>
      <div className="grid w-full gap-3 sm:max-w-56">
        <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3"><span className="text-sm text-on-surface-variant">Valid tickets</span><strong>{occupancy.validTickets.toLocaleString('en-US')}</strong></div>
        <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3"><span className="text-sm text-on-surface-variant">Seat capacity</span><strong>{occupancy.availableSeatCapacity.toLocaleString('en-US')}</strong></div>
        <div className="flex items-center justify-between"><span className="text-sm text-on-surface-variant">Completed showtimes</span><strong>{occupancy.completedShowtimes.toLocaleString('en-US')}</strong></div>
      </div>
    </div>
    {rate == null && <p className="mt-5 text-center text-xs text-outline">Not available because this period has no completed-showtime seat capacity.</p>}
  </article>
}

function TrendingList({ items }) {
  const maxTickets = Math.max(1, ...items.map((item) => item.ticketsSold))
  return <article className="rounded-xl bg-surface-container p-5 shadow-md sm:p-6">
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="size-2 animate-pulse rounded-full bg-primary-container" /><h2 className="font-heading text-lg font-bold">Trending showtimes</h2></div><p className="mt-1 text-xs text-on-surface-variant">Ranked by valid tickets issued during this period</p></div><span className="w-fit rounded bg-secondary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">{items.length} top results</span></div>
    {items.length ? <ol className="space-y-3">{items.map((item, index) => <li key={item.showtimeId} className="rounded-lg bg-surface-container-low p-3 transition-colors hover:bg-surface-container-high"><div className="flex items-center gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-md font-heading text-sm font-bold ${index === 0 ? 'bg-primary-container text-white' : 'bg-surface-container-high text-secondary'}`}>{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-on-surface">{item.movieTitle}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-outline"><Clock3 className="size-3" />{dateTime(item.startAt, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p></div><strong className="shrink-0 text-sm">{item.ticketsSold.toLocaleString('en-US')} <span className="font-normal text-outline">tickets</span></strong></div><div className="ml-11 mt-3 h-1 overflow-hidden rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-primary-container" style={{ width: `${item.ticketsSold / maxTickets * 100}%` }} /></div></li>)}</ol> : <div className="rounded-lg bg-surface-container-low p-8 text-center text-sm text-outline">No valid tickets were issued during this period.</div>}
    <p className="mt-4 text-[11px] leading-relaxed text-outline">Refunded bookings and invalidated tickets are excluded. Equal ticket counts use a stable start-time order.</p>
  </article>
}

function ManagerDashboardPage() {
  const [period, setPeriod] = useState('TODAY')
  const query = useQuery({ queryKey: ['manager-dashboard', period], queryFn: ({ signal }) => getManagerDashboard(period, signal) })
  const data = query.data
  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 pb-10">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded bg-secondary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">B2B Theatrical Intelligence</span><span className="text-xs text-outline">Assigned branch scope</span></div><h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Manager Dashboard &amp; Analytics</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">Branch revenue, completed-screening occupancy, and ticket sales trends.</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-xs text-on-surface-variant"><span className="size-2 rounded-full bg-emerald-400" />Snapshot ready</span><button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="flex items-center gap-2 rounded-lg bg-surface-container-high px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface-container-highest disabled:cursor-wait disabled:opacity-60"><RotateCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} />Refresh Metrics</button></div>
      </section>

      <section className="flex flex-col justify-between gap-4 rounded-xl bg-surface-container p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-center gap-3"><span className="rounded-lg bg-surface-container-low p-2.5 text-secondary"><CalendarDays className="size-4" /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-outline">Reporting period</p><p className="mt-0.5 text-sm font-semibold">{data ? `${dateTime(data.period.fromAt, { dateStyle: 'medium' })} · ${dateTime(data.generatedAt, { dateStyle: 'medium' })}` : 'All dates use Asia/Ho_Chi_Minh'}</p></div></div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Reporting period">{periods.map((option) => <button key={option.value} type="button" onClick={() => setPeriod(option.value)} aria-pressed={period === option.value} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${period === option.value ? 'bg-primary-container text-white shadow-[0_0_12px_rgba(229,9,20,0.3)]' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>{option.label}</button>)}</div>
      </section>

      {query.isPending ? <div className="flex min-h-64 items-center justify-center"><RotateCw className="size-8 animate-spin text-secondary" aria-label="Loading dashboard" /></div> : query.isError ? <section className="rounded-xl border border-error/20 bg-error-container/10 p-8 text-center"><CircleAlert className="mx-auto size-8 text-error" /><h2 className="mt-3 font-heading font-bold">Dashboard could not be loaded</h2><p className="mt-2 text-sm text-on-surface-variant">{getApiErrorMessage(query.error)}</p><button className="mt-5 inline-flex items-center gap-2 rounded-lg bg-surface-container-high px-4 py-2 text-sm font-semibold" onClick={() => query.refetch()}><RotateCw className="size-4" />Try again</button></section> : data && <>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Banknote} label="Gross box revenue" value={money.format(data.revenue.grossAmount)} caption="Successfully settled payments before refunds" tone="text-primary" glow="bg-primary/10" />
          <MetricCard icon={TrendingUp} label="Net revenue" value={money.format(data.revenue.netAmount)} caption={`${money.format(data.revenue.refundedAmount)} in successfully processed refunds`} tone="text-emerald-400" glow="bg-emerald-500/10" />
          <MetricCard icon={Armchair} label="Showtime occupancy" value={percent(data.occupancy.ratePercent)} caption={`${data.occupancy.validTickets.toLocaleString('en-US')} valid admissions across completed showtimes`} tone="text-secondary" glow="bg-secondary/10" />
          <MetricCard icon={TicketCheck} label="Tickets sold" value={data.ticketsSold.toLocaleString('en-US')} caption="Valid tickets issued in this reporting period" tone="text-primary" glow="bg-primary/10" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
          <article className="rounded-xl bg-surface-container p-5 shadow-md sm:p-6"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><h2 className="font-heading text-lg font-bold">Revenue trend</h2></div><p className="mt-1 text-xs text-on-surface-variant">Gross, refunds and net by transaction date</p></div><span className="rounded bg-primary-container/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">VND</span></div><RevenueChart series={data.revenue.series} /></article>
          <OccupancyPanel occupancy={data.occupancy} />
        </section>

        <TrendingList items={data.trendingShowtimes} />
        <p className="text-right text-[11px] text-outline">Snapshot generated {dateTime(data.generatedAt, { dateStyle: 'medium', timeStyle: 'short' })} ICT</p>
      </>}
    </div>
  </main>
}

export default ManagerDashboardPage
