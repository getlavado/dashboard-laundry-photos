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
const ORDERS_COLLECTION    = `${BASE_PATH}/orders`
const LAUNDRIES_COLLECTION = `${BASE_PATH}/laundries`

const EXCLUDED_LAUNDRY_IDS   = new Set(['qBNRz2giHEVlWZBrWbCy'])
const EXCLUDED_LAUNDRY_NAMES = new Set(['Lavanderia John Doe', 'Lavandería John Doe'])

const GUIA_CANDIDATES = [
  'laundryInvoices',
  'laundryPhotos',
  'guiaUrl', 'guia', 'constanciaUrl', 'constancia',
  'receiptUrl', 'receipt', 'guideUrl', 'guide',
  'serviceReceiptUrl', 'imagenGuia', 'fotoGuia',
  'serviceProof', 'proofUrl', 'voucherUrl',
]

function hasGuiaValue(val) {
  if (!val) return false
  if (Array.isArray(val)) return val.length > 0
  if (typeof val === 'string') return val.trim().length > 0
  if (typeof val === 'object') return Object.keys(val).length > 0
  return !!val
}

let resolvedGuiaField = process.env.GUIA_FIELD !== 'auto'
  ? process.env.GUIA_FIELD
  : null

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

function detectGuiaField(sampleDoc) {
  const keys = Object.keys(sampleDoc)
  for (const candidate of GUIA_CANDIDATES) {
    if (keys.includes(candidate)) return candidate
  }
  const fallback = keys.find(k =>
    /guia|constancia|receipt|voucher|proof|guide/i.test(k)
  )
  return fallback || null
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
          status: data.status,
          isB2B: data.isB2B,
          laundryName: data.assignmentData?.laundryName,
          createdAt: toDate(data.createdAt)?.toISOString(),
          guiaCandidates: GUIA_CANDIDATES.reduce((acc, f) => {
            if (data[f] !== undefined) acc[f] = data[f]
            return acc
          }, {}),
        },
      }
    })

    if (!resolvedGuiaField && snap.docs.length > 0) {
      resolvedGuiaField = detectGuiaField(snap.docs[0].data())
    }

    res.json({ guiaField: resolvedGuiaField, candidates: GUIA_CANDIDATES, docs })
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

    if (!resolvedGuiaField && snap.docs.length > 0) {
      resolvedGuiaField = detectGuiaField(snap.docs[0].data())
    }
    const guiaField = resolvedGuiaField || 'guiaUrl'

    const orders = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(o => {
        const status = (o.status || '').toLowerCase()
        if (status.includes('cancel')) return false
        return o.isB2B === true || o.isB2B === undefined
      })

    // ── Aggregate ─────────────────────────────────────────────────────────────
    const byDate    = {}
    const byLaundry = {}

    for (const order of orders) {
      const d = toDate(order.deliveryDate)
      if (!d) continue
      const dateKey = formatDate(d)
      const lid     = order.assignmentData?.laundryId   || 'sin-asignar'
      const lname   = order.assignmentData?.laundryName || 'Sin asignar'
      const hasGuia = hasGuiaValue(order[guiaField])

      if (!byDate[dateKey]) byDate[dateKey] = { total: 0, withGuia: 0, laundries: new Set() }
      byDate[dateKey].total++
      if (hasGuia) byDate[dateKey].withGuia++
      byDate[dateKey].laundries.add(lid)

      if (!byLaundry[lid]) byLaundry[lid] = { id: lid, name: lname, total: 0, withGuia: 0, byDate: {} }
      byLaundry[lid].total++
      if (hasGuia) byLaundry[lid].withGuia++
      if (!byLaundry[lid].byDate[dateKey]) byLaundry[lid].byDate[dateKey] = { total: 0, withGuia: 0 }
      byLaundry[lid].byDate[dateKey].total++
      if (hasGuia) byLaundry[lid].byDate[dateKey].withGuia++
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
    const todayEntry  = byDate[today] || { total: 0, withGuia: 0, laundries: new Set() }
    const allWithGuia = orders.filter(o => hasGuiaValue(o[guiaField])).length
    const totalWithout = orders.length - allWithGuia
    const overallRate  = orders.length > 0 ? Math.round((allWithGuia / orders.length) * 100) : 0

    // ── Pending orders ────────────────────────────────────────────────────────
    const pendingOrders = orders
      .filter(o => {
        if (hasGuiaValue(o[guiaField])) return false
        const lid   = o.assignmentData?.laundryId   || null
        const lname = o.assignmentData?.laundryName || ''
        if (lid   && EXCLUDED_LAUNDRY_IDS.has(lid))     return false
        if (lname && EXCLUDED_LAUNDRY_NAMES.has(lname)) return false
        return true
      })
      .map(o => ({
        id:           o.id,
        laundryName:  o.assignmentData?.laundryName || 'Sin asignar',
        laundryId:    o.assignmentData?.laundryId   || null,
        deliveryDate: toDate(o.deliveryDate)?.toISOString() || null,
        createdAt:    toDate(o.createdAt)?.toISOString()    || null,
        status:       o.status || null,
      }))
      .sort((a, b) => new Date(a.deliveryDate || 0) - new Date(b.deliveryDate || 0))

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
      ? Math.round(allWithGuia / activeDaysSoFar) : 0

    const recentDays = dailyStats.slice(-6)
    const last3  = recentDays.slice(-3)
    const prev3  = recentDays.slice(0, 3)
    const last3Avg = last3.filter(d => d.total > 0).reduce((s, d) => s + d.complianceRate, 0) / (last3.filter(d => d.total > 0).length || 1)
    const prev3Avg = prev3.filter(d => d.total > 0).reduce((s, d) => s + d.complianceRate, 0) / (prev3.filter(d => d.total > 0).length || 1)
    const trend = last3Avg > prev3Avg + 5 ? 'up' : last3Avg < prev3Avg - 5 ? 'down' : 'flat'

    const result = {
      guiaField,
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
          totalWithGuia:       allWithGuia,
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
