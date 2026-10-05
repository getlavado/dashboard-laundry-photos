import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Target, Zap } from 'lucide-react'

/* ─── Insight generator ─────────────────────────────────────────────────── */

function generateInsights(s, mode = 'month') {
  const p = s?.period
  const t = s?.today
  if (!p || !p.totalOrders) return []

  const insights = []
  const periodWord = mode === 'week' ? 'semana' : 'mes'
  const monthPct   = Math.round((p.dayOfMonth / p.daysInMonth) * 100)
  const daysLeft   = p.daysInMonth - p.dayOfMonth
  const TARGET     = 80

  // 1. Cumplimiento del período vs target
  if (p.overallRate >= TARGET) {
    insights.push({
      id:   'rate-ok',
      type: 'success',
      icon: CheckCircle2,
      title: `${p.overallRate}% de cumplimiento esta ${periodWord}`,
      desc: `Por encima del objetivo (${TARGET}%). Llevas ${p.totalWithGuia} guías de ${p.totalOrders} órdenes.`,
    })
  } else {
    const missing = p.totalOrders > 0
      ? Math.ceil((TARGET / 100) * p.totalOrders) - p.totalWithGuia
      : 0
    insights.push({
      id:   'rate-low',
      type: p.overallRate < 50 ? 'danger' : 'warning',
      icon: Target,
      title: `Solo ${p.overallRate}% de cumplimiento — faltan ${missing} guías para el ${TARGET}%`,
      desc: `Llevas ${p.dayOfMonth} de ${p.daysInMonth} días de la ${periodWord} (${monthPct}% del tiempo transcurrido).`,
    })
  }

  // 2. Pace / ritmo diario
  if (p.avgGuiasPerDay > 0 && daysLeft > 0 && p.overallRate < TARGET) {
    const guiasNeeded   = Math.ceil((TARGET / 100) * p.totalOrders) - p.totalWithGuia
    const perDayNeeded  = Math.ceil(guiasNeeded / daysLeft)
    if (perDayNeeded > p.avgGuiasPerDay * 1.5) {
      insights.push({
        id:   'pace-hard',
        type: 'warning',
        icon: Zap,
        title: `Necesitas ${perDayNeeded} guías/día los próximos ${daysLeft} días`,
        desc: `Tu ritmo actual es ${p.avgGuiasPerDay} guías/día. Hay que acelerar para cerrar la ${periodWord} en ${TARGET}%.`,
      })
    } else if (perDayNeeded <= p.avgGuiasPerDay) {
      insights.push({
        id:   'pace-ok',
        type: 'info',
        icon: TrendingUp,
        title: `Ritmo actual (${p.avgGuiasPerDay}/día) suficiente para llegar al ${TARGET}%`,
        desc: `Con ${perDayNeeded} guías/día en los próximos ${daysLeft} días alcanzas el objetivo.`,
      })
    }
  }

  // 3. Tendencia reciente
  if (p.trend === 'up') {
    insights.push({
      id:   'trend-up',
      type: 'success',
      icon: TrendingUp,
      title: 'Tendencia positiva en los últimos días',
      desc: 'El cumplimiento de los últimos 3 días supera el período anterior. Buen ritmo.',
    })
  } else if (p.trend === 'down') {
    insights.push({
      id:   'trend-down',
      type: 'warning',
      icon: TrendingDown,
      title: 'Tendencia a la baja en los últimos días',
      desc: 'El cumplimiento de los últimos 3 días cayó respecto al período anterior. Revisar con las plantas.',
    })
  }

  // 4. Proveedor más problemático
  if (p.worstProvider && p.worstProvider.compliance < 50) {
    insights.push({
      id:   'worst',
      type: 'danger',
      icon: AlertTriangle,
      title: `${p.worstProvider.name} es la planta más atrasada`,
      desc: `Solo ${p.worstProvider.compliance}% de cumplimiento — ${p.worstProvider.pending} guía${p.worstProvider.pending !== 1 ? 's' : ''} pendiente${p.worstProvider.pending !== 1 ? 's' : ''}.`,
    })
  }

  // 5. Hoy sin actividad
  if (t?.totalOrders === 0 && p.dayOfMonth > 0) {
    insights.push({
      id:   'no-today',
      type: 'info',
      icon: Minus,
      title: 'Sin órdenes registradas hoy todavía',
      desc: 'Es posible que los pedidos del día aún no se hayan asignado o procesado.',
    })
  } else if (t?.totalOrders > 0 && t?.ordersWithout > 0) {
    insights.push({
      id:   'pending-today',
      type: t.ordersWithout > 3 ? 'danger' : 'warning',
      icon: AlertTriangle,
      title: `${t.ordersWithout} orden${t.ordersWithout > 1 ? 'es' : ''} sin guía hoy`,
      desc: `De ${t.totalOrders} órdenes de hoy, ${t.ordersWithGuia} ya tienen constancia. ${t.ordersWithout} pendiente${t.ordersWithout > 1 ? 's' : ''}.`,
    })
  } else if (t?.totalOrders > 0 && t?.ordersWithout === 0) {
    insights.push({
      id:   'today-clean',
      type: 'success',
      icon: CheckCircle2,
      title: '¡Todas las órdenes de hoy tienen guía!',
      desc: `${t.ordersWithGuia} constancias subidas hoy. Sin pendientes.`,
    })
  }

  return insights.slice(0, 4)
}

/* ─── Style maps ─────────────────────────────────────────────────────────── */

const styles = {
  success: {
    card:  'bg-emerald-50 border-emerald-200',
    bar:   'bg-emerald-500',
    icon:  'bg-emerald-100 text-emerald-600',
    title: 'text-emerald-900',
    desc:  'text-emerald-700',
  },
  warning: {
    card:  'bg-amber-50 border-amber-200',
    bar:   'bg-amber-400',
    icon:  'bg-amber-100 text-amber-600',
    title: 'text-amber-900',
    desc:  'text-amber-700',
  },
  danger: {
    card:  'bg-red-50 border-red-200',
    bar:   'bg-red-500',
    icon:  'bg-red-100 text-red-600',
    title: 'text-red-900',
    desc:  'text-red-700',
  },
  info: {
    card:  'bg-[#0890f1]/5 border-[#0890f1]/20',
    bar:   'bg-[#0890f1]',
    icon:  'bg-[#0890f1]/10 text-[#0890f1]',
    title: 'text-[#0672c4]',
    desc:  'text-[#0890f1]/80',
  },
}

/* ─── Period progress bar ────────────────────────────────────────────────── */

function PeriodProgress({ dayOfMonth, daysInMonth, overallRate, mode = 'month' }) {
  const periodPct  = Math.round((dayOfMonth / daysInMonth) * 100)
  const TARGET     = 80
  const periodWord = mode === 'week' ? 'la semana' : 'el mes'

  return (
    <div className="gl-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-black text-gray-500 uppercase tracking-wide">
          Progreso de {periodWord}
        </span>
        <span className="text-xs font-bold text-gray-400">
          Día {dayOfMonth} de {daysInMonth}
        </span>
      </div>

      {/* Time bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-semibold text-gray-400">
          <span>Tiempo transcurrido</span>
          <span>{periodPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-1.5 rounded-full bg-gray-300 transition-all duration-700" style={{ width: `${periodPct}%` }} />
        </div>
      </div>

      {/* Compliance bar */}
      <div className="space-y-2 mt-3">
        <div className="flex items-center justify-between text-[10px] font-semibold">
          <span className="text-gray-400">Cumplimiento acumulado</span>
          <span className={overallRate >= TARGET ? 'text-emerald-600' : overallRate >= 60 ? 'text-amber-600' : 'text-[#f6653c]'}>
            {overallRate}%
          </span>
        </div>
        <div className="relative h-2.5 rounded-full bg-gray-100 overflow-visible">
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-300 z-10"
            style={{ left: `${TARGET}%` }}
            title={`Objetivo: ${TARGET}%`}
          />
          <div
            className={`h-2.5 rounded-full transition-all duration-700 ${
              overallRate >= TARGET ? 'bg-emerald-500' :
              overallRate >= 60    ? 'bg-amber-400'   : 'bg-[#f6653c]'
            }`}
            style={{ width: `${overallRate}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[9px] text-gray-300 font-medium">
          <span>0%</span>
          <span className="text-gray-400">▲ objetivo {TARGET}%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Main export ────────────────────────────────────────────────────────── */

export default function InsightsSection({ summary, mode = 'month' }) {
  const p = summary?.period
  if (!p || !p.totalOrders) return null

  const insights = generateInsights(summary, mode)

  return (
    <div className="space-y-3 sm:space-y-4">
      <PeriodProgress
        dayOfMonth={p.dayOfMonth}
        daysInMonth={p.daysInMonth}
        overallRate={p.overallRate}
        mode={mode}
      />

      {insights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.map(ins => {
            const st   = styles[ins.type] ?? styles.info
            const Icon = ins.icon
            return (
              <div key={ins.id} className={`relative rounded-2xl border overflow-hidden ${st.card}`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${st.bar}`} />
                <div className="pl-4 pr-4 py-3.5 flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${st.icon}`}>
                    <Icon size={13} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-black leading-snug ${st.title}`}>{ins.title}</p>
                    <p className={`text-[10px] font-medium mt-0.5 leading-relaxed ${st.desc}`}>{ins.desc}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
