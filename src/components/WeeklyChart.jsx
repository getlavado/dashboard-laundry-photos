import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const GL_BLUE   = '#0890f1'
const GL_ORANGE = '#f6653c'
const GL_GREEN  = '#10b981'
const GL_RED_LIGHT = '#fca5a5'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-3 text-xs font-medium">
      <p className="font-bold text-gray-700 mb-2 text-[11px]">{label}</p>
      <p className="text-emerald-600">✓ Con guía: <strong>{d?.withGuia}</strong></p>
      <p style={{ color: GL_ORANGE }}>✗ Sin guía: <strong>{d?.sinGuia}</strong></p>
      <div className="mt-2 pt-2 border-t border-gray-100">
        <p style={{ color: GL_BLUE }} className="font-bold">
          {d?.complianceRate}% cumplimiento
        </p>
      </div>
    </div>
  )
}

export default function WeeklyChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 sm:h-56 flex items-center justify-center text-gray-300 text-sm font-medium">
        Sin datos en este período
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Montserrat' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Montserrat' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Montserrat' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 12, fontFamily: 'Montserrat' }}
          iconType="circle"
          iconSize={8}
        />
        <Bar yAxisId="left" dataKey="withGuia" name="Con guía" fill={GL_GREEN} radius={[4,4,0,0]} maxBarSize={28} />
        <Bar yAxisId="left" dataKey="sinGuia"  name="Sin guía" fill={GL_RED_LIGHT} radius={[4,4,0,0]} maxBarSize={28} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="complianceRate"
          name="% Cumplimiento"
          stroke={GL_BLUE}
          strokeWidth={2.5}
          dot={{ r: 3, fill: GL_BLUE, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: GL_BLUE }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
