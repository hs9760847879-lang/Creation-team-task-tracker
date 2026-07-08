import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Search, AlertTriangle, CheckCircle, XCircle, Database, Users, Ticket } from 'lucide-react'

const TRACKED_TYPES = ['Commission Update', 'Policy Update', 'Property Creation Request']
const CORS_HEADERS = { mode: 'cors' }

export default function Maintenance() {
  const [profiles, setProfiles] = useState([])
  const [fdStats, setFdStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [error, setError] = useState('')
  const [backfillStatus, setBackfillStatus] = useState('')
  const [tickets, setTickets] = useState([])
  const [showTickets, setShowTickets] = useState(false)
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [lookbackDays, setLookbackDays] = useState(7)
  const [backfillDetails, setBackfillDetails] = useState(null)
  const [backfillRunning, setBackfillRunning] = useState(false)

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, role, freshdesk_agent_id')
      .order('name')
    if (data) setProfiles(data)
  }, [])

  const fetchStats = useCallback(async (hours = 24) => {
    setStatsLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/maintenance?hours=${hours}&mode=stats`, CORS_HEADERS)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      setFdStats(data)
    } catch (err) {
      setError(err.message)
    }
    setStatsLoading(false)
  }, [])

  const fetchTickets = useCallback(async (hours = 24) => {
    setTicketsLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/maintenance?hours=${hours}&mode=tickets`, CORS_HEADERS)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      setTickets(data.tickets || [])
      setShowTickets(true)
    } catch (err) {
      setError(err.message)
    }
    setTicketsLoading(false)
  }, [])

  useEffect(() => {
    Promise.all([fetchProfiles(), fetchStats(24)])
      .then(() => setLoading(false))
  }, [fetchProfiles, fetchStats])

  const profileByFdId = {}
  for (const p of profiles) {
    if (p.freshdesk_agent_id) profileByFdId[p.freshdesk_agent_id] = p
  }

  const allResponderIds = fdStats ? Object.keys(fdStats.responderCounts || {}).map(Number) : []
  const allInternalIds = fdStats ? Object.keys(fdStats.internalCounts || {}).map(Number) : []
  const allFdIds = [...new Set([...allResponderIds, ...allInternalIds])].sort((a, b) => a - b)

  const matchedInDb = allFdIds.filter(id => profileByFdId[id])
  const missingInDb = allFdIds.filter(id => !profileByFdId[id])

  async function handleBackfill(agentId) {
    setBackfillRunning(true)
    setBackfillDetails(null)
    setBackfillStatus(`Searching all tickets for agent ${agentId}...`)
    try {
      const res = await fetch('/api/cron-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backfillAgentId: Number(agentId) }),
      })
      const data = await res.json()
      setBackfillDetails(data.details || [])
      const createdCount = data.details?.filter(d => d.created).length || 0
      const skippedCount = (data.details?.length || 0) - createdCount
      setBackfillStatus(`Done: ${createdCount} created, ${skippedCount} skipped (${data.details?.length || 0} total tickets checked)`)
    } catch (err) {
      setBackfillStatus(`Error: ${err.message}`)
    }
    setBackfillRunning(false)
  }

  async function handleClearProcessed() {
    if (!confirm('Are you sure? This will clear all processed ticket records and may cause duplicate imports on next cron run.')) return
    setBackfillStatus('Clearing processed_tickets...')
    const { error: err } = await supabase.from('processed_tickets').delete().neq('id', 0)
    setBackfillStatus(err ? `Error: ${err.message}` : 'Done! processed_tickets cleared.')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-sm text-text-secondary mt-1">Freshdesk integration diagnostics and controls</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchStats(24)} className="btn btn-outline" disabled={statsLoading}>
            <RefreshCw size={16} className={statsLoading ? 'animate-spin' : ''} />
            Refresh Stats
          </button>
          <button onClick={() => { setShowTickets(!showTickets); if (!showTickets && tickets.length === 0) fetchTickets(24) }} className="btn btn-outline" disabled={ticketsLoading}>
            <Ticket size={16} />
            {showTickets ? 'Hide Tickets' : 'Show Tickets'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {backfillStatus && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm flex items-center gap-2">
          <span className="font-medium">{backfillStatus}</span>
          <button onClick={() => setBackfillStatus('')} className="ml-auto text-blue-500 hover:text-blue-700 font-medium">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={18} className="text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Agent FD ID Map</h2>
          </div>
          <div className="space-y-2">
            {profiles.filter(p => p.freshdesk_agent_id).map(p => {
              const hasAsResponder = allResponderIds.includes(p.freshdesk_agent_id)
              const hasAsInternal = allInternalIds.includes(p.freshdesk_agent_id)
              const responderCount = fdStats?.responderCounts[p.freshdesk_agent_id] || 0
              const internalCount = fdStats?.internalCounts[p.freshdesk_agent_id] || 0
              return (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div>
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-text-secondary ml-2">ID: {p.freshdesk_agent_id}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {hasAsResponder ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle size={10} /> R:{responderCount}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        <XCircle size={10} /> No tickets
                      </span>
                    )}
                    {hasAsInternal && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        I:{internalCount}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {profiles.filter(p => !p.freshdesk_agent_id).map(p => (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-text-secondary">
                <span className="text-sm">{p.name}</span>
                <span className="text-xs">No FD ID set</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-600" />
            <h2 className="font-semibold text-slate-900">Missing Agents</h2>
          </div>
          <p className="text-xs text-text-secondary mb-3">
            These Freshdesk agent IDs have tickets assigned but no matching profile in the tracker:
          </p>
          {missingInDb.length === 0 ? (
            <p className="text-sm text-emerald-600">All agents matched!</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {missingInDb.map(id => {
                const respCount = fdStats?.responderCounts[id] || 0
                const intCount = fdStats?.internalCounts[id] || 0
                return (
                  <div key={id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-sm font-mono">ID: {id}</span>
                    <div className="flex gap-2 text-xs">
                      {respCount > 0 && <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Responder: {respCount}</span>}
                      {intCount > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Internal: {intCount}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={handleClearProcessed} className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50 text-xs mt-4">
            <Database size={14} />
            Clear processed_tickets
          </button>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw size={18} className="text-emerald-600" />
            <h2 className="font-semibold text-slate-900">Backfill Controls</h2>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs font-medium text-text-secondary">Lookback days:</label>
            <input
              type="number"
              min={1}
              max={365}
              value={lookbackDays}
              onChange={e => setLookbackDays(Number(e.target.value))}
              className="w-20 px-2 py-1 text-sm border border-border rounded-md"
            />
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {profiles.filter(p => p.freshdesk_agent_id).map(p => (
              <button
                key={p.id}
                onClick={() => handleBackfill(p.freshdesk_agent_id)}
                className="w-full text-left px-3 py-2 rounded-lg border border-border hover:bg-slate-50 transition-colors text-sm"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-text-secondary ml-2">(ID: {p.freshdesk_agent_id})</span>
                <span className="text-indigo-600 text-xs float-right mt-0.5">Backfill {lookbackDays}d</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setBackfillStatus('')
              const ids = profiles.filter(p => p.freshdesk_agent_id).map(p => p.freshdesk_agent_id)
              ids.forEach((id, i) => setTimeout(() => handleBackfill(id), i * 2000))
            }}
            className="btn btn-primary w-full mt-3 text-sm"
          >
            <RefreshCw size={14} />
            Backfill All Agents ({lookbackDays}d)
          </button>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Search size={18} className="text-indigo-600" />
          <h2 className="font-semibold text-slate-900">Ticket Lookup</h2>
        </div>
        <div className="flex gap-2">
          <input
            id="ticketLookupId"
            type="number"
            placeholder="Enter Freshdesk ticket ID..."
            className="flex-1 px-3 py-2 text-sm border border-border rounded-md"
          />
          <button
            onClick={async () => {
              const input = document.getElementById('ticketLookupId')
              const id = input?.value
              if (!id) return
              setError('')
              try {
                const res = await fetch(`/api/maintenance?hours=8760&mode=tickets&ids=${id}`)
                if (!res.ok) throw new Error(`API error: ${res.status}`)
                const data = await res.json()
                if (data.tickets?.length > 0) {
                  const t = data.tickets[0]
                  const intOk = t.internal_agent_id && profileByFdId[t.internal_agent_id]
                  const typeOk = TRACKED_TYPES.includes(t.type)
                  setBackfillDetails([{
                    ticketId: t.id,
                    fdId: t.internal_agent_id || '—',
                    type: t.type || '—',
                    created: intOk && typeOk,
                    reason: !intOk
                      ? `internal_agent_id ${t.internal_agent_id || 'null'} not in profiles map`
                      : !typeOk
                        ? `Type "${t.type}" not tracked (tracked: ${TRACKED_TYPES.join(', ')})`
                        : 'Ready to import',
                  }])
                } else {
                  setBackfillDetails([{ ticketId: Number(id), fdId: '—', type: '—', created: false, reason: 'Ticket not found in Freshdesk (check ID or lookback window)' }])
                }
              } catch (err) {
                setError(err.message)
              }
            }}
            className="btn btn-primary text-sm"
          >
            Lookup
          </button>
        </div>
      </div>

      {backfillDetails && (
        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Backfill Results</h2>
            <span className="text-xs text-text-secondary">{backfillDetails.filter(d => d.created).length} created, {backfillDetails.filter(d => !d.created).length} skipped</span>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-text-secondary text-xs">Ticket ID</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary text-xs">Agent FD ID</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary text-xs">Type</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary text-xs">Result</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary text-xs">Reason</th>
                </tr>
              </thead>
              <tbody>
                {backfillDetails.map((d, i) => (
                  <tr key={i} className={`border-b border-border hover:bg-slate-50/50 transition-colors ${d.created ? '' : 'opacity-70'}`}>
                    <td className="px-3 py-1.5 font-mono text-xs">#{d.ticketId}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{d.fdId}</td>
                    <td className="px-3 py-1.5 text-xs">{d.type || '—'}</td>
                    <td className="px-3 py-1.5 text-xs">
                      {d.created ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Created</span>
                      ) : d.reason === 'Assignment already exists (duplicate mail_slack_link)' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Duplicate</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">Skipped</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-text-secondary max-w-[300px] truncate" title={d.reason}>{d.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Ticket Type Distribution</h2>
          <span className="text-xs text-text-secondary">{fdStats?.totalTickets || 0} tickets in last {fdStats?.lookbackHours || 24}h</span>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {fdStats && Object.entries(fdStats.typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const isTracked = TRACKED_TYPES.includes(type)
              return (
                <div key={type} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${isTracked ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <span>{type}</span>
                  <span className={`font-mono text-xs ${isTracked ? 'text-indigo-500' : 'text-slate-400'}`}>{count}</span>
                  {isTracked && <span className="text-[10px] uppercase tracking-wide text-indigo-400">tracked</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showTickets && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent Tickets</h2>
            <span className="text-xs text-text-secondary">{tickets.length} tickets</span>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-medium text-text-secondary text-xs">ID</th>
                  <th className="text-left px-4 py-2 font-medium text-text-secondary text-xs">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-text-secondary text-xs">Subject</th>
                  <th className="text-left px-4 py-2 font-medium text-text-secondary text-xs">Responder ID</th>
                  <th className="text-left px-4 py-2 font-medium text-text-secondary text-xs">Internal Agent ID</th>
                  <th className="text-left px-4 py-2 font-medium text-text-secondary text-xs">Updated</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => {
                  const respProfile = profileByFdId[t.responder_id]
                  const intProfile = profileByFdId[t.internal_agent_id]
                  const isTracked = TRACKED_TYPES.includes(t.type)
                  return (
                    <tr key={t.id} className={`border-b border-border hover:bg-slate-50/50 transition-colors ${isTracked ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-2 font-mono text-xs">#{t.id}</td>
                      <td className={`px-4 py-2 text-xs font-medium ${isTracked ? 'text-indigo-600' : ''}`}>{t.type || '—'}</td>
                      <td className="px-4 py-2 text-xs max-w-[200px] truncate">{t.subject}</td>
                      <td className="px-4 py-2 text-xs font-mono">
                        {t.responder_id ? (
                          <span className={`${respProfile ? 'text-emerald-600' : 'text-red-500'}`}>
                            {t.responder_id}
                            {respProfile && <span className="text-[10px] ml-1">({respProfile.name})</span>}
                          </span>
                        ) : <span className="text-text-secondary">—</span>}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono">
                        {t.internal_agent_id ? (
                          <span className={`${intProfile ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {t.internal_agent_id}
                            {intProfile && <span className="text-[10px] ml-1">({intProfile.name})</span>}
                          </span>
                        ) : <span className="text-text-secondary">—</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-text-secondary">{new Date(t.updated_at).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
