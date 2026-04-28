import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

export default function AlertBanner({ providers }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || providers.length === 0) return null

  const names  = providers.slice(0, 3).map(p => p.name).join(', ')
  const more   = providers.length > 3 ? ` +${providers.length - 3} más` : ''
  const urgent = providers.some(p => p.status === 'pendiente')

  return (
    <div className={`relative flex items-start gap-3 rounded-2xl px-4 py-4 overflow-hidden border-2 ${
      urgent
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
    }`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${urgent ? 'bg-red-500' : 'bg-amber-400'}`} />

      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
        urgent ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'
      }`}>
        <AlertTriangle size={15} className={urgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-black leading-tight ${urgent ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
          {providers.length} lavandería{providers.length > 1 ? 's' : ''} sin guías hoy
        </p>
        <p className={`text-xs font-medium mt-0.5 truncate ${urgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {names}{more}
        </p>
      </div>

      <button
        onClick={() => setDismissed(true)}
        className={`shrink-0 mt-0.5 p-1 rounded-lg transition-colors ${
          urgent
            ? 'text-red-300 dark:text-red-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
            : 'text-amber-300 dark:text-amber-600 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40'
        }`}
      >
        <X size={14} />
      </button>
    </div>
  )
}
