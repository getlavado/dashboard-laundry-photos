import { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp, AlertCircle, Package } from 'lucide-react'

const ADMIN_BASE = 'https://admin.getlavado.com/admin/services'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function groupByLaundry(orders) {
  const map = {}
  for (const o of orders) {
    const key = o.laundryId || o.laundryName
    if (!map[key]) map[key] = { id: key, name: o.laundryName, orders: [] }
    map[key].orders.push(o)
  }
  // Sort worst (most pending) → best (fewest)
  return Object.values(map).sort((a, b) => b.orders.length - a.orders.length)
}

/* ─── Per-laundry collapsible group ─────────────────────────────────────── */

function LaundryGroup({ group }) {
  const [open, setOpen] = useState(false)
  const count = group.orders.length

  const accent =
    count >= 5 ? { bar: 'bg-red-500',   bg: 'bg-red-50',   text: 'text-red-700',   badge: 'bg-red-100 text-red-700 border-red-200' } :
    count >= 2 ? { bar: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700 border-amber-200' } :
                 { bar: 'bg-gray-300',  bg: 'bg-gray-50',  text: 'text-gray-600',  badge: 'bg-gray-100 text-gray-500 border-gray-200' }

  return (
    <div className={`rounded-xl border overflow-hidden ${count >= 5 ? 'border-red-200' : count >= 2 ? 'border-amber-200' : 'border-gray-100'}`}>
      {/* Group header */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 ${accent.bg} hover:brightness-95 transition-all text-left`}
      >
        {/* Left accent bar */}
        <div className={`w-1 self-stretch rounded-full shrink-0 ${accent.bar}`} />

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black truncate ${accent.text}`}>{group.name}</p>
        </div>

        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${accent.badge}`}>
          {count} sin guía
        </span>

        <ChevronDown
          size={13}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Orders list */}
      {open && (
        <div className="divide-y divide-gray-50 bg-white">
          {group.orders.map(o => (
            <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 transition-colors">
              <Package size={11} className="text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-gray-400 truncate">{o.id}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Entrega: {formatDate(o.deliveryDate)}</p>
              </div>
              <a
                href={`${ADMIN_BASE}/${o.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-[#0890f1] hover:text-[#0675c8] bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
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
      {/* Header — clickable to toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 sm:px-6 pt-5 pb-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-xl bg-[#f6653c]/10 flex items-center justify-center shrink-0">
            <AlertCircle size={15} className="text-[#d94e27]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Órdenes sin guía</h2>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
              {orders.length} orden{orders.length !== 1 ? 'es' : ''} · {groups.length} lavandería{groups.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] bg-[#f6653c]/10 text-[#d94e27] border border-[#f6653c]/20 px-2 py-1 rounded-full font-bold">
            {orders.length}
          </span>
          {open
            ? <ChevronUp size={14} className="text-gray-400" />
            : <ChevronDown size={14} className="text-gray-400" />
          }
        </div>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-gray-50 px-4 sm:px-6 py-4 space-y-2.5">
          {groups.map(g => <LaundryGroup key={g.id} group={g} />)}
        </div>
      )}
    </div>
  )
}
