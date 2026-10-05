import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import WeeklyChart from './components/WeeklyChart'
import ProviderTable from './components/ProviderTable'
import StatusHero from './components/StatusHero'
import PendingOrdersSection from './components/PendingOrdersSection'
import InsightsSection from './components/InsightsSection'
import { RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Calendar, CalendarDays } from 'lucide-react'

const REFRESH_INTERVAL = 5 * 60 * 1000

// ─── Month helpers ────────────────────────────────────────────────────────────
function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym) {
  const [y, m] = ym.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
}

function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── Week helpers ─────────────────────────────────────────────────────────────
function fmtDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getThisMonday() {
  const now = new Date()
  const d   = now.getDay() // 0=Dom, 1=Lun…
  const diff = d === 0 ? -6 : 1 - d
  const mon  = new Date(now)
  mon.setDate(now.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return fmtDate(mon)
}

function weekSunday(mondayStr) {
  const d = new Date(mondayStr + 'T12:00:00')
  d.setDate(d.getDate() + 6)
  return fmtDate(d)
}

function addWeeks(mondayStr, n) {
  const d = new Date(mondayStr + 'T12:00:00')
  d.setDate(d.getDate() + 7 * n)
  return fmtDate(d)
}

function weekLabel(mondayStr) {
  const mon = new Date(mondayStr + 'T12:00:00')
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const locale = 'es-PE'
  const monStr = mon.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const sunStr = sun.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${monStr} – ${sunStr}`
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // View mode: 'month' | 'week'
  const [viewMode, setViewMode] = useState('month')
  const [showDetail, setShowDetail] = useState(false)

  // Month navigator
  const [month, setMonth] = useState(currentMonthStr)

  // Week navigator — default: this week (starting Monday)
  const [weekStart, setWeekStart] = useState(getThisMonday)

  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchStats = useCallback(async () => {
    try {
      setError(null)
      const url = viewMode === 'week'
        ? `/api/stats?from=${weekStart}&to=${weekSunday(weekStart)}`
        : `/api/stats?month=${month}`
      const res = await fetch(url)
      if (!res.ok) {
        let msg = `Error ${res.status}`
        try { const e = await res.json(); msg = e.error || msg } catch { msg = await res.text().then(t => t.slice(0, 120)) || msg }
        throw new Error(msg)
      }
      setData(await res.json())
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [month, viewMode, weekStart])

  useEffect(() => {
    setLoading(true)
    fetchStats()
    const t = setInterval(fetchStats, REFRESH_INTERVAL)
    return () => clearInterval(t)
  }, [fetchStats])

  const s = data?.summary
  const isCurrentMonth = month === currentMonthStr()
  const isCurrentWeek  = weekStart === getThisMonday()
  const canGoNextMonth = !isCurrentMonth
  const canGoNextWeek  = !isCurrentWeek

  // Period label for subtitles
  const periodLabel = viewMode === 'week'
    ? weekLabel(weekStart)
    : monthLabel(month)

  return (
    <div className="min-h-screen bg-gray-50 transition-colors duration-200">
      <Header lastUpdated={lastUpdated} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6">

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-[#f6653c]/10 border border-[#f6653c]/30 p-4 text-[#d94e27] text-sm font-medium">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Mode toggle + navigator + refresh ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">

            {/* Mes / Semana toggle */}
            <div className="flex items-center bg-white border border-gray-200 rounded-full p-0.5 gap-0.5">
              <button
                onClick={() => { setViewMode('month'); setLoading(true) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  viewMode === 'month'
                    ? 'bg-[#f6653c] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Calendar size={11} />
                Mes
              </button>
              <button
                onClick={() => { setViewMode('week'); setLoading(true) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  viewMode === 'week'
                    ? 'bg-[#f6653c] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <CalendarDays size={11} />
                Semana
              </button>
            </div>

            {/* Month navigator */}
            {viewMode === 'month' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setLoading(true); setMonth(m => addMonths(m, -1)) }}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:border-[#f6653c] hover:text-[#f6653c] transition-all"
                >
                  <ChevronLeft size={14} />
                </button>

                <div className="px-4 py-1.5 rounded-full bg-[#f6653c] text-white text-xs sm:text-sm font-bold capitalize min-w-[140px] text-center">
                  {monthLabel(month)}
                </div>

                <button
                  onClick={() => { setLoading(true); setMonth(m => addMonths(m, 1)) }}
                  disabled={!canGoNextMonth}
                  className={`w-7 h-7 flex items-center justify-center rounded-full border transition-all ${
                    canGoNextMonth
                      ? 'bg-white border-gray-200 text-gray-400 hover:border-[#f6653c] hover:text-[#f6653c]'
                      : 'bg-gray-50 border-gray-100 text-gray-200 cursor-not-allowed'
                  }`}
                >
                  <ChevronRight size={14} />
                </button>

                {!isCurrentMonth && (
                  <button
                    onClick={() => { setLoading(true); setMonth(currentMonthStr()) }}
                    className="ml-1 px-3 py-1.5 rounded-full text-xs font-bold text-[#f6653c] border border-[#f6653c]/30 hover:bg-[#f6653c]/5 transition-all"
                  >
                    Hoy
                  </button>
                )}
              </div>
            )}

            {/* Week navigator */}
            {viewMode === 'week' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setLoading(true); setWeekStart(w => addWeeks(w, -1)) }}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:border-[#f6653c] hover:text-[#f6653c] transition-all"
                >
                  <ChevronLeft size={14} />
                </button>

                <div className="px-4 py-1.5 rounded-full bg-[#f6653c] text-white text-xs sm:text-sm font-bold min-w-[190px] text-center">
                  {weekLabel(weekStart)}
                </div>

                <button
                  onClick={() => { setLoading(true); setWeekStart(w => addWeeks(w, 1)) }}
                  disabled={!canGoNextWeek}
                  className={`w-7 h-7 flex items-center justify-center rounded-full border transition-all ${
                    canGoNextWeek
                      ? 'bg-white border-gray-200 text-gray-400 hover:border-[#f6653c] hover:text-[#f6653c]'
                      : 'bg-gray-50 border-gray-100 text-gray-200 cursor-not-allowed'
                  }`}
                >
                  <ChevronRight size={14} />
                </button>

                {!isCurrentWeek && (
                  <button
                    onClick={() => { setLoading(true); setWeekStart(getThisMonday()) }}
                    className="ml-1 px-3 py-1.5 rounded-full text-xs font-bold text-[#f6653c] border border-[#f6653c]/30 hover:bg-[#f6653c]/5 transition-all"
                  >
                    Esta sem.
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => { setLoading(true); fetchStats() }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#f6653c] transition-colors font-semibold"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        {/* ── Semáforo: ¿vamos bien, más o menos o mal? ── */}
        {!loading && s && (
          <StatusHero
            pendingOrders={data?.pendingOrders ?? []}
            complianceRate={s.period.avgComplianceRate}
          />
        )}

        {/* ── Quién está atrasado ── */}
        <PendingOrdersSection orders={data?.pendingOrders ?? []} loading={loading} />

        {/* ── Detalle (oculto por defecto para no saturar) ── */}
        <button
          onClick={() => setShowDetail(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-gray-400 hover:text-[#f6653c] transition-colors"
        >
          {showDetail ? 'Ocultar detalle' : 'Ver más detalle (gráficos y tabla por planta)'}
          <ChevronDown size={14} className={`transition-transform ${showDetail ? 'rotate-180' : ''}`} />
        </button>

        {showDetail && <>
        {!loading && s && <InsightsSection summary={s} mode={viewMode} />}

        {/* ── HERO: Provider scorecards ── */}
        <div className="gl-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-black text-gray-900">
                Estado de plantas · {viewMode === 'week' ? 'Esta semana' : 'Hoy'}
              </h2>
              <p className="text-[10px] text-gray-400 mt-0.5 font-medium capitalize">
                {viewMode === 'week'
                  ? weekLabel(weekStart)
                  : new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                }
              </p>
            </div>
            {!loading && s && (
              <div className="flex gap-2 flex-wrap justify-end">
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">
                  {s.today.compliantProviders} al día
                </span>
                {s.today.pendingProviders > 0 && (
                  <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-bold">
                    {s.today.pendingProviders} pendientes
                  </span>
                )}
              </div>
            )}
          </div>

          {loading
            ? <ProviderSkeleton />
            : <ProviderTable providers={data?.providers ?? []} mode={viewMode} />
          }
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="lg:col-span-2 gl-card p-4 sm:p-6">
            <h2 className="text-sm font-bold text-gray-800 mb-0.5">Guías por fecha de recojo</h2>
            <p className="text-[10px] text-gray-400 font-medium mb-4 capitalize">
              {periodLabel} · solo recojos ya vencidos · sin canceladas
            </p>
            {loading
              ? <div className="h-48 sm:h-56 flex items-center justify-center"><LoadingDots /></div>
              : <WeeklyChart data={data?.dailyStats ?? []} />
            }
          </div>

          {/* Summary panel */}
          <div className="gl-card p-4 sm:p-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4 capitalize">
              Resumen · {periodLabel}
            </h2>
            <div className="space-y-3 sm:space-y-4">
              <StatRow label="Total órdenes"  value={s?.period?.totalOrders ?? '—'} />
              <StatRow label="Con guía"       value={s?.period?.totalWithGuia ?? '—'} valueColor="text-emerald-600" />
              <StatRow
                label="Sin guía"
                value={(s?.period?.totalOrders ?? 0) - (s?.period?.totalWithGuia ?? 0)}
                valueColor="text-[#f6653c]"
              />
              <div className="pt-3 border-t border-gray-100">
                <StatRow
                  label={viewMode === 'week' ? 'Cumplimiento semana' : 'Cumplimiento del mes'}
                  value={loading ? '—' : `${s?.period?.avgComplianceRate ?? 0}%`}
                  valueColor={
                    !s ? '' :
                    s.period.avgComplianceRate >= 80 ? 'text-emerald-600' :
                    s.period.avgComplianceRate >= 50 ? 'text-amber-600' : 'text-[#f6653c]'
                  }
                  bold
                />
              </div>

              {s && (
                <div className="pt-1">
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${
                        s.period.avgComplianceRate >= 80 ? 'bg-emerald-500' :
                        s.period.avgComplianceRate >= 50 ? 'bg-amber-400' : 'bg-[#f6653c]'
                      }`}
                      style={{ width: `${s.period.avgComplianceRate}%` }}
                    />
                  </div>
                </div>
              )}

              {data?.guiaField && (
                <p className="text-[9px] text-gray-200 pt-1 font-mono">
                  campo: {data.guiaField}
                </p>
              )}
            </div>
          </div>
        </div>
        </>}

      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-[10px] text-gray-300 font-medium">
        <span className="text-gl-blue font-bold">getlavado</span> B2B · Control de Guías · Panel interno
      </footer>
    </div>
  )
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function StatRow({ label, value, valueColor = '', bold = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className={`text-sm font-${bold ? 'black' : 'bold'} ${valueColor || 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full bg-[#f6653c] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

function ProviderSkeleton() {
  return (
    <div className="p-8 text-center">
      <div className="flex gap-1.5 justify-center"><LoadingDots /></div>
      <p className="text-xs text-gray-300 mt-3 font-medium">Cargando plantas…</p>
    </div>
  )
}
