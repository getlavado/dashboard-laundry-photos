import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import KPICard from './components/KPICard'
import WeeklyChart from './components/WeeklyChart'
import ProviderTable from './components/ProviderTable'
import AlertBanner from './components/AlertBanner'
import PendingOrdersSection from './components/PendingOrdersSection'
import InsightsSection from './components/InsightsSection'
import { RefreshCw, ChevronLeft, ChevronRight, Building2, AlertCircle } from 'lucide-react'

const REFRESH_INTERVAL = 5 * 60 * 1000

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

export default function App() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [month, setMonth]         = useState(currentMonthStr)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchStats = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`/api/stats?month=${month}`)
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
  }, [month])

  useEffect(() => {
    setLoading(true)
    fetchStats()
    const t = setInterval(fetchStats, REFRESH_INTERVAL)
    return () => clearInterval(t)
  }, [fetchStats])

  const s = data?.summary
  const pendingProviders = data?.providers?.filter(
    p => p.status === 'pendiente' || p.status === 'parcial'
  ) ?? []

  const isCurrentMonth = month === currentMonthStr()
  const canGoNext = !isCurrentMonth

  return (
    <div className="min-h-screen bg-gray-50">
      <Header lastUpdated={lastUpdated} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6">

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-[#f6653c]/10 border border-[#f6653c]/30 p-4 text-[#d94e27] text-sm font-medium">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Month navigator + refresh ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
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
              disabled={!canGoNext}
              className={`w-7 h-7 flex items-center justify-center rounded-full border transition-all ${
                canGoNext
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

          <button
            onClick={() => { setLoading(true); fetchStats() }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#f6653c] transition-colors font-semibold"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        {/* ── Compact stat strip ── */}
        {!loading && s && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatPill
              label="Proveedores"
              value={s.period.totalProviders}
              icon={<Building2 size={12} className="text-[#0890f1]" />}
              accent="blue"
            />
            <StatPill
              label="Pendientes hoy"
              value={s.today.pendingProviders}
              icon={<AlertCircle size={12} className={s.today.pendingProviders > 0 ? 'text-[#f6653c]' : 'text-emerald-500'} />}
              accent={s.today.pendingProviders > 0 ? 'red' : 'green'}
              highlight={s.today.pendingProviders > 0}
            />
            <StatPill
              label="Órdenes del mes"
              value={s.period.totalOrders}
              icon={<span className="text-[10px] font-black text-gray-400">#</span>}
              accent="gray"
            />
            <StatPill
              label="Cumplimiento"
              value={`${s.period.avgComplianceRate}%`}
              icon={<span className="text-[10px] font-black text-gray-400">%</span>}
              accent={s.period.avgComplianceRate >= 80 ? 'green' : s.period.avgComplianceRate >= 50 ? 'yellow' : 'red'}
            />
          </div>
        )}

        {/* ── Alert banner ── */}
        {!loading && pendingProviders.length > 0 && (
          <AlertBanner providers={pendingProviders} />
        )}

        {/* ── Insights ── */}
        {!loading && s && <InsightsSection summary={s} />}

        {/* ── HERO: Provider scorecards ── */}
        <div className="gl-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-black text-gray-900">Estado de lavanderías · Hoy</h2>
              <p className="text-[10px] text-gray-400 mt-0.5 font-medium capitalize">
                {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
            : <ProviderTable providers={data?.providers ?? []} />
          }
        </div>

        {/* ── Pending orders (collapsible) ── */}
        <PendingOrdersSection orders={data?.pendingOrders ?? []} loading={loading} />

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Trend chart */}
          <div className="lg:col-span-2 gl-card p-4 sm:p-6">
            <h2 className="text-sm font-bold text-gray-800 mb-0.5">Guías por fecha de entrega</h2>
            <p className="text-[10px] text-gray-400 font-medium mb-4 capitalize">
              {monthLabel(month)} · solo entregas ya vencidas · sin canceladas
            </p>
            {loading
              ? <div className="h-48 sm:h-56 flex items-center justify-center">
                  <LoadingDots />
                </div>
              : <WeeklyChart data={data?.dailyStats ?? []} />
            }
          </div>

          {/* Summary panel */}
          <div className="gl-card p-4 sm:p-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4 capitalize">Resumen · {monthLabel(month)}</h2>
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
                  label="Cumplimiento del mes"
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

      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-[10px] text-gray-300 font-medium">
        <span className="text-gl-blue font-bold">getlavado</span> B2B · Control de Guías · Panel interno
      </footer>
    </div>
  )
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

const accentMap = {
  blue:   'bg-[#0890f1]/10 border-[#0890f1]/20',
  green:  'bg-emerald-50 border-emerald-200',
  red:    'bg-red-50 border-red-200',
  yellow: 'bg-amber-50 border-amber-200',
  gray:   'bg-gray-50 border-gray-200',
}
const valMap = {
  blue:   'text-[#0672c4]',
  green:  'text-emerald-700',
  red:    'text-red-700',
  yellow: 'text-amber-700',
  gray:   'text-gray-600',
}

function StatPill({ label, value, icon, accent = 'gray', highlight = false }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-2.5 ${accentMap[accent]} ${highlight ? 'shadow-sm' : ''}`}>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-black leading-none ${valMap[accent]}`}>{value}</p>
        <p className="text-[9px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wide truncate">{label}</p>
      </div>
    </div>
  )
}

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
      <div className="flex gap-1.5 justify-center">
        <LoadingDots />
      </div>
      <p className="text-xs text-gray-300 mt-3 font-medium">Cargando lavanderías…</p>
    </div>
  )
}
