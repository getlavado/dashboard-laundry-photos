import { CheckCircle2, AlertCircle, Clock, MinusCircle } from 'lucide-react'

const STATUS = {
  'al-dia':     { label: 'Al día',      icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'parcial':    { label: 'Parcial',     icon: Clock,        cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'pendiente':  { label: 'Sin guías',   icon: AlertCircle,  cls: 'bg-[#f6653c]/10 text-[#d94e27] border-[#f6653c]/30' },
  'sin-ordenes':{ label: 'Sin órdenes', icon: MinusCircle,  cls: 'bg-gray-50 text-gray-400 border-gray-200' },
}

function ComplianceBar({ value }) {
  const color =
    value >= 80 ? 'bg-emerald-500' :
    value >= 50 ? 'bg-amber-400' :
    value >  0  ? 'bg-[#f6653c]' : 'bg-gray-200'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 min-w-[60px]">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-500 font-semibold w-9 text-right shrink-0">{value}%</span>
    </div>
  )
}

// Mobile card view for each provider
function ProviderCard({ p }) {
  const st = STATUS[p.status] ?? STATUS['sin-ordenes']
  const Icon = st.icon
  return (
    <div className="p-4 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-bold text-gray-800 text-sm">{p.name}</p>
          <p className="text-[10px] text-gray-300 font-mono mt-0.5 truncate max-w-[180px]">{p.id}</p>
        </div>
        <span className={`status-badge border ${st.cls} shrink-0`}>
          <Icon size={10} />
          {st.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Guías pendientes</p>
          <p className="font-bold">
            {(() => {
              const pending = p.totalOrders - p.totalWithGuia
              return pending > 0
                ? <span className="text-[#d94e27]">{pending}</span>
                : <span className="text-emerald-600">0</span>
            })()}
          </p>
        </div>
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Total órdenes</p>
          <p className="font-bold text-gray-700">{p.totalOrders}</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="text-[10px] text-gray-400 font-medium mb-1">Cumplimiento semanal</p>
        <ComplianceBar value={p.weeklyCompliance} />
      </div>
    </div>
  )
}

export default function ProviderTable({ providers }) {
  if (providers.length === 0) {
    return (
      <div className="p-12 text-center text-gray-300 text-sm font-medium">
        No hay proveedores con órdenes en este período
      </div>
    )
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="sm:hidden divide-y divide-gray-50">
        {providers.map(p => <ProviderCard key={p.id} p={p} />)}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              {['Proveedor (lavandería)', 'Estado hoy', 'Guías pendientes', 'Cumplimiento semanal', 'Total órdenes'].map(h => (
                <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-3 first:pl-6 last:text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {providers.map(p => {
              const st = STATUS[p.status] ?? STATUS['sin-ordenes']
              const Icon = st.icon
              return (
                <tr key={p.id} className="hover:bg-gray-50/60 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-800 text-sm group-hover:text-[#0890f1] transition-colors">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-gray-300 font-mono mt-0.5 truncate max-w-[200px]">{p.id}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`status-badge border ${st.cls}`}>
                      <Icon size={10} />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {(() => {
                      const pending = p.totalOrders - p.totalWithGuia
                      return pending > 0
                        ? <span className="text-sm font-bold text-[#d94e27]">{pending}</span>
                        : <span className="text-sm font-bold text-emerald-600">0</span>
                    })()}
                  </td>
                  <td className="px-4 py-4 min-w-[160px]">
                    <ComplianceBar value={p.weeklyCompliance} />
                  </td>
                  <td className="px-4 py-4 text-center text-sm font-semibold text-gray-500">
                    {p.totalOrders}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
