import { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

const ADMIN_BASE = 'https://admin.getlavado.com/admin/services'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function PendingOrdersSection({ orders = [], loading }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')

  if (loading) return null
  if (orders.length === 0) return null

  const filtered = filter.trim()
    ? orders.filter(o =>
        o.laundryName.toLowerCase().includes(filter.toLowerCase()) ||
        o.id.toLowerCase().includes(filter.toLowerCase())
      )
    : orders

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
            <h2 className="text-sm font-bold text-gray-800">
              Órdenes sin guía
            </h2>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
              {orders.length} orden{orders.length !== 1 ? 'es' : ''} sin constancia en el período
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
        <div className="border-t border-gray-50">
          {/* Search filter */}
          <div className="px-4 sm:px-6 py-3">
            <input
              type="text"
              placeholder="Filtrar por lavandería o ID…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full sm:w-72 text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#f6653c]/50 focus:bg-white transition-colors"
            />
          </div>

          {/* Mobile: card list */}
          <div className="sm:hidden divide-y divide-gray-50">
            {filtered.map(o => (
              <div key={o.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-xs truncate">{o.laundryName}</p>
                  <p className="text-[10px] text-gray-300 font-mono mt-0.5 truncate">{o.id}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Entrega: {formatDate(o.deliveryDate)}</p>
                </div>
                <a
                  href={`${ADMIN_BASE}/${o.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-[#0890f1] hover:text-[#0675c8] transition-colors bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg"
                >
                  Ver
                  <ExternalLink size={9} />
                </a>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-gray-300 font-medium">Sin resultados</p>
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Lavandería', 'ID orden', 'Fecha entrega', ''].map((h, i) => (
                    <th
                      key={i}
                      className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-2.5 last:text-right"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-6 py-3">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-[#0890f1] transition-colors">
                        {o.laundryName}
                      </p>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-xs font-mono text-gray-400 truncate max-w-[180px]">{o.id}</p>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-xs text-gray-500">{formatDate(o.deliveryDate)}</p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <a
                        href={`${ADMIN_BASE}/${o.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0890f1] hover:text-[#0675c8] transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg"
                      >
                        Ver orden
                        <ExternalLink size={10} />
                      </a>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-xs text-gray-300 font-medium">
                      Sin resultados para "{filter}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {filtered.length > 0 && (
            <div className="px-6 py-2.5 border-t border-gray-50 text-[10px] text-gray-300 font-medium">
              Mostrando {filtered.length} de {orders.length} órdenes
            </div>
          )}
        </div>
      )}
    </div>
  )
}
