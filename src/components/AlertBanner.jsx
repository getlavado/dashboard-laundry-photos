import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

export default function AlertBanner({ providers }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || providers.length === 0) return null

  const names  = providers.slice(0, 3).map(p => p.name).join(', ')
  const more   = providers.length > 3 ? ` +${providers.length - 3} más` : ''
  const urgent = providers.some(p => p.status === 'pendiente')

  return (
    <div className={`relative flex items-start gap-3 rounded-2xl px-4 py-4 overflow-hidden ${
      urgent
        ? 'bg-red-50 border-2 border-red-200'
        : 'bg-amber-50 border-2 border-amber-200'
    }`}>
      {/* left accent stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${urgent ? 'bg-red-500' : 'bg-amber-400'}`} />

      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
        urgent ? 'bg-red-100' : 'bg-amber-100'
      }`}>
        <AlertTriangle size={15} className={urgent ? 'text-red-600' : 'text-amber-600'} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-black leading-tight ${urgent ? 'text-red-800' : 'text-amber-800'}`}>
          {providers.length} lavandería{providers.length > 1 ? 's' : ''} sin guías hoy
        </p>
        <p className={`text-xs font-medium mt-0.5 truncate ${urgent ? 'text-red-600' : 'text-amber-600'}`}>
          {names}{more}
        </p>
      </div>

      <button
        onClick={() => setDismissed(true)}
        className={`shrink-0 mt-0.5 p-1 rounded-lg transition-colors ${
          urgent
            ? 'text-red-300 hover:text-red-600 hover:bg-red-100'
            : 'text-amber-300 hover:text-amber-600 hover:bg-amber-100'
        }`}
      >
        <X size={14} />
      </button>
    </div>
  )
}
