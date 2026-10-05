import { useState } from 'react'
import { delayDays, delayLevel } from '../delay'
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

function delayLabel(days) {
  return `${days} día${days !== 1 ? 's' : ''} de retraso`
}

const LEVEL_STYLES = {
  grave: {
    border: 'border-red-200',
    bar:    'bg-red-500',
    bg:     'bg-red-50',
    text:   'text-red-700',
    badge:  'bg-red-100 text-red-700 border-red-200',
  },
  medio: {
    border: 'border-orange-200',
    bar:    'bg-orange-400',
    bg:     'bg-orange-50',
    text:   'text-orange-700',
    badge:  'bg-orange-100 text-orange-700 border-orange-200',
  },
  leve: {
    border: 'border-amber-200',
    bar:    'bg-amber-300',
    bg:     'bg-amber-50/60',
    text:   'text-amber-800',
    badge:  'bg-amber-100 text-amber-700 border-amber-200',
  },
}

function buildCopyText(group) {
  const lines = [
    `TOTAL DE GUIAS DE RECOJO PENDIENTES: ${group.orders.length}`,
    '',
    'ATT',
    ...group.orders.map(o => `* ${o.b2bPartnerName || o.id} ${formatShortDate(o.pickUpTime)} — ${delayLabel(o.delay)}`),
  ]
  return lines.join('\n')
}

// Agrupa por planta y ordena: primero la que tiene la guía más atrasada.
function groupByLaundry(orders) {
  const map = {}
  for (const o of orders) {
    const key = o.laundryId || o.laundryName
    if (!map[key]) map[key] = { id: key, name: o.laundryName, orders: [] }
    map[key].orders.push({ ...o, delay: delayDays(o.dueFrom) })
  }
  return Object.values(map)
    .map(g => {
      const sorted = [...g.orders].sort((a, b) => b.delay - a.delay)
      return { ...g, orders: sorted, maxDelay: sorted[0]?.delay ?? 0 }
    })
    .sort((a, b) => b.maxDelay - a.maxDelay || b.orders.length - a.orders.length)
}

/* ─── Per-laundry collapsible group ─────────────────────────────────────── */

function LaundryGroup({ group }) {
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

  const accent = LEVEL_STYLES[delayLevel(group.maxDelay)]

  return (
    <div className={`rounded-xl border overflow-hidden ${accent.border}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v) } }}
        className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 ${accent.bg} hover:brightness-95 transition-all text-left cursor-pointer`}
      >
        <div className={`w-1.5 self-stretch rounded-full shrink-0 ${accent.bar}`} />

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-black truncate ${accent.text}`}>{group.name}</p>
          <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
            {count} guía{count !== 1 ? 's' : ''} sin subir
          </p>
        </div>

        <div className={`shrink-0 text-xs font-black px-3 py-1 rounded-full border ${accent.badge}`}
          title="Retraso de su guía más antigua">
          {group.maxDelay >= 3 && '⚠ '}{group.maxDelay} día{group.maxDelay !== 1 ? 's' : ''}
        </div>

        <button
          onClick={handleCopy}
          title="Copiar resumen para enviar a la planta"
          className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            copied
              ? 'bg-green-100 text-green-600'
              : 'bg-white/60 text-gray-400 hover:text-gray-600'
          }`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>

        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <div className="divide-y divide-gray-50 bg-white">
          {group.orders.map(o => {
            const st = LEVEL_STYLES[delayLevel(o.delay)]
            return (
              <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 transition-colors">
                <Package size={11} className="text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-600 font-semibold flex flex-wrap items-center gap-x-1.5">
                    <span>Recojo: {formatDate(o.pickUpTime)}</span>
                    {o.b2bPartnerName && <span className="opacity-40">·</span>}
                    {o.b2bPartnerName && (
                      <span className="text-[#0890f1] font-medium">{o.b2bPartnerName}</span>
                    )}
                  </p>
                  <p className="text-[10px] font-mono text-gray-400 truncate mt-0.5">{o.id}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${st.badge}`}>
                  {delayLabel(o.delay)}
                </span>
                <a
                  href={`${ADMIN_BASE}/${o.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-[#0890f1] hover:text-[#0675c8] bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Ver <ExternalLink size={9} />
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Main export ────────────────────────────────────────────────────────── */

export default function PendingOrdersSection({ orders = [], loading }) {
  const [open, setOpen] = useState(true)

  if (loading || orders.length === 0) return null

  const groups = groupByLaundry(orders)

  return (
    <div className="gl-card overflow-hidden border-2 border-[#f6653c]/20">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 sm:px-7 pt-6 pb-5 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3.5 text-left">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#f6653c]/10 flex items-center justify-center shrink-0">
            <AlertCircle size={22} className="text-[#d94e27]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-gray-800">¿Quién está atrasado?</h2>
            <p className="text-xs sm:text-sm text-gray-500 font-semibold mt-0.5">
              Primero la planta más atrasada · toca una para ver sus guías
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-sm sm:text-base bg-[#f6653c]/10 text-[#d94e27] border border-[#f6653c]/20 px-3 py-1.5 rounded-full font-black">
            {orders.length}
          </span>
          {open
            ? <ChevronUp size={18} className="text-gray-400" />
            : <ChevronDown size={18} className="text-gray-400" />
          }
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-50 px-5 sm:px-7 py-5 space-y-3">
          {groups.map(g => <LaundryGroup key={g.id} group={g} />)}
        </div>
      )}
    </div>
  )
}
