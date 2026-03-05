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

// ─── Firebase Init ───────────────────────────────────────────────────────────
let rawKey = process.env.SERVER_FIREBASE_SERVICE_ACCOUNT_KEY || ''
// Strip surrounding single-quotes if present (shell-style quoting)
if (rawKey.startsWith("'") && rawKey.endsWith("'")) {
  rawKey = rawKey.slice(1, -1)
}
const serviceAccount = JSON.parse(rawKey)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.SERVER_FIREBASE_DATABASE_URL,
})

const db = admin.firestore()

// ─── Constants ───────────────────────────────────────────────────────────────
const ORDERS_COLLECTION =
  'glLaundries/PE/states/KE5K5W3HreHRVdVAbVlH/cities/JZ0HzixP6iysCfUz7zoF/orders'

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
 * GET /api/explore
 * Returns 5 sample documents so you can inspect the real field names.
 */
app.get('/api/explore', async (req, res) => {
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
 * GET /api/stats?days=7
 * Main dashboard endpoint. Returns summary KPIs, daily trend and per-provider table.
 */
app.get('/api/stats', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90)
    const cacheKey = `stats_${days}`
    const cached = cacheGet(cacheKey)
    if (cached) return res.json(cached)

    // Always start from Jan 1 2026 at minimum (user request)
    const year2026Start = new Date('2026-01-01T00:00:00.000Z')
    const rollingStart = new Date()
    rollingStart.setDate(rollingStart.getDate() - days)
    rollingStart.setHours(0, 0, 0, 0)
    const start = rollingStart > year2026Start ? rollingStart : year2026Start

    // Fetch orders for the date range (2026 only)
    let query = db.collection(ORDERS_COLLECTION)
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))

    const snap = await query.get()

    // Resolve guía field if still unknown
    if (!resolvedGuiaField && snap.docs.length > 0) {
      resolvedGuiaField = detectGuiaField(snap.docs[0].data())
    }
    const guiaField = resolvedGuiaField || 'guiaUrl'

    // Filter only B2B orders (some might not have the flag)
    const orders = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(o => o.isB2B === true || o.isB2B === undefined) // include all if field missing

    // ── Aggregate ────────────────────────────────────────────────────────────
    const byDate = {}     // { 'YYYY-MM-DD': { total, withGuia, laundries: Set } }
    const byLaundry = {}  // { laundryId: { name, total, withGuia, byDate } }

    for (const order of orders) {
      const d = toDate(order.createdAt)
      if (!d) continue
      const dateKey = formatDate(d)
      const lid = order.assignmentData?.laundryId || 'sin-asignar'
      const lname = order.assignmentData?.laundryName || 'Sin asignar'
      const hasGuia = hasGuiaValue(order[guiaField])

      // By date
      if (!byDate[dateKey]) byDate[dateKey] = { total: 0, withGuia: 0, laundries: new Set() }
      byDate[dateKey].total++
      if (hasGuia) byDate[dateKey].withGuia++
      byDate[dateKey].laundries.add(lid)

      // By laundry
      if (!byLaundry[lid]) byLaundry[lid] = { id: lid, name: lname, total: 0, withGuia: 0, byDate: {} }
      byLaundry[lid].total++
      if (hasGuia) byLaundry[lid].withGuia++
      if (!byLaundry[lid].byDate[dateKey]) byLaundry[lid].byDate[dateKey] = { total: 0, withGuia: 0 }
      byLaundry[lid].byDate[dateKey].total++
      if (hasGuia) byLaundry[lid].byDate[dateKey].withGuia++
    }

    // ── Daily trend (last N days) ─────────────────────────────────────────────
    const dailyStats = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const key = formatDate(d)
      const entry = byDate[key] || { total: 0, withGuia: 0, laundries: new Set() }
      dailyStats.push({
        date: key,
        label: d.toLocaleDateString('es-PE', { weekday: 'short', month: 'short', day: 'numeric' }),
        total: entry.total,
        withGuia: entry.withGuia,
        sinGuia: entry.total - entry.withGuia,
        complianceRate: entry.total > 0 ? Math.round((entry.withGuia / entry.total) * 100) : 0,
        activeProviders: entry.laundries.size,
      })
    }

    // ── Per-provider table ────────────────────────────────────────────────────
    const today = formatDate(new Date())
    const providers = Object.values(byLaundry).map(l => {
      const t = l.byDate[today] || { total: 0, withGuia: 0 }
      const weeklyDays = dailyStats.filter(d => l.byDate[d.date])
      const weeklyAvg = weeklyDays.length > 0
        ? Math.round(weeklyDays.reduce((sum, d) => {
            const ld = l.byDate[d.date] || { total: 0, withGuia: 0 }
            return sum + (ld.total > 0 ? (ld.withGuia / ld.total) * 100 : 0)
          }, 0) / weeklyDays.length)
        : 0

      const status =
        t.total === 0 ? 'sin-ordenes'
        : t.withGuia === t.total ? 'al-dia'
        : t.withGuia > 0 ? 'parcial'
        : 'pendiente'

      return {
        id: l.id,
        name: l.name,
        todayOrders: t.total,
        todayWithGuia: t.withGuia,
        todayCompliance: t.total > 0 ? Math.round((t.withGuia / t.total) * 100) : 0,
        weeklyCompliance: weeklyAvg,
        totalOrders: l.total,
        totalWithGuia: l.withGuia,
        status,
      }
    }).sort((a, b) => {
      const order = { 'pendiente': 0, 'parcial': 1, 'al-dia': 2, 'sin-ordenes': 3 }
      return (order[a.status] ?? 4) - (order[b.status] ?? 4)
    })

    // ── Summary ───────────────────────────────────────────────────────────────
    const todayEntry = byDate[today] || { total: 0, withGuia: 0, laundries: new Set() }
    const allWithGuia = orders.filter(o => hasGuiaValue(o[guiaField])).length

    // ── Pending orders (no guía) ──────────────────────────────────────────────
    const pendingOrders = orders
      .filter(o => !hasGuiaValue(o[guiaField]))
      .map(o => ({
        id: o.id,
        laundryName: o.assignmentData?.laundryName || 'Sin asignar',
        laundryId: o.assignmentData?.laundryId || null,
        createdAt: toDate(o.createdAt)?.toISOString() || null,
        status: o.status || null,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    const result = {
      guiaField,
      summary: {
        today: {
          date: today,
          totalOrders: todayEntry.total,
          ordersWithGuia: todayEntry.withGuia,
          ordersWithout: todayEntry.total - todayEntry.withGuia,
          complianceRate: todayEntry.total > 0
            ? Math.round((todayEntry.withGuia / todayEntry.total) * 100) : 0,
          activeProviders: todayEntry.laundries.size,
          compliantProviders: providers.filter(p => p.status === 'al-dia').length,
          pendingProviders: providers.filter(p => p.status === 'pendiente' || p.status === 'parcial').length,
        },
        period: {
          days,
          totalOrders: orders.length,
          totalWithGuia: allWithGuia,
          avgComplianceRate: dailyStats.length > 0
            ? Math.round(dailyStats.reduce((s, d) => s + d.complianceRate, 0) / dailyStats.length) : 0,
          totalProviders: providers.length,
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
