import { CheckCircle2, AlertCircle, Clock, MinusCircle, TrendingDown, TrendingUp, ChevronDown } from 'lucide-react'
import { useState } from 'react'

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function ComplianceBar({ value, size = 'md' }) {
  const color =
    value >= 80 ? 'bg-emerald-500' :
    value >= 50 ? 'bg-amber-400' :
    value >  0  ? 'bg-[#f6653c]' : 'bg-gray-200 dark:bg-gray-700'
  const h = size === 'sm' ? 'h-1' : 'h-2'
  return (
    <div className={`flex-1 ${h} rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden`}>
      <div className={`${h} rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

/* ─── Failing Provider Card ──────────────────────────────────────────────── */

function FailingCard({ p, mode = 'month' }) {
  const isPending = p.status === 'pendiente'
  const pending   = p.totalOrders - p.totalWithGuia
  const accentBg  = isPending
    ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50'
    : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50'
  const numColor  = isPending ? 'text-red-600 dark:text-red-400'   : 'text-amber-600 dark:text-amber-400'
  const dotColor  = isPending ? 'bg-red-500'   : 'bg-amber-400'
  const badgeBg   = isPending
    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
  const barPct    = p.weeklyCompliance
  const periodLabel = mode === 'week' ? 'de la semana' : 'del mes'

  return (
    <div className={`relative rounded-2xl border-2 ${accentBg} p-4 sm:p-5 flex flex-col gap-3 overflow-hidden`}>
      <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-60`} />
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`} />
      </span>

      <div className="pr-6">
        <p className="font-black text-gray-900 dark:text-gray-100 text-sm leading-tight">{p.name}</p>
        <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg}`}>
          {isPending ? <AlertCircle size={9} /> : <Clock size={9} />}
          {isPending ? 'Sin guías' : 'Parcial'}
        </span>
      </div>

      <div>
        <p className={`text-4xl font-black leading-none ${numColor}`}>{pending}</p>
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-0.5 uppercase tracking-wide">
          {pending === 1 ? 'guía pendiente' : 'guías pendientes'}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Cumplimiento {periodLabel}</span>
          <span className={`text-xs font-black ${numColor}`}>{barPct}%</span>
        </div>
        <ComplianceBar value={barPct} size="md" />
      </div>

      <div className="flex items-center gap-3 pt-1 border-t border-black/5 dark:border-white/10 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
        <span>{p.totalWithGuia}/{p.totalOrders} {periodLabel}</span>
        {p.todayOrders > 0 && <span className="text-gray-400 dark:text-gray-600">·</span>}
        {p.todayOrders > 0 && <span>{p.todayWithGuia}/{p.todayOrders} hoy</span>}
      </div>
    </div>
  )
}

/* ─── Good Provider Row ──────────────────────────────────────────────────── */

function GoodRow({ p }) {
  const noOrders = p.status === 'sin-ordenes'
  return (
    <div className="flex items-center gap-3 py-2.5 px-1 group hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors">
      <div className="shrink-0">
        {noOrders
          ? <MinusCircle size={14} className="text-gray-300 dark:text-gray-600" />
          : <CheckCircle2 size={14} className="text-emerald-500" />
        }
      </div>

      <p className={`flex-1 text-sm font-semibold truncate ${noOrders ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-gray-300'}`}>
        {p.name}
      </p>

      {!noOrders && (
        <div className="flex items-center gap-2 shrink-0 w-28 sm:w-36">
          <ComplianceBar value={p.weeklyCompliance} size="sm" />
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 w-8 text-right shrink-0">
            {p.weeklyCompliance}%
          </span>
        </div>
      )}

      <span className={`text-[10px] font-semibold shrink-0 w-14 text-right ${noOrders ? 'text-gray-200 dark:text-gray-700' : 'text-gray-400 dark:text-gray-500'}`}>
        {noOrders ? 'sin órdenes' : `${p.totalOrders} ords.`}
      </span>
    </div>
  )
}

/* ─── Main Export ────────────────────────────────────────────────────────── */

export default function ProviderTable({ providers, mode = 'month' }) {
  const [showInactive, setShowInactive] = useState(false)

  if (providers.length === 0) {
    return (
      <div className="p-12 text-center text-gray-300 dark:text-gray-600 text-sm font-medium">
        No hay proveedores con órdenes en este período
      </div>
    )
  }

  const failing  = providers.filter(p => p.status === 'pendiente' || p.status === 'parcial')
  const active   = providers.filter(p => p.status === 'al-dia')
  const inactive = providers.filter(p => p.status === 'sin-ordenes')

  return (
    <div className="space-y-6">

      {/* ── Failing section ── */}
      {failing.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={13} className="text-red-500" />
            <h3 className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">
              Necesitan atención · {failing.length}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {failing.map(p => <FailingCard key={p.id} p={p} mode={mode} />)}
          </div>
        </div>
      )}

      {/* ── Active + compliant section ── */}
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={13} className="text-emerald-500" />
            <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              Al corriente · {active.length}
            </h3>
          </div>
          <div className="gl-card divide-y divide-gray-50 dark:divide-gray-800 px-3">
            {active.map(p => <GoodRow key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {failing.length === 0 && active.length > 0 && (
        <div className="text-center py-1">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Todos los proveedores activos al corriente hoy</p>
        </div>
      )}

      {/* ── Inactive section ── */}
      {inactive.length > 0 && (
        <div>
          <button
            onClick={() => setShowInactive(v => !v)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors uppercase tracking-widest"
          >
            <ChevronDown size={11} className={`transition-transform ${showInactive ? 'rotate-180' : ''}`} />
            {inactive.length} sin órdenes este período
          </button>
          {showInactive && (
            <div className="mt-2 divide-y divide-gray-50 dark:divide-gray-800 px-1">
              {inactive.map(p => (
                <div key={p.id} className="flex items-center gap-2 py-2 text-gray-300 dark:text-gray-600">
                  <MinusCircle size={12} />
                  <span className="text-xs font-medium">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
