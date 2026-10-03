require('dotenv').config()
const express = require('express')
const cors = require('cors')
const admin = require('firebase-admin')

const app = express()
app.use(cors())
app.use(express.json())

// ─── Simple in-memory cache (5 min TTL) ─────────────────────────────────────
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000
function cacheGet(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null }
  return entry.data
}
function cacheSet(key, data) { cache.set(key, { data, ts: Date.now() }) }

// ─── Firebase Init (lazy, with error capture) ────────────────────────────────
let db = null
let firebaseInitError = null

try {
  let rawKey = process.env.SERVER_FIREBASE_SERVICE_ACCOUNT_KEY || ''
  if (rawKey.startsWith("'") && rawKey.endsWith("'")) {
    rawKey = rawKey.slice(1, -1)
  }
  if (!rawKey) throw new Error('SERVER_FIREBASE_SERVICE_ACCOUNT_KEY is not set')
  const serviceAccount = JSON.parse(rawKey)

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.SERVER_FIREBASE_DATABASE_URL,
    })
  }
  db = admin.firestore()
} catch (err) {
  firebaseInitError = err.message
  console.error('[firebase-init]', err.message)
}

// ─── Constants ───────────────────────────────────────────────────────────────
const BASE_PATH            = 'glLaundries/PE/states/KE5K5W3HreHRVdVAbVlH/cities/JZ0HzixP6iysCfUz7zoF'
const ORDERS_COLLECTION      = `${BASE_PATH}/orders`
const LAUNDRIES_COLLECTION   = 'laundries'
const B2B_PARTNERS_COLLECTION = 'b2bPartners'

const EXCLUDED_LAUNDRY_IDS   = new Set(['qBNRz2giHEVlWZBrWbCy'])
const EXCLUDED_LAUNDRY_NAMES = new Set(['Lavanderia John Doe', 'Lavandería John Doe'])

// Cada orden puede acumular comprobantes en este array: el primero es la guía
// de recojo, el segundo (si se sube) la de entrega.
const GUIA_FIELD = 'laundryInvoices'

// Solo se contabiliza la GUÍA DE RECOJO para el cumplimiento, no la de entrega.
// Las lavanderías suben normalmente una sola guía ya con ambas firmas, por lo
// que exigir una segunda guía de entrega marcaba casi todo como pendiente y
// ocultaba la información real. Poner en `true` para volver a exigir ambas
// (modo "separar recojo / entrega").
const COUNT_DELIVERY_GUIDE = false

// En minúsculas porque siempre se compara contra status.toLowerCase() — cualquier
// entrada aquí con una mayúscula (ej. 'pickedUp') nunca haría match y excluiría
// en silencio todas las órdenes con ese status.
const VALID_ORDER_STATUSES = new Set(
  ['pending', 'processing', 'pickedup', 'delivered'].map(s => s.toLowerCase())
)

function invoiceCount(order) {
  const val = order[GUIA_FIELD]
  return Array.isArray(val) ? val.length : 0
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function toDate(val) {
  if (!val) return null
  if (val.toDate) return val.toDate()
  if (val instanceof Date) return val
  return new Date(val)
}

// referenceDay = "hoy" para efectos de esta orden: el día real (período actual)
// o el último día del período que se está consultando (períodos pasados).
function guiaStatus(order, referenceDay) {
  const count    = invoiceCount(order)
  const pickup   = toDate(order.pickUpTime)
  const delivery = toDate(order.deliveryDate)

  const missingPickup   = !!pickup   && formatDate(pickup)   < referenceDay && count < 1
  const missingDelivery = COUNT_DELIVERY_GUIDE
    && !!delivery && formatDate(delivery) < referenceDay && count < 2

  return { missingPickup, missingDelivery, isCompliant: !missingPickup && !missingDelivery }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    ok: !firebaseInitError,
    firebaseError: firebaseInitError || null,
    env: {
      FIREBASE_KEY: !!process.env.SERVER_FIREBASE_SERVICE_ACCOUNT_KEY,
      FIREBASE_URL: !!process.env.SERVER_FIREBASE_DATABASE_URL,
      GUIA_FIELD:   process.env.GUIA_FIELD || '(not set)',
    },
    node: process.version,
  })
})

app.get('/api/explore', async (req, res) => {
  if (!db) return res.status(500).json({ error: `Firebase not initialized: ${firebaseInitError}` })
  try {
    const snap = await db.collection(ORDERS_COLLECTION).limit(5).get()
    const docs = snap.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        fieldNames: Object.keys(data),
        sample: {
          status:       data.status,
          isB2B:        data.isB2B,
          laundryName:  data.assignmentData?.laundryName,
          createdAt:    toDate(data.createdAt)?.toISOString(),
          pickUpTime:   toDate(data.pickUpTime)?.toISOString()   || null,
          deliveryDate: toDate(data.deliveryDate)?.toISOString() || null,
          invoiceCount: invoiceCount(data),
        },
      }
    })

    res.json({ guiaField: GUIA_FIELD, docs })
  } catch (err) {
    console.error('[explore]', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/stats?month=YYYY-MM          — month mode (default)
 * GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD — week/custom range mode
 */
app.get('/api/stats', async (req, res) => {
  if (!db) return res.status(500).json({ error: `Firebase not initialized: ${firebaseInitError}` })
  try {
    const now     = new Date()
    const todayStr = formatDate(now)

    // ── Resolve period ────────────────────────────────────────────────────────
    let firstOfPeriod, lastOfPeriod, isCurrentPeriod, cacheKey
    let daysInPeriod, dayOfPeriod, mode, periodId

    if (req.query.from && req.query.to) {
      // Week / custom range mode
      mode          = 'week'
      firstOfPeriod = new Date(req.query.from + 'T00:00:00.000')
      lastOfPeriod  = new Date(req.query.to   + 'T23:59:59.999')
      isCurrentPeriod = req.query.to >= todayStr
      cacheKey      = `stats_${req.query.from}_${req.query.to}`
      periodId      = `${req.query.from}:${req.query.to}`
      daysInPeriod  = 7

      if (isCurrentPeriod) {
        const msElapsed = Math.max(0, now - firstOfPeriod)
        dayOfPeriod = Math.min(7, Math.floor(msElapsed / (1000 * 60 * 60 * 24)) + 1)
      } else {
        dayOfPeriod = 7
      }
    } else {
      // Month mode
      mode = 'month'
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const monthParam = (req.query.month || currentMonthStr).slice(0, 7)
      const [yearStr, monthStr] = monthParam.split('-')
      const year  = parseInt(yearStr)
      const month = parseInt(monthStr)

      firstOfPeriod   = new Date(year, month - 1, 1, 0, 0, 0, 0)
      lastOfPeriod    = new Date(year, month, 0, 23, 59, 59, 999)
      isCurrentPeriod = monthParam === currentMonthStr
      cacheKey        = `stats_${monthParam}`
      periodId        = monthParam
      daysInPeriod    = new Date(year, month, 0).getDate()
      dayOfPeriod     = isCurrentPeriod ? now.getDate() : daysInPeriod
    }

    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const queryEnd = isCurrentPeriod ? now : lastOfPeriod

    // ── Firestore query ───────────────────────────────────────────────────────
    const snap = await db.collection(ORDERS_COLLECTION)
      .where('deliveryDate', '>=', admin.firestore.Timestamp.fromDate(firstOfPeriod))
      .where('deliveryDate', '<=', admin.firestore.Timestamp.fromDate(queryEnd))
      .get()

    // "hoy" para el cálculo de guías faltantes: si es el período en curso, el
    // momento real actual; si es un período pasado, su último día.
    const referenceDay = formatDate(queryEnd)

    const validOrderFilter = o => {
      const status = (o.status || '').toLowerCase()
      if (!VALID_ORDER_STATUSES.has(status)) return false
      return o.isB2B === true || o.isB2B === undefined
    }

    const orders = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(validOrderFilter)

    // Segundo query, por pickUpTime dentro del mismo período: Firestore solo
    // permite filtros de rango sobre un único campo, así que una orden cuyo
    // recojo cae en el período pero cuya entrega está programada para un
    // período posterior no aparece en `snap` (filtrado por deliveryDate) y su
    // guía de recojo vencida quedaría invisible. `candidateOrders` une ambos
    // queries (deduplicado por id) solo para armar `pendingOrders` — los
    // agregados de cumplimiento (byDate/byLaundry) siguen usando `orders`.
    const pickupSnap = await db.collection(ORDERS_COLLECTION)
      .where('pickUpTime', '>=', admin.firestore.Timestamp.fromDate(firstOfPeriod))
      .where('pickUpTime', '<=', admin.firestore.Timestamp.fromDate(queryEnd))
      .get()

    const candidateOrdersById = new Map(orders.map(o => [o.id, o]))
    for (const doc of pickupSnap.docs) {
      if (candidateOrdersById.has(doc.id)) continue
      const o = { id: doc.id, ...doc.data() }
      if (validOrderFilter(o)) candidateOrdersById.set(doc.id, o)
    }
    const candidateOrders = [...candidateOrdersById.values()]

    // ── Collect unique laundry IDs from orders ────────────────────────────────
    // Se usa candidateOrders (no solo orders) para que las órdenes que solo
    // vinieron del query por pickUpTime también resuelvan su shortCode.
    const uniqueLaundryIds = [...new Set(
      candidateOrders.map(o => o.assignmentData?.laundryId).filter(Boolean)
    )]

    // ── Fetch each laundry doc by ID and build shortCode lookup ───────────────
    const cachedNames = cacheGet('laundries')
    let laundryShortNames = cachedNames || {}

    if (!cachedNames) {
      const fetches = await Promise.all(
        uniqueLaundryIds.map(id => db.collection(LAUNDRIES_COLLECTION).doc(id).get())
      )
      for (const doc of fetches) {
        if (doc.exists) {
          const d = doc.data()
          laundryShortNames[doc.id] = d.shortCode || d.name || null
        }
      }
      cacheSet('laundries', laundryShortNames)
    }

    // ── Collect unique b2bPartner IDs and fetch names ─────────────────────────
    const uniqueB2BIds = [...new Set(
      candidateOrders.map(o => o.b2bPartner?.id).filter(Boolean)
    )]

    const cachedB2BNames = cacheGet('b2bPartners')
    let b2bPartnerNames = cachedB2BNames || {}

    if (!cachedB2BNames && uniqueB2BIds.length > 0) {
      const b2bFetches = await Promise.all(
        uniqueB2BIds.map(id => db.collection(B2B_PARTNERS_COLLECTION).doc(id).get())
      )
      for (const doc of b2bFetches) {
        if (doc.exists) {
          b2bPartnerNames[doc.id] = doc.data().name || null
        }
      }
      cacheSet('b2bPartners', b2bPartnerNames)
    }

    // ── Aggregate ─────────────────────────────────────────────────────────────
    const byDate    = {}
    const byLaundry = {}

    for (const order of orders) {
      const d = toDate(order.deliveryDate)
      if (!d) continue
      const dateKey = formatDate(d)
      const lid     = order.assignmentData?.laundryId   || 'sin-asignar'
      const lname   = laundryShortNames[lid] || order.assignmentData?.laundryName || 'Sin asignar'
      const { isCompliant } = guiaStatus(order, referenceDay)

      if (!byDate[dateKey]) byDate[dateKey] = { total: 0, withGuia: 0, laundries: new Set() }
      byDate[dateKey].total++
      if (isCompliant) byDate[dateKey].withGuia++
      byDate[dateKey].laundries.add(lid)

      if (!byLaundry[lid]) byLaundry[lid] = { id: lid, name: lname, total: 0, withGuia: 0, byDate: {} }
      byLaundry[lid].total++
      if (isCompliant) byLaundry[lid].withGuia++
      if (!byLaundry[lid].byDate[dateKey]) byLaundry[lid].byDate[dateKey] = { total: 0, withGuia: 0 }
      byLaundry[lid].byDate[dateKey].total++
      if (isCompliant) byLaundry[lid].byDate[dateKey].withGuia++
    }

    // ── Daily trend ───────────────────────────────────────────────────────────
    const dailyStats = []
    const cursor = new Date(firstOfPeriod)
    while (cursor <= queryEnd) {
      const key   = formatDate(cursor)
      const entry = byDate[key] || { total: 0, withGuia: 0, laundries: new Set() }
      dailyStats.push({
        date:            key,
        label:           new Date(cursor).toLocaleDateString('es-PE', { weekday: 'short', month: 'short', day: 'numeric' }),
        total:           entry.total,
        withGuia:        entry.withGuia,
        sinGuia:         entry.total - entry.withGuia,
        complianceRate:  entry.total > 0 ? Math.round((entry.withGuia / entry.total) * 100) : 0,
        activeProviders: entry.laundries instanceof Set ? entry.laundries.size : 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    // ── Per-provider table ────────────────────────────────────────────────────
    const today = todayStr
    const providers = Object.values(byLaundry).map(l => {
      const t = l.byDate[today] || { total: 0, withGuia: 0 }

      const activeDays = dailyStats.filter(d => l.byDate[d.date])
      const periodAvg  = activeDays.length > 0
        ? Math.round(activeDays.reduce((sum, d) => {
            const ld = l.byDate[d.date] || { total: 0, withGuia: 0 }
            return sum + (ld.total > 0 ? (ld.withGuia / ld.total) * 100 : 0)
          }, 0) / activeDays.length)
        : 0

      // For current period: use today's data for status
      // For past periods: use full-period totals (more useful than always showing 'sin-ordenes')
      const statusRef = isCurrentPeriod ? t : { total: l.total, withGuia: l.withGuia }
      const status =
        statusRef.total === 0        ? 'sin-ordenes'
        : statusRef.withGuia === statusRef.total ? 'al-dia'
        : statusRef.withGuia > 0     ? 'parcial'
        : 'pendiente'

      return {
        id:              l.id,
        name:            l.name,
        todayOrders:     t.total,
        todayWithGuia:   t.withGuia,
        todayCompliance: t.total > 0 ? Math.round((t.withGuia / t.total) * 100) : 0,
        weeklyCompliance: periodAvg,
        totalOrders:     l.total,
        totalWithGuia:   l.withGuia,
        status,
      }
    }).filter(p =>
      !EXCLUDED_LAUNDRY_IDS.has(p.id) && !EXCLUDED_LAUNDRY_NAMES.has(p.name)
    ).sort((a, b) => {
      const order = { 'pendiente': 0, 'parcial': 1, 'al-dia': 2, 'sin-ordenes': 3 }
      return (order[a.status] ?? 4) - (order[b.status] ?? 4)
    })

    // ── Summary ───────────────────────────────────────────────────────────────
    const todayEntry   = byDate[today] || { total: 0, withGuia: 0, laundries: new Set() }
    const allCompliant = orders.filter(o => guiaStatus(o, referenceDay).isCompliant).length
    const totalWithout = orders.length - allCompliant
    const overallRate  = orders.length > 0 ? Math.round((allCompliant / orders.length) * 100) : 0

    // ── Pending orders ────────────────────────────────────────────────────────
    // Una orden puede aparecer hasta dos veces: una por guía de recojo faltante
    // y otra por guía de entrega faltante (son pendientes independientes).
    const pendingOrders = []
    for (const o of candidateOrders) {
      const lid   = o.assignmentData?.laundryId   || null
      const lname = o.assignmentData?.laundryName || ''
      if (lid   && EXCLUDED_LAUNDRY_IDS.has(lid))     continue
      if (lname && EXCLUDED_LAUNDRY_NAMES.has(lname)) continue

      const { missingPickup, missingDelivery } = guiaStatus(o, referenceDay)
      if (!missingPickup && !missingDelivery) continue

      const base = {
        id:              o.id,
        laundryName:     laundryShortNames[o.assignmentData?.laundryId] || o.assignmentData?.laundryName || 'Sin asignar',
        laundryId:       o.assignmentData?.laundryId   || null,
        pickUpTime:      toDate(o.pickUpTime)?.toISOString()    || null,
        deliveryDate:    toDate(o.deliveryDate)?.toISOString() || null,
        createdAt:       toDate(o.createdAt)?.toISOString()    || null,
        status:          o.status || null,
        b2bPartnerName:  b2bPartnerNames[o.b2bPartner?.id] || null,
        b2bPartnerId:    o.b2bPartner?.id || null,
      }
      if (missingPickup)   pendingOrders.push({ ...base, missingType: 'recojo' })
      if (missingDelivery) pendingOrders.push({ ...base, missingType: 'entrega' })
    }
    pendingOrders.sort((a, b) => new Date(a.deliveryDate || 0) - new Date(b.deliveryDate || 0))

    // ── Insights ──────────────────────────────────────────────────────────────
    const projectedCompliance = Math.min(100, Math.round(overallRate))

    const activeProviders = providers.filter(p => p.totalOrders > 0)
    const worstProvider   = activeProviders
      .filter(p => p.totalOrders >= 3)
      .sort((a, b) => a.weeklyCompliance - b.weeklyCompliance)[0] || null
    const bestProvider    = activeProviders
      .sort((a, b) => b.weeklyCompliance - a.weeklyCompliance)[0] || null

    const activeDaysSoFar = dailyStats.filter(d => d.total > 0).length
    const avgGuiasPerDay  = activeDaysSoFar > 0
      ? Math.round(allCompliant / activeDaysSoFar) : 0

    const recentDays = dailyStats.slice(-6)
    const last3  = recentDays.slice(-3)
    const prev3  = recentDays.slice(0, 3)
    const last3Avg = last3.filter(d => d.total > 0).reduce((s, d) => s + d.complianceRate, 0) / (last3.filter(d => d.total > 0).length || 1)
    const prev3Avg = prev3.filter(d => d.total > 0).reduce((s, d) => s + d.complianceRate, 0) / (prev3.filter(d => d.total > 0).length || 1)
    const trend = last3Avg > prev3Avg + 5 ? 'up' : last3Avg < prev3Avg - 5 ? 'down' : 'flat'

    const result = {
      guiaField: GUIA_FIELD,
      mode,
      month:            mode === 'month' ? periodId : null,
      from:             mode === 'week'  ? req.query.from : null,
      to:               mode === 'week'  ? req.query.to   : null,
      isCurrentMonth:   isCurrentPeriod,
      isCurrentPeriod,
      summary: {
        today: {
          date:               today,
          totalOrders:        todayEntry.total,
          ordersWithGuia:     todayEntry.withGuia,
          ordersWithout:      todayEntry.total - todayEntry.withGuia,
          complianceRate:     todayEntry.total > 0
            ? Math.round((todayEntry.withGuia / todayEntry.total) * 100) : 0,
          activeProviders:    todayEntry.laundries instanceof Set ? todayEntry.laundries.size : 0,
          compliantProviders: providers.filter(p => p.status === 'al-dia').length,
          pendingProviders:   providers.filter(p => p.status === 'pendiente' || p.status === 'parcial').length,
        },
        period: {
          month:               periodId,
          mode,
          totalOrders:         orders.length,
          totalWithGuia:       allCompliant,
          totalWithout,
          overallRate,
          avgComplianceRate:   dailyStats.length > 0
            ? Math.round(dailyStats.reduce((s, d) => s + d.complianceRate, 0) / dailyStats.length) : 0,
          totalProviders:      providers.length,
          daysInMonth:         daysInPeriod,
          dayOfMonth:          dayOfPeriod,
          projectedCompliance,
          avgGuiasPerDay,
          trend,
          worstProvider: worstProvider
            ? { name: worstProvider.name, compliance: worstProvider.weeklyCompliance, pending: worstProvider.totalOrders - worstProvider.totalWithGuia }
            : null,
          bestProvider: bestProvider
            ? { name: bestProvider.name, compliance: bestProvider.weeklyCompliance }
            : null,
        },
      },
      dailyStats,
      providers,
      pendingOrders,
    }
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('[stats]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Export ───────────────────────────────────────────────────────────────────
module.exports = app

if (require.main === module) {
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => {
    console.log(`✓ API server running on http://localhost:${PORT}`)
    console.log(`  → /api/stats   – dashboard data`)
    console.log(`  → /api/explore – inspect Firestore document fields`)
  })
}
