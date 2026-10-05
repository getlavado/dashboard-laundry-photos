// Días de retraso = días calendario desde `dueFrom` (el recojo, o la creación
// de la orden si se cargó tarde — lo calcula el server) hasta hoy. Una orden
// solo figura como pendiente si esa fecha es anterior a hoy: el mínimo es 1.
export function delayDays(iso) {
  if (!iso) return 0
  const d = new Date(iso)
  const pickup = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today - pickup) / 86400000)
}

// 1 día = recién vencida · 2 días = preocupante · 3+ días = grave
export function delayLevel(days) {
  return days >= 3 ? 'grave' : days === 2 ? 'medio' : 'leve'
}
