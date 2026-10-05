import { delayDays } from '../delay'

// Semáforo general. Regla:
//   MAL         → alguna guía lleva 3+ días sin subir
//   MÁS O MENOS → la más atrasada lleva 2 días
//   BIEN        → nada atrasado, o solo guías de ayer
const VERDICTS = {
  mal: {
    emoji: '🔴',
    title: 'Vamos mal',
    box:   'bg-red-500',
  },
  medio: {
    emoji: '🟡',
    title: 'Más o menos',
    box:   'bg-amber-400',
  },
  bien: {
    emoji: '🟢',
    title: 'Vamos bien',
    box:   'bg-emerald-500',
  },
}

export default function StatusHero({ pendingOrders = [], complianceRate }) {
  const delays   = pendingOrders.map(o => delayDays(o.pickUpTime))
  const grave    = delays.filter(d => d >= 3).length
  const maxDelay = Math.max(0, ...delays)
  const plants   = new Set(pendingOrders.map(o => o.laundryId || o.laundryName)).size

  const key = maxDelay >= 3 ? 'mal' : maxDelay === 2 ? 'medio' : 'bien'
  const v   = VERDICTS[key]

  const worst = pendingOrders
    .filter(o => delayDays(o.pickUpTime) === maxDelay)
    .reduce((acc, o) => { acc[o.laundryName] = (acc[o.laundryName] || 0) + 1; return acc }, {})
  const worstNames = Object.entries(worst).sort((a, b) => b[1] - a[1]).map(([n]) => n)

  const message =
    key === 'mal'
      ? `${grave} guía${grave !== 1 ? 's llevan' : ' lleva'} 3 días o más sin subir. Peor: ${worstNames.slice(0, 3).join(', ')} (${maxDelay} días).`
    : key === 'medio'
      ? `Hay guías con 2 días de retraso: ${worstNames.slice(0, 3).join(', ')}. Hay que empujar hoy.`
    : pendingOrders.length > 0
      ? `Solo faltan guías de ayer (${pendingOrders.length}). Normal, se suben hoy.`
      : 'Todas las plantas subieron sus guías.'

  return (
    <div className={`rounded-2xl ${v.box} text-white px-5 sm:px-7 py-5 sm:py-6 shadow-sm`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-4xl sm:text-5xl leading-none">{v.emoji}</span>
          <div className="min-w-0">
            <p className="text-2xl sm:text-3xl font-black leading-tight">{v.title}</p>
            <p className="text-sm sm:text-base font-semibold text-white/90 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 shrink-0">
          <Num value={pendingOrders.length} label="guías atrasadas" />
          <Num value={plants} label="plantas" />
          {complianceRate != null && <Num value={`${complianceRate}%`} label="a tiempo" />}
        </div>
      </div>
    </div>
  )
}

function Num({ value, label }) {
  return (
    <div className="bg-white/20 rounded-xl px-3 sm:px-4 py-2 text-center min-w-[72px]">
      <p className="text-xl sm:text-2xl font-black leading-none">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/85 mt-1">{label}</p>
    </div>
  )
}
