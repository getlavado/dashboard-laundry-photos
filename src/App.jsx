import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import KPICard from './components/KPICard'
import WeeklyChart from './components/WeeklyChart'
import ProviderTable from './components/ProviderTable'
import AlertBanner from './components/AlertBanner'
import PendingOrdersSection from './components/PendingOrdersSection'
import { RefreshCw } from 'lucide-react'

const REFRESH_INTERVAL = 5 * 60 * 1000

export default function App() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [days, setDays]           = useState(7)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchStats = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`/api/stats?days=${days}`)
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error') }
      setData(await res.json())
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [days])

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header lastUpdated={lastUpdated} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6">

        {/* Alert */}
        {!loading && pendingProviders.length > 0 && (
          <AlertBanner providers={pendingProviders} />
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-[#f6653c]/10 border border-[#f6653c]/30 p-4 text-[#d94e27] text-sm font-medium">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Period selector + refresh */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wide hidden sm:block">Período</span>
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
                  days === d
                    ? 'bg-[#f6653c] text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-[#f6653c] hover:text-[#f6653c]'
                }`}
              >
                {d} días
              </button>
            ))}
          </div>
          <button
            onClick={() => { setLoading(true); fetchStats() }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#f6653c] transition-colors font-semibold"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        {/* KPI Cards — 2x2 mobile, 4x1 desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <KPICard
            title="Proveedores activos"
            value={loading ? '—' : s?.period?.totalProviders ?? 0}
            sub={`${s?.today?.activeProviders ?? 0} activos hoy`}
            color="blue"
            icon="building"
          />
          <KPICard
            title="Sin guía hoy"
            value={loading ? '—' : s?.today?.ordersWithout ?? 0}
            sub={`${s?.today?.pendingProviders ?? 0} proveedores pendientes`}
            color={s?.today?.ordersWithout > 0 ? 'red' : 'green'}
            icon="alert"
          />
        </div>

        {/* Charts row — stacked on mobile, side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Trend chart */}
          <div className="lg:col-span-2 gl-card p-4 sm:p-6">
            <h2 className="text-sm font-bold text-gray-800 mb-0.5">Tendencia de guías subidas</h2>
            <p className="text-[10px] text-gray-400 font-medium mb-4">
              Últimos {days} días · con guía vs sin guía
            </p>
            {loading
              ? <div className="h-48 sm:h-56 flex items-center justify-center">
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-[#f6653c] animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              : <WeeklyChart data={data?.dailyStats ?? []} />
            }
          </div>

          {/* Summary panel */}
          <div className="gl-card p-4 sm:p-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4">Resumen del período</h2>
            <div className="space-y-3 sm:space-y-4">
              <StatRow label="Total órdenes" value={s?.period?.totalOrders ?? '—'} />
              <StatRow label="Con guía" value={s?.period?.totalWithGuia ?? '—'} valueColor="text-emerald-600" />
              <StatRow
                label="Sin guía"
                value={(s?.period?.totalOrders ?? 0) - (s?.period?.totalWithGuia ?? 0)}
                valueColor="text-[#f6653c]"
              />
              <div className="pt-3 border-t border-gray-100">
                <StatRow
                  label="Cumplimiento promedio"
                  value={loading ? '—' : `${s?.period?.avgComplianceRate ?? 0}%`}
                  valueColor={
                    !s ? '' :
                    s.period.avgComplianceRate >= 80 ? 'text-emerald-600' :
                    s.period.avgComplianceRate >= 50 ? 'text-amber-600' : 'text-[#f6653c]'
                  }
                  bold
                />
              </div>

              {/* Compliance visual indicator */}
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

        {/* Pending Orders Section */}
        <PendingOrdersSection orders={data?.pendingOrders ?? []} loading={loading} />

        {/* Provider Table */}
        <div className="gl-card">
          <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-1 sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Estado por proveedor · Hoy</h2>
              <p className="text-[10px] text-gray-400 mt-0.5 font-medium capitalize">
                {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            {/* Summary pills */}
            {!loading && s && (
              <div className="flex gap-2 flex-wrap">
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-full font-bold">
                  {s.today.compliantProviders} al día
                </span>
                <span className="text-[10px] bg-[#f6653c]/10 text-[#d94e27] border border-[#f6653c]/20 px-2 py-1 rounded-full font-bold">
                  {s.today.pendingProviders} pendientes
                </span>
              </div>
            )}
          </div>
          {loading
            ? <div className="p-12 text-center">
                <div className="flex gap-1.5 justify-center">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-[#f6653c] animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-xs text-gray-300 mt-3 font-medium">Cargando proveedores…</p>
              </div>
            : <ProviderTable providers={data?.providers ?? []} />
          }
        </div>

      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-[10px] text-gray-300 font-medium">
        <span className="text-gl-blue font-bold">getlavado</span> B2B · Control de Guías · Panel interno
      </footer>
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
