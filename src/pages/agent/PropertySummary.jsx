import { useState, useEffect } from 'react'

const SHEET_ID = '15jecJzOZm_TG6w9Le4gLysJzQy9NLAWhEDzgR7sLhME'
const RANGE = encodeURIComponent("creation data dump!T:X")

const POINT4_ASSIGNEES = [
  'Jerry', 'Arshiya', 'Sayali', 'Nikhil M', 'Disha', 'Munjal',
  'Shubhi', 'Vamika', 'Shagun', 'Simran Saswani', 'Vihaan',
]

function getYesterday() {
  const now = new Date()
  const yesterday = new Date(now)
  if (now.getDay() === 1) {
    yesterday.setDate(yesterday.getDate() - 3)
  } else {
    yesterday.setDate(yesterday.getDate() - 1)
  }
  return yesterday
}

function formatDateDisplay(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function parseCellDate(val) {
  if (!val) return null
  const s = String(val).trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]))
  return null
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function computeSummary(rows) {
  const yesterdayDate = getYesterday()
  const yesterdayDisplay = formatDateDisplay(yesterdayDate)

  let point1 = 0, point2 = 0, point3 = 0, point4 = 0, point5 = 0

  for (const row of rows) {
    const colT = (row[0] || '').trim()
    const colUDate = parseCellDate(row[1])
    const colX = (row[4] || '').trim()

    const isYesterday = colUDate && isSameDay(colUDate, yesterdayDate)
    const hasAnyDate = colUDate !== null

    if (isYesterday && ['Activation on hold (Confirmed by KAM)', 'Complete Info yet to be received from the KAM', 'Created- Live/ Incomplete Info'].includes(colT)) {
      point1++
    }

    if (isYesterday && colT === 'Created- Live/ Incomplete Info') {
      point2++
    }

    if (['Property Creation WIP', 'Not Started'].includes(colT)) {
      point3++
    }

    if (hasAnyDate && colT === 'Property Creation WIP' && POINT4_ASSIGNEES.includes(colX)) {
      point4++
    }

    if (hasAnyDate && colT === 'Complete Info yet to be received from the KAM') {
      point5++
    }
  }

  return { yesterday: yesterdayDisplay, point1, point2, point3, point4, point5 }
}

export default function PropertySummary() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchSummary() {
    setLoading(true)
    setError('')
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY
      if (!apiKey) throw new Error('Google Sheets API key not configured')

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${apiKey}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json()

      if (!json.values || json.values.length < 2) {
        setData({ yesterday: formatDateDisplay(getYesterday()), point1: 0, point2: 0, point3: 0, point4: 0, point5: 0 })
        setLoading(false)
        return
      }

      setData(computeSummary(json.values))
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  useEffect(() => { fetchSummary() }, [])

  const points = data ? [
    { label: `Number of properties created yesterday (${data.yesterday})`, value: data.point1 },
    { label: `Number of properties activated yesterday (${data.yesterday})`, value: data.point2 },
    { label: 'Number of properties pending on inventory to create', value: data.point3 },
    { label: 'Number of properties pending on KAM to create', value: data.point4 },
    { label: 'Number of properties pending on KAM to send the information', value: data.point5 },
  ] : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Property Summary</h1>
        <p className="text-sm text-text-secondary mt-1">Aggregated from the creation data dump sheet</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="card p-6 text-center">
          <p className="text-red-500 text-sm mb-3">{error}</p>
          <button onClick={fetchSummary} className="btn btn-outline text-sm">Retry</button>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-3">
          {points.map((p, i) => (
            <div key={i} className="card p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
              <span className="text-sm text-slate-800">{p.label}</span>
              <span className="text-xl font-bold text-indigo-600 tabular-nums">{p.value}</span>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <button onClick={fetchSummary} className="btn btn-outline text-xs">Refresh</button>
          </div>
        </div>
      )}
    </div>
  )
}
