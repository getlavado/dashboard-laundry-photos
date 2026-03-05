import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

export default function AlertBanner({ providers }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || providers.length === 0) return null

  const names = providers.slice(0, 2).map(p => p.name).join(', ')
  const more = providers.length > 2 ? ` +${providers.length - 2} más` : ''

  return (
    <div className="flex items-start gap-3 bg-[#f6653c]/10 border border-[#f6653c]/30 rounded-2xl px-4 py-3">
      <div className="w-7 h-7 rounded-full bg-[#f6653c]/20 flex items-center justify-center shrink-0 mt-0.5">
        <AlertTriangle size={13} className="text-[#f6653c]" />
      </div>
      <p className="text-sm text-[#d94e27] flex-1 font-medium">
        <strong className="font-bold">{providers.length} proveedor{providers.length > 1 ? 'es' : ''} sin guías hoy:</strong>{' '}
        <span className="font-normal">{names}{more}</span>
      </p>
      <button onClick={() => setDismissed(true)} className="text-[#f6653c]/40 hover:text-[#f6653c] transition-colors mt-0.5">
        <X size={14} />
      </button>
    </div>
  )
}
