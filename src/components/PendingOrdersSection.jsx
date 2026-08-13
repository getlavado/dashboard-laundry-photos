import { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp, AlertCircle, Package, Copy, Check } from 'lucide-react'

const ADMIN_BASE = 'https://admin.getlavado.com/admin/services'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatShortDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function missingLabel(type) {
  return type === 'recojo' ? 'guía de recojo' : 'guía de entrega'
}

function buildCopyText(group) {
  const byType = [...group.orders].sort((a, b) => {
    if (a.missingType === b.missingType) return 0
    return a.missingType === 'recojo' ? -1 : 1
  })
  const lines = [
    `TOTAL DE GUIAS PENDIENTES: ${group.orders.length}`,
    '',
    'ATT',
    ...byType.map(o => `* ${o.b2bPartnerName || o.id} ${formatShortDate(o.deliveryDate)} — falta ${missingLabel(o.missingType)}`),
  ]
  return lines.join('\n')
}

function groupByLaundry(orders) {
  const map = {}
  for (const o of orders) {
    const key = o.laundryId || o.laundryName
    if (!map[key]) map[key] = { id: key, name: o.laundryName, orders: [] }
    map[key].orders.push(o)
  }
  return Object.values(map)
    .map(g => ({
      ...g,
      pickupCount:   g.orders.filter(o => o.missingType === 'recojo').length,
      deliveryCount: g.orders.filter(o => o.missingType === 'entrega').length,
    }))
    .sort((a, b) => b.orders.length - a.orders.length)
}

/* ─── Per-laundry collapsible group ─────────────────────────────────────── */

function LaundryGroup({ group, total }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const count = group.orders.length

  function handleCopy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(buildCopyText(group)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  const pct   = total > 0 ? Math.round((count / total) * 100) : 0

  const accent =
    count >= 5 ? {
      border: 'border-red-200 dark:border-red-800/50',
      bar:    'bg-red-500',
      bg:     'bg-red-50 dark:bg-red-900/20',
      text:   'text-red-700 dark:text-red-400',
      badge:  'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40',
    } :
    count >= 2 ? {
      border: 'border-amber-200 dark:border-amber-800/50',
      bar:    'bg-amber-400',
      bg:     'bg-amber-50 dark:bg-amber-900/20',
      text:   'text-amber-700 dark:text-amber-400',
      badge:  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
    } : {
      border: 'border-gray-100 dark:border-gray-800',
      bar:    'bg-gray-300 dark:bg-gray-600',
      bg:     'bg-gray-50 dark:bg-gray-800/50',
      text:   'text-gray-600 dark:text-gray-300',
      badge:  'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
    }

  return (
    <div className={`rounded-xl border overflow-hidden ${accent.border}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 ${accent.bg} hover:brightness-95 transition-all text-left`}
      >
        <div className={`w-1 self-stretch rounded-full shrink-0 ${accent.bar}`} />

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black truncate ${accent.text}`}>{group.name}</p>
        </div>

        <div className={`shrink-0 flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${accent.badge}`}>
          {group.pickupCount > 0 && group.deliveryCount > 0 ? (
            <span title="Guías de recojo y de entrega que debe esta lavandería">
              {group.pickupCount} recojo · {group.deliveryCount} entrega
            </span>
          ) : (
            <span>{count} sin guía {group.pickupCount > 0 ? 'de recojo' : 'de entrega'}</span>
          )}
          <span className="opacity-50">·</span>
          <span title="Porcentaje del total de órdenes pendientes">{pct}% del pendiente</span>
        </div>

        <button
          onClick={handleCopy}
          title="Copiar resumen"
          className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-lg transition-colors ${
            copied
              ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
              : 'bg-white/60 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>

        <ChevronDown
          size={13}
          className={`shrink-0 text-gray-400 dark:text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="divide-y divide-gray-50 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {group.orders.map(o => (
            <div key={`${o.id}-${o.missingType}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors">
              <Package size={11} className="text-gray-300 dark:text-gray-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate">{o.id}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                  {o.pickUpTime && <span>Recojo: {formatDate(o.pickUpTime)}</span>}
                  {o.pickUpTime && <span className="opacity-40">·</span>}
                  <span>Entrega: {formatDate(o.deliveryDate)}</span>
                  {o.b2bPartnerName && <span className="opacity-40">·</span>}
                  {o.b2bPartnerName && (
                    <span className="text-[#0890f1] dark:text-blue-400 font-medium">{o.b2bPartnerName}</span>
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded-full border ${
                  o.missingType === 'recojo'
                    ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50'
                    : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                }`}
              >
                Falta {missingLabel(o.missingType)}
              </span>
              <a
                href={`${ADMIN_BASE}/${o.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-[#0890f1] hover:text-[#0675c8] bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Ver <ExternalLink size={9} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Main export ────────────────────────────────────────────────────────── */

export default function PendingOrdersSection({ orders = [], loading }) {
  const [open, setOpen] = useState(false)

  if (loading || orders.length === 0) return null

  const groups = groupByLaundry(orders)

  return (
    <div className="gl-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 sm:px-6 pt-5 pb-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-xl bg-[#f6653c]/10 flex items-center justify-center shrink-0">
            <AlertCircle size={15} className="text-[#d94e27]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Guías pendientes</h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-0.5">
              {orders.length} pendiente{orders.length !== 1 ? 's' : ''} · {groups.length} lavandería{groups.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] bg-[#f6653c]/10 text-[#d94e27] border border-[#f6653c]/20 px-2 py-1 rounded-full font-bold">
            {orders.length}
          </span>
          {open
            ? <ChevronUp size={14} className="text-gray-400 dark:text-gray-500" />
            : <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
          }
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-50 dark:border-gray-800 px-4 sm:px-6 py-4 space-y-2.5">
          {groups.map(g => <LaundryGroup key={g.id} group={g} total={orders.length} />)}
        </div>
      )}
    </div>
  )
}
