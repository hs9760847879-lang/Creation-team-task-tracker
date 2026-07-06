import { useState, useEffect } from 'react'

export default function PropertySummary() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchSummary() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/property-summary')
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `API error: ${res.status}`)
      }
      const json = await res.json()
      setData(json)
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
