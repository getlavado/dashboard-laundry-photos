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
  // Strip surrounding single-quotes if present (shell-style quoting)
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
const BASE_PATH       = 'glLaundries/PE/states/KE5K5W3HreHRVdVAbVlH/cities/JZ0HzixP6iysCfUz7zoF'
const ORDERS_COLLECTION    = `${BASE_PATH}/orders`
const LAUNDRIES_COLLECTION = `${BASE_PATH}/laundries`

// Laundries excluded from the dashboard
const EXCLUDED_LAUNDRY_IDS   = new Set(['qBNRz2giHEVlWZBrWbCy'])
const EXCLUDED_LAUNDRY_NAMES = new Set(['Lavanderia John Doe', 'Lavandería John Doe'])

// Candidate field names for the guía URL (priority order)
const GUIA_CANDIDATES = [
  'laundryInvoices', // confirmed by user
  'laundryPhotos',   // also present in production data
  'guiaUrl', 'guia', 'constanciaUrl', 'constancia',
  'receiptUrl', 'receipt', 'guideUrl', 'guide',
  'serviceReceiptUrl', 'imagenGuia', 'fotoGuia',
  'serviceProof', 'proofUrl', 'voucherUrl',
]

// Check if the guía field has a value (handles string, array, or object)
function hasGuiaValue(val) {
  if (!val) return false
  if (Array.isArray(val)) return val.length > 0
  if (typeof val === 'string') return val.trim().length > 0
  if (typeof val === 'object') return Object.keys(val).length > 0
  return !!val
}

let resolvedGuiaField = process.env.GUIA_FIELD !== 'auto'
  ? process.env.GUIA_FIELD
  : null  // will be resolved on first explore

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
  // Fallback: look for any key that has 'url', 'guia', 'constancia', 'receipt'
  const fallback = keys.find(k =>
    /guia|constancia|receipt|voucher|proof|guide/i.test(k)
  )
  return fallback || null
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Quick diagnostics — confirms env vars are present (no values exposed).
 */
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


/**
 * GET /api/explore
 * Returns 5 sample documents so you can inspect the real field names.
 */
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
          // Show any field that might be the guía
          guiaCandidates: GUIA_CANDIDATES.reduce((acc, f) => {
            if (data[f] !== undefined) acc[f] = data[f]
            return acc
          }, {}),
        },
      }
    })

    // Auto-detect guía field from first doc with data
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
 * GET /api/stats?month=YYYY-MM
 * Main dashboard endpoint. Filters by deliveryDate in the given month (default: current).
 * Only counts orders whose delivery date has already passed (real compliance).
 * Excludes cancelled orders.
 */
app.get('/api/stats', async (req, res) => {
  if (!db) return res.status(500).json({ error: `Firebase not initialized: ${firebaseInitError}` })
  try {
    const now = new Date()

    // Parse month param — default to current month (YYYY-MM)
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthParam = (req.query.month || currentMonthStr).slice(0, 7)
    const [yearStr, monthStr] = monthParam.split('-')
    const year  = parseInt(yearStr)
    const month = parseInt(monthStr) // 1-based

    const cacheKey = `stats_${monthParam}`
    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    // ── Date range ────────────────────────────────────────────────────────────
    // Start: first day of selected month at 00:00
    const firstOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0)
    // End: last day of month at 23:59, but cap at "now" for current month
    const lastOfMonth  = new Date(year, month, 0, 23, 59, 59, 999)
    const isCurrentMonth = monthParam === currentMonthStr
    const queryEnd = isCurrentMonth ? now : lastOfMonth

    // Query by deliveryDate — only orders that should already have a guía
    const snap = await db.collection(ORDERS_COLLECTION)
      .where('deliveryDate', '>=', admin.firestore.Timestamp.fromDate(firstOfMonth))
      .where('deliveryDate', '<=', admin.firestore.Timestamp.fromDate(queryEnd))
      .get()

    // Resolve guía field if still unknown
    if (!resolvedGuiaField && snap.docs.length > 0) {
      resolvedGuiaField = detectGuiaField(snap.docs[0].data())
    }
    const guiaField = resolvedGuiaField || 'guiaUrl'

    // Filter: B2B only + exclude cancelled orders
    const orders = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(o => {
        const status = (o.status || '').toLowerCase()
        if (status.includes('cancel')) return false
        return o.isB2B === true || o.isB2B === undefined
      })

    // ── Aggregate by deliveryDate ─────────────────────────────────────────────
    const byDate    = {}  // { 'YYYY-MM-DD': { total, withGuia, laundries: Set } }
    const byLaundry = {}  // { laundryId: { name, total, withGuia, byDate } }

    for (const order of orders) {
      const d = toDate(order.deliveryDate)   // ← deliveryDate, not createdAt
      if (!d) continue
      const dateKey = formatDate(d)
      const lid   = order.assignmentData?.laundryId   || 'sin-asignar'
      const lname = order.assignmentData?.laundryName || 'Sin asignar'
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

    // ── Daily trend: every day of selected month up to queryEnd ──────────────
    const dailyStats = []
    const cursor = new Date(firstOfMonth)
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
    const today = formatDate(now)
    const providers = Object.values(byLaundry).map(l => {
      const t = l.byDate[today] || { total: 0, withGuia: 0 }

      // Monthly compliance average (across all days with activity)
      const activeDays = dailyStats.filter(d => l.byDate[d.date])
      const monthlyAvg = activeDays.length > 0
        ? Math.round(activeDays.reduce((sum, d) => {
            const ld = l.byDate[d.date] || { total: 0, withGuia: 0 }
            return sum + (ld.total > 0 ? (ld.withGuia / ld.total) * 100 : 0)
          }, 0) / activeDays.length)
        : 0

      // Today's status based on deliveries due today
      const status =
        t.total === 0    ? 'sin-ordenes'
        : t.withGuia === t.total ? 'al-dia'
        : t.withGuia > 0         ? 'parcial'
        : 'pendiente'

      return {
        id:             l.id,
        name:           l.name,
        todayOrders:    t.total,
        todayWithGuia:  t.withGuia,
        todayCompliance: t.total > 0 ? Math.round((t.withGuia / t.total) * 100) : 0,
        weeklyCompliance: monthlyAvg,   // field name kept for frontend compat
        totalOrders:    l.total,
        totalWithGuia:  l.withGuia,
        status,
      }
    }).filter(p =>
      !EXCLUDED_LAUNDRY_IDS.has(p.id) && !EXCLUDED_LAUNDRY_NAMES.has(p.name)
    ).sort((a, b) => {
      const order = { 'pendiente': 0, 'parcial': 1, 'al-dia': 2, 'sin-ordenes': 3 }
      return (order[a.status] ?? 4) - (order[b.status] ?? 4)
    })

    // ── Summary ───────────────────────────────────────────────────────────────
    const todayEntry = byDate[today] || { total: 0, withGuia: 0, laundries: new Set() }
    const allWithGuia = orders.filter(o => hasGuiaValue(o[guiaField])).length

    // ── Pending orders (no guía, sorted by oldest delivery first) ────────────
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

    // ── Insight helpers ───────────────────────────────────────────────────────
    const daysInMonth   = new Date(year, month, 0).getDate()
    const dayOfMonth    = isCurrentMonth ? new Date().getDate() : daysInMonth
    const totalWithout  = orders.length - allWithGuia
    const overallRate   = orders.length > 0 ? Math.round((allWithGuia / orders.length) * 100) : 0

    // Projected compliance at month-end if pace stays constant
    const projectedCompliance = (dayOfMonth > 0 && daysInMonth > 0)
      ? Math.min(100, Math.round(overallRate)) // already full-month if past
      : overallRate

    // Worst provider by monthly compliance (with orders, non-perfect)
    const activeProviders = providers.filter(p => p.totalOrders > 0)
    const worstProvider   = activeProviders
      .filter(p => p.totalOrders >= 3) // ignore micro-providers
      .sort((a, b) => a.weeklyCompliance - b.weeklyCompliance)[0] || null
    const bestProvider    = activeProviders
      .sort((a, b) => b.weeklyCompliance - a.weeklyCompliance)[0] || null

    // Daily average guías uploaded so far
    const activeDaysSoFar = dailyStats.filter(d => d.total > 0).length
    const avgGuiasPerDay  = activeDaysSoFar > 0
      ? Math.round(allWithGuia / activeDaysSoFar) : 0

    // Trend: compare last 3 days vs 3 days before that
    const recentDays = dailyStats.slice(-6)
    const last3  = recentDays.slice(-3)
    const prev3  = recentDays.slice(0, 3)
    const last3Avg = last3.filter(d=>d.total>0).reduce((s,d)=>s+d.complianceRate,0) / (last3.filter(d=>d.total>0).length || 1)
    const prev3Avg = prev3.filter(d=>d.total>0).reduce((s,d)=>s+d.complianceRate,0) / (prev3.filter(d=>d.total>0).length || 1)
    const trend = last3Avg > prev3Avg + 5 ? 'up' : last3Avg < prev3Avg - 5 ? 'down' : 'flat'

    const result = {
      guiaField,
      month: monthParam,
      isCurrentMonth,
      summary: {
        today: {
          date: today,
          totalOrders: todayEntry.total,
          ordersWithGuia: todayEntry.withGuia,
          ordersWithout: todayEntry.total - todayEntry.withGuia,
          complianceRate: todayEntry.total > 0
            ? Math.round((todayEntry.withGuia / todayEntry.total) * 100) : 0,
          activeProviders: todayEntry.laundries instanceof Set ? todayEntry.laundries.size : 0,
          compliantProviders: providers.filter(p => p.status === 'al-dia').length,
          pendingProviders: providers.filter(p => p.status === 'pendiente' || p.status === 'parcial').length,
        },
        period: {
          month: monthParam,
          totalOrders: orders.length,
          totalWithGuia: allWithGuia,
          totalWithout,
          overallRate,
          avgComplianceRate: dailyStats.length > 0
            ? Math.round(dailyStats.reduce((s, d) => s + d.complianceRate, 0) / dailyStats.length) : 0,
          totalProviders: providers.length,
          daysInMonth,
          dayOfMonth,
          projectedCompliance,
          avgGuiasPerDay,
          trend,
          worstProvider: worstProvider ? { name: worstProvider.name, compliance: worstProvider.weeklyCompliance, pending: worstProvider.totalOrders - worstProvider.totalWithGuia } : null,
          bestProvider:  bestProvider  ? { name: bestProvider.name,  compliance: bestProvider.weeklyCompliance  } : null,
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

// ─── Export for Vercel serverless / local start ───────────────────────────────
module.exports = app

if (require.main === module) {
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => {
    console.log(`✓ API server running on http://localhost:${PORT}`)
    console.log(`  → /api/stats   – dashboard data`)
    console.log(`  → /api/explore – inspect Firestore document fields`)
  })
}
