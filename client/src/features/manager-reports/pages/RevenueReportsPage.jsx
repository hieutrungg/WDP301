import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowLeft, ArrowRight, CalendarDays, ChartNoAxesCombined, CircleAlert, FileSpreadsheet, FileText, RotateCcw, Search, Ticket, Utensils } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { exportRevenueReport, getRevenueReport, getRevenueReportOptions } from '../api/revenueReportApi'

const TIME_ZONE = 'Asia/Ho_Chi_Minh'
const localDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const addDays = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
const firstOfMonth = (date) => `${date.slice(0, 7)}-01`
const initialFilters = () => ({ fromDate: firstOfMonth(localDate()), toDate: localDate(), category: 'ALL', movieId: '', page: 1, limit: 20 })
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const dateTime = (value) => new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const queryParams = (filters) => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null))

function SummaryCard({ icon: Icon, label, value, caption, accent = 'text-primary' }) {
  return <article className="rounded-xl border border-white/5 bg-surface-container-low p-4 shadow-sm sm:p-5">
    <div className="flex items-start justify-between gap-3"><span className="text-[11px] font-bold uppercase tracking-wider text-outline">{label}</span><span className="rounded-lg bg-surface-container-high p-2"><Icon className={`size-4 ${accent}`} /></span></div>
    <p className="mt-4 break-words font-heading text-xl font-extrabold tracking-tight text-on-surface sm:text-2xl">{value}</p>
    <p className="mt-2 text-xs text-on-surface-variant">{caption}</p>
  </article>
}

function RevenueBreakdown({ summary, category }) {
  const ticketAmount = category === 'CONCESSIONS' ? 0 : summary.grossTicketRevenue
  const concessionAmount = category === 'TICKETS' ? 0 : summary.grossConcessionRevenue
  const refundAmount = summary.filteredRefundedAmount
  const max = Math.max(1, ticketAmount, concessionAmount, refundAmount)
  const bars = [
    { label: 'Ticket component', value: ticketAmount, icon: Ticket, color: 'bg-primary-container' },
    { label: 'Concession component', value: concessionAmount, icon: Utensils, color: 'bg-secondary' },
    { label: 'Refunds', value: refundAmount, icon: RotateCcw, color: 'bg-error' },
  ]
  return <section className="rounded-xl border border-white/5 bg-surface-container-low p-5 sm:p-6">
    <div className="flex items-center gap-3"><span className="rounded-lg bg-primary-container/15 p-2.5 text-primary"><ChartNoAxesCombined className="size-4" /></span><div><h2 className="font-heading text-lg font-bold">Revenue stream breakdown</h2><p className="text-xs text-on-surface-variant">Saved ticket/concession components and successful refunds</p></div></div>
    <div className="mt-6 grid gap-5 md:grid-cols-3">{bars.map(({ label, value, icon: Icon, color }) => <div key={label}>
      <div className="mb-2 flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 text-on-surface-variant"><Icon className="size-4" />{label}</span><strong>{money.format(value)}</strong></div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(value > 0 ? 2 : 0, value / max * 100)}%` }} /></div>
    </div>)}</div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4 text-sm"><span className="text-on-surface-variant">Net revenue after successful refunds</span><strong className="font-heading text-lg text-emerald-400">{money.format(summary.netRevenue)}</strong></div>
  </section>
}

function RevenueTimeline({ series = [], fromDate, toDate }) {
  const byDate = new Map(series.map((row) => [row.date, row]))
  const days = []
  for (let day = fromDate; day <= toDate; day = addDays(day, 1)) days.push({ date: day, ...(byDate.get(day) || { grossAmount: 0, refundedAmount: 0 }) })
  const max = Math.max(1, ...days.flatMap(({ grossAmount, refundedAmount }) => [grossAmount, refundedAmount]))
  return <section className="rounded-xl border border-white/5 bg-surface-container-low p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-heading text-lg font-bold">Revenue stream over time</h2><p className="mt-1 text-xs text-on-surface-variant">Collections and refunds by transaction date · Vietnam time</p></div><div className="flex gap-4 text-xs text-on-surface-variant"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-primary-container" />Collected</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-error" />Refunded</span></div></div>
    <div className="mt-6 overflow-x-auto"><div className="grid h-48 min-w-[680px] grid-flow-col auto-cols-[minmax(24px,1fr)] items-end gap-1 border-b border-white/10 px-1">{days.map((day) => <div key={day.date} className="flex h-full min-w-0 flex-col justify-end"><div className="flex h-[82%] items-end justify-center gap-0.5 border-b border-dashed border-white/5"><div title={`${day.date}: collected ${money.format(day.grossAmount)}`} className="w-2/5 min-w-1 rounded-t-sm bg-primary-container" style={{ height: `${day.grossAmount ? Math.max(2, day.grossAmount / max * 100) : 0}%` }} /><div title={`${day.date}: refunded ${money.format(day.refundedAmount)}`} className="w-2/5 min-w-1 rounded-t-sm bg-error" style={{ height: `${day.refundedAmount ? Math.max(2, day.refundedAmount / max * 100) : 0}%` }} /></div><span className="mt-2 truncate text-center text-[9px] text-outline">{new Date(`${day.date}T12:00:00+07:00`).toLocaleDateString('en-US', { timeZone: TIME_ZONE, month: 'short', day: 'numeric' })}</span></div>)}</div></div>
  </section>
}

function RevenueReportsPage() {
  const [filters, setFilters] = useState(initialFilters)
  const [draft, setDraft] = useState(initialFilters)
  const [exporting, setExporting] = useState('')
  const [exportError, setExportError] = useState('')
  const optionsQuery = useQuery({ queryKey: ['manager-revenue-report-options'], queryFn: ({ signal }) => getRevenueReportOptions(signal) })
  const options = optionsQuery.data
  const reportQuery = useQuery({
    queryKey: ['manager-revenue-report', filters],
    queryFn: ({ signal }) => getRevenueReport(queryParams(filters), signal),
    enabled: Boolean(filters.fromDate && filters.toDate),
  })
  const report = reportQuery.data
  const summary = report?.summary
  const canExport = options && filters.fromDate && filters.toDate && !exporting
  const activePreset = useMemo(() => {
    const today = localDate()
    if (filters.fromDate === today && filters.toDate === today) return 'Today'
    if (filters.fromDate === addDays(today, -6) && filters.toDate === today) return 'Last 7 days'
    if (filters.fromDate === firstOfMonth(today) && filters.toDate === today) return 'Month to date'
    return 'Custom'
  }, [filters.fromDate, filters.toDate])

  const setPeriod = (preset) => {
    const today = localDate()
    const range = preset === 'Today' ? [today, today]
      : preset === 'Last 7 days' ? [addDays(today, -6), today]
        : [firstOfMonth(today), today]
    setDraft((current) => ({ ...current, fromDate: range[0], toDate: range[1] }))
  }
  const applyFilters = (event) => {
    event.preventDefault()
    setFilters({ ...draft, page: 1 })
  }
  const exportFile = async (format) => {
    setExporting(format)
    setExportError('')
    try { await exportRevenueReport(queryParams({ ...filters, page: undefined, limit: undefined }), format) }
    catch (error) { setExportError(getApiErrorMessage(error, 'Unable to export this report. Please try again.')) }
    finally { setExporting('') }
  }

  return <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
    <section className="flex flex-col justify-between gap-5 rounded-2xl border border-white/5 bg-surface-container-low p-5 sm:flex-row sm:items-end sm:p-7">
      <div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"><ChartNoAxesCombined className="size-3.5" />Reporting &amp; financial telemetry</div><h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Revenue reports</h1><p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Review verified collections and completed refunds for your assigned branch. All reporting dates use Vietnam time.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!canExport} onClick={() => exportFile('xlsx')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface-container-high px-4 text-sm font-bold text-on-surface transition-colors hover:bg-surface-bright disabled:cursor-wait disabled:opacity-50"><FileSpreadsheet className="size-4 text-emerald-400" />{exporting === 'xlsx' ? 'Preparing Excel…' : 'Export Excel'}</button><button type="button" disabled={!canExport} onClick={() => exportFile('pdf')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-container px-4 text-sm font-bold text-on-primary-container shadow-crimson transition-colors hover:brightness-110 disabled:cursor-wait disabled:opacity-50"><FileText className="size-4" />{exporting === 'pdf' ? 'Preparing PDF…' : 'Export PDF'}</button></div>
    </section>

    <section className="rounded-xl border border-white/5 bg-surface-container-low p-4 sm:p-5">
      <form onSubmit={applyFilters} className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.1fr_auto]">
        <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-outline">From date<input required type="date" value={draft.fromDate} max={draft.toDate || localDate()} onChange={(event) => setDraft({ ...draft, fromDate: event.target.value })} className="h-10 rounded-lg border border-white/10 bg-surface-container px-3 text-sm font-medium normal-case tracking-normal text-on-surface [color-scheme:dark]" /></label>
        <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-outline">To date<input required type="date" value={draft.toDate} min={draft.fromDate} max={localDate()} onChange={(event) => setDraft({ ...draft, toDate: event.target.value })} className="h-10 rounded-lg border border-white/10 bg-surface-container px-3 text-sm font-medium normal-case tracking-normal text-on-surface [color-scheme:dark]" /></label>
        <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-outline">Movie<select value={draft.movieId} onChange={(event) => setDraft({ ...draft, movieId: event.target.value })} className="h-10 rounded-lg border border-white/10 bg-surface-container px-3 text-sm font-medium normal-case tracking-normal text-on-surface"><option value="">All movies</option>{options?.movies?.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}</select></label>
        <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-outline">Revenue category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="h-10 rounded-lg border border-white/10 bg-surface-container px-3 text-sm font-medium normal-case tracking-normal text-on-surface"><option value="ALL">All revenue</option><option value="TICKETS">Tickets</option><option value="CONCESSIONS">Concessions</option></select></label>
        <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-container px-4 text-sm font-bold text-on-primary-container hover:brightness-110"><Search className="size-4" />Apply filters</button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4"><span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-outline">Period presets</span>{['Today', 'Last 7 days', 'Month to date'].map((preset) => <button key={preset} type="button" onClick={() => setPeriod(preset)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${activePreset === preset ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>{preset}</button>)}<button type="button" onClick={() => { const reset = initialFilters(); setDraft(reset); setFilters(reset) }} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"><RotateCcw className="size-3.5" />Reset</button></div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-on-surface-variant"><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-primary-container" />{options?.branch?.branchName || (optionsQuery.isLoading ? 'Loading branch…' : 'Assigned branch')}</span><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{filters.fromDate} – {filters.toDate} · {TIME_ZONE}</span></div>
    </section>

    {optionsQuery.isError && <ErrorPanel message={getApiErrorMessage(optionsQuery.error, 'Unable to load report filters.')} />}
    {reportQuery.isError && <ErrorPanel message={getApiErrorMessage(reportQuery.error, 'Unable to load the revenue report.')} />}
    {exportError && <ErrorPanel message={exportError} />}
    {reportQuery.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl bg-surface-container" />)}</div> : summary && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={ChartNoAxesCombined} label="Total revenue · gross" value={money.format(summary.filteredGrossRevenue)} caption="Successful verified payments, after discounts" />
        <SummaryCard icon={Ticket} label="Ticket component" value={money.format(filters.category === 'CONCESSIONS' ? 0 : summary.grossTicketRevenue)} caption={`${summary.soldTicketCount.toLocaleString('en-US')} sold tickets · before discount allocation`} accent="text-primary" />
        <SummaryCard icon={Utensils} label="Concession component" value={money.format(filters.category === 'TICKETS' ? 0 : summary.grossConcessionRevenue)} caption={`${summary.completedConcessionSales.toLocaleString('en-US')} paid sales · before discount allocation`} accent="text-secondary" />
        <SummaryCard icon={RotateCcw} label="Successfully refunded" value={money.format(summary.filteredRefundedAmount)} caption={`${summary.refundCount.toLocaleString('en-US')} completed refunds`} accent="text-error" />
        <SummaryCard icon={ArrowDownToLine} label="Net revenue" value={money.format(summary.filteredNetRevenue)} caption="Gross revenue less successful refunds" accent="text-emerald-400" />
      </section>

      <RevenueBreakdown summary={summary} category={filters.category} />
      <RevenueTimeline series={report.series} fromDate={filters.fromDate} toDate={filters.toDate} />

      <section className="overflow-hidden rounded-xl border border-white/5 bg-surface-container-low">
        <div className="flex flex-col justify-between gap-2 border-b border-white/5 p-5 sm:flex-row sm:items-center"><div><h2 className="font-heading text-lg font-bold">Audited transaction journal</h2><p className="mt-1 text-xs text-on-surface-variant">{report.meta.total.toLocaleString('en-US')} successful payment and refund transactions · sorted newest first</p></div><span className="rounded-md bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">Cutoff {dateTime(report.generatedAt)}</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-surface-container-lowest/60 text-[10px] uppercase tracking-wider text-outline"><tr><th className="px-5 py-3">Transaction date</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Movie</th><th className="px-5 py-3">Payment method</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-white/5">{report.items.map((row) => <tr key={`${row.type}-${row._id}`} className="hover:bg-surface-container-high/40"><td className="whitespace-nowrap px-5 py-3 text-xs text-on-surface-variant">{dateTime(row.transactionAt)}</td><td className="px-5 py-3"><span className={`rounded px-2 py-1 text-[10px] font-bold ${row.type === 'REFUND' ? 'bg-error/10 text-error' : 'bg-emerald-400/10 text-emerald-300'}`}>{row.type}</span></td><td className="max-w-52 truncate px-5 py-3 font-mono text-xs text-on-surface-variant" title={row.reference}>{row.reference}</td><td className="max-w-56 truncate px-5 py-3 text-sm">{row.movieTitle || 'Concessions'}</td><td className="px-5 py-3 text-xs text-on-surface-variant">{row.method || '—'}</td><td className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${row.type === 'REFUND' ? 'text-error' : 'text-on-surface'}`}>{row.type === 'REFUND' ? '−' : ''}{money.format(row.amount)}</td></tr>)}</tbody></table></div>
        {report.items.length === 0 && <div className="grid min-h-40 place-items-center px-6 text-center"><div><p className="font-semibold">No transactions found</p><p className="mt-1 text-sm text-on-surface-variant">Try a different date range, movie, or revenue category.</p></div></div>}
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3 text-xs text-on-surface-variant"><span>Page {report.meta.page} of {Math.max(1, report.meta.totalPages)}</span><div className="flex gap-2"><button type="button" disabled={filters.page <= 1 || reportQuery.isFetching} onClick={() => setFilters({ ...filters, page: filters.page - 1 })} className="rounded-md bg-surface-container p-2 hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ArrowLeft className="size-4" /></button><button type="button" disabled={filters.page >= Math.min(report.meta.totalPages, 100) || reportQuery.isFetching} onClick={() => setFilters({ ...filters, page: filters.page + 1 })} className="rounded-md bg-surface-container p-2 hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ArrowRight className="size-4" /></button></div></div>
      </section>
      <p className="text-[11px] leading-relaxed text-outline">Financial values are VND integers. Gross revenue is based on successfully paid transactions; refunds are included only after successful processing. Ticket and concession component values are saved booking/order subtotals before discount allocation. The booking stores discounts at total level, so they are not allocated between categories.</p>
    </>}
  </div>
}

function ErrorPanel({ message }) {
  return <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p>{message}</p></div>
}

export default RevenueReportsPage
