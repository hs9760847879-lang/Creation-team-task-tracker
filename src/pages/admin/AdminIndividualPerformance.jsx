import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getDateRange } from '../../lib/utils'
import DateFilter from '../../components/ui/DateFilter'

const AGENTS = [
  'Himanshu Sharma',
  'Sanket Bhasme',
  'Gaurav Padale',
  'Ashwini Sathe',
  'Md Shams Tabrej Ansari',
  'Chinmayee Choudhary',
  'Nandini Soni',
  'Varun Dhopte',
]

export default function AdminIndividualPerformance() {
  const [period, setPeriod] = useState('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [agentData, setAgentData] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDateRange, setIsDateRange] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateRange(period, customStart, customEnd)

    setIsDateRange(period !== 'custom' || (!!customStart && !!customEnd))

    let query = supabase.from('daily_agent_stats').select('*')
    if (start) query = query.gte('date', start)
    if (end) query = query.lte('date', end)

    const { data } = await query.order('date', { ascending: false })

    if (data) {
      const map = {}
      AGENTS.forEach((name) => {
        map[name] = { commission_updated: 0, commission_created: 0, properties_created: 0 }
      })

      data.forEach((r) => {
        if (map[r.agent_name]) {
          map[r.agent_name].commission_updated += r.commission_updated || 0
          map[r.agent_name].commission_created += r.commission_created || 0
          map[r.agent_name].properties_created += r.properties_created || 0
        }
      })

      setAgentData(
        AGENTS.map((name) => ({
          agent_name: name,
          ...map[name],
        }))
      )
    }
    setLoading(false)
  }, [period, customStart, customEnd])

  useEffect(() => { fetchData() }, [fetchData])

  function handlePeriodChange(newPeriod, start, end) {
    setPeriod(newPeriod)
    if (start !== undefined) setCustomStart(start)
    if (end !== undefined) setCustomEnd(end)
  }

  const totals = agentData.reduce(
    (s, a) => ({
      commission_updated: s.commission_updated + a.commission_updated,
      commission_created: s.commission_created + a.commission_created,
      properties_created: s.properties_created + a.properties_created,
    }),
    { commission_updated: 0, commission_created: 0, properties_created: 0 }
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Individual Performance</h1>
          <p className="text-sm text-text-secondary mt-1">
            Per-agent breakdown of contributions {isDateRange ? 'for the selected period' : 'for the selected date range'}
          </p>
        </div>
        <DateFilter
          period={period}
          onChange={handlePeriodChange}
          customStart={customStart}
          customEnd={customEnd}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Agent</th>
                  <th className="text-right px-4 py-3 font-medium text-text-secondary">Commission Updated</th>
                  <th className="text-right px-4 py-3 font-medium text-text-secondary">Commission Created</th>
                  <th className="text-right px-4 py-3 font-medium text-text-secondary">Properties Created</th>
                </tr>
              </thead>
              <tbody>
                {agentData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-text-secondary">
                      No data for this period
                    </td>
                  </tr>
                ) : (
                  agentData.map((a) => {
                    const hasData = a.commission_updated > 0 || a.commission_created > 0 || a.properties_created > 0
                    return (
                      <tr
                        key={a.agent_name}
                        className={`border-b border-border hover:bg-slate-50/50 transition-colors ${!hasData ? 'opacity-40' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                              {a.agent_name.charAt(0)}
                            </div>
                            <span className="font-medium">{a.agent_name}</span>
                            {!hasData && (
                              <span className="badge badge-info text-[10px]">No activity</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {a.commission_updated > 0 ? a.commission_updated.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {a.commission_created > 0 ? a.commission_created.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {a.properties_created > 0 ? a.properties_created.toLocaleString() : '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-slate-100 font-semibold">
                  <td className="px-4 py-3 text-sm">TOTAL</td>
                  <td className="px-4 py-3 text-right">{totals.commission_updated.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{totals.commission_created.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{totals.properties_created.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
