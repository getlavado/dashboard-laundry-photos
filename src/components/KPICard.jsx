import { Building2, CheckCircle2, Upload, AlertCircle } from 'lucide-react'

const icons = {
  building: Building2,
  check:    CheckCircle2,
  upload:   Upload,
  alert:    AlertCircle,
}

const colorMap = {
  blue:   { bg: 'bg-[#0890f1]/10', icon: 'text-[#0890f1]',   val: 'text-[#0672c4]',   border: 'border-[#0890f1]/20', dot: 'bg-[#0890f1]' },
  green:  { bg: 'bg-emerald-50',   icon: 'text-emerald-500',  val: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-500' },
  teal:   { bg: 'bg-[#17a8e3]/10', icon: 'text-[#17a8e3]',   val: 'text-[#0672c4]',   border: 'border-[#17a8e3]/20', dot: 'bg-[#17a8e3]' },
  yellow: { bg: 'bg-amber-50',     icon: 'text-amber-500',    val: 'text-amber-700',   border: 'border-amber-100', dot: 'bg-amber-500' },
  red:    { bg: 'bg-[#f6653c]/10', icon: 'text-[#f6653c]',   val: 'text-[#d94e27]',   border: 'border-[#f6653c]/20', dot: 'bg-[#f6653c]' },
  gray:   { bg: 'bg-gray-50',      icon: 'text-gray-400',     val: 'text-gray-600',    border: 'border-gray-100', dot: 'bg-gray-400' },
}

export default function KPICard({ title, value, sub, color = 'blue', icon = 'building' }) {
  const c = colorMap[color] ?? colorMap.blue
  const Icon = icons[icon] ?? Building2

  return (
    <div className={`gl-card border ${c.border} p-4 sm:p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider leading-none">
          {title}
        </span>
        <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon size={15} className={c.icon} />
        </div>
      </div>
      <div>
        <p className={`text-2xl sm:text-3xl font-black ${c.val} leading-none`}>{value}</p>
        {sub && <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 font-medium">{sub}</p>}
      </div>
      {/* Bottom accent bar */}
      <div className={`h-0.5 w-8 rounded-full ${c.dot} opacity-60`} />
    </div>
  )
}
