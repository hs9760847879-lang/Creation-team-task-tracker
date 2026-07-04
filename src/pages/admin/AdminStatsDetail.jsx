import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getDateRange } from '../../lib/utils'
import { ArrowLeft, TrendingUp, Mail, Building2, Receipt } from 'lucide-react'
import DateFilter from '../../components/ui/DateFilter'
import Modal from '../../components/ui/Modal'

const METRIC_CONFIG = {
  'commission-updated': {
    label: 'Commission Updated',
    teamColumn: 'total_commission_updated',
    agentColumn: 'commission_updated',
    icon: TrendingUp,
    color: 'indigo',
  },
  'commission-created': {
    label: 'Commission Created',
    teamColumn: 'total_commission_created',
    agentColumn: 'commission_created',
    icon: Receipt,
    color: 'green',
  },
  'mails-assigned': {
    label: 'Mails Assigned',
    teamColumn: 'number_of_mails_assigned',
    agentColumn: null,
    icon: Mail,
    color: 'blue',
  },
  'properties-created': {
    label: 'Properties Created',
    teamColumn: 'number_of_properties_created',
    agentColumn: 'properties_created',
    icon: Building2,
    color: 'amber',
  },
}

export default function AdminStatsDetail() {
  const { metric } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const config = METRIC_CONFIG[metric]

  const [period, setPeriod] = useState(searchParams.get('period') || 'week')
  const [customStart, setCustomStart] = useState(searchParams.get('start') || '')
  const [customEnd, setCustomEnd] = useState(searchParams.get('end') || '')
  const [dailyData, setDailyData] = useState([])
  const [agentTotals, setAgentTotals] = useState([])
  const [loading, setLoading] = useState(true)

  const [dayModal, setDayModal] = useState(null)
  const [dayAgents, setDayAgents] = useState([])

  const fetchData = useCallback(async () => {
    if (!config) return
    setLoading(true)
    const { start, end } = getDateRange(period, customStart, customEnd)

    let query = supabase.from('daily_stats').select('*')
    if (start) query = query.gte('date', start)
    if (end) query = query.lte('date', end)

    const { data: daily } = await query.order('date', { ascending: false })

    if (daily) {
      const sortedDaily = [...daily].sort((a, b) => a.date.localeCompare(b.date))
      setDailyData(sortedDaily)
    }

    if (config.agentColumn) {
      let aq = supabase.from('daily_agent_stats').select('*')
      if (start) aq = aq.gte('date', start)
      if (end) aq = aq.lte('date', end)

      const { data: agents } = await aq

      if (agents) {
        const map = {}
        agents.forEach((a) => {
          const val = a[config.agentColumn] || 0
          map[a.agent_name] = (map[a.agent_name] || 0) + val
        })
        setAgentTotals(
          Object.entries(map)
            .map(([agent_name, total]) => ({ agent_name, total }))
            .sort((a, b) => b.total - a.total)
        )
      }
    } else {
      setAgentTotals([])
    }

    setLoading(false)
  }, [period, customStart, customEnd, config])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDayClick(date) {
    if (!config?.agentColumn) return

    const { data } = await supabase
      .from('daily_agent_stats')
      .select('*')
      .eq('date', date)

    if (data) {
      setDayAgents(
        data
          .map((a) => ({ agent_name: a.agent_name, value: a[config.agentColumn] || 0 }))
          .sort((a, b) => b.value - a.value)
      )
      setDayModal(date)
    }
  }

  function handlePeriodChange(newPeriod, start, end) {
    setPeriod(newPeriod)
    if (start !== undefined) setCustomStart(start)
    if (end !== undefined) setCustomEnd(end)
  }

  if (!config) {
    return <div className="p-6 text-center text-text-secondary">Invalid metric</div>
  }

  const total = dailyData.reduce((s, r) => s + (r[config.teamColumn] || 0), 0)
  const daysWithData = dailyData.filter((r) => (r[config.teamColumn] || 0) > 0).length
  const avg = daysWithData > 0 ? Math.round(total / daysWithData) : 0
  const values = dailyData.map((r) => r[config.teamColumn] || 0).filter((v) => v > 0)
  const min = values.length > 0 ? Math.min(...values) : 0
  const max = values.length > 0 ? Math.max(...values) : 0

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/stats')}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{config.label}</h1>
            <p className="text-sm text-text-secondary mt-1">Daily breakdown with agent details</p>
          </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-${config.color === 'indigo' ? 'indigo' : config.color}-500 to-${config.color === 'indigo' ? 'indigo' : config.color}-600 flex items-center justify-center shrink-0`}>
                <config.icon size={24} className="text-white" />
              </div>
              <div>
                <p className="stat-label">Total {config.label}</p>
                <p className="text-3xl font-bold">{total.toLocaleString()}</p>
                <p className="text-xs text-text-secondary mt-0.5">{daysWithData} days with data</p>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-900">Daily Breakdown</h2>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 font-medium text-text-secondary">Date</th>
                      <th className="text-right px-4 py-3 font-medium text-text-secondary">Value</th>
                      <th className="text-center px-4 py-3 font-medium text-text-secondary">Day</th>
                      {config.agentColumn && (
                        <th className="text-center px-4 py-3 font-medium text-text-secondary">Agents</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.length === 0 ? (
                      <tr>
                        <td colSpan={config.agentColumn ? 4 : 3} className="text-center py-12 text-text-secondary">
                          No data for this period
                        </td>
                      </tr>
                    ) : (
                      [...dailyData].reverse().map((r) => (
                        <tr
                          key={r.id}
                          className={`border-b border-border hover:bg-slate-50/50 transition-colors ${config.agentColumn ? 'cursor-pointer' : ''}`}
                          onClick={() => config.agentColumn && handleDayClick(r.date)}
                        >
                          <td className="px-4 py-3 font-medium">{r.date}</td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {(r[config.teamColumn] || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center text-text-secondary">{r.day_of_week || '—'}</td>
                          {config.agentColumn && (
                            <td className="px-4 py-3 text-center">
                              <span className="text-xs text-indigo-600 hover:text-indigo-700">
                                View agents →
                              </span>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Statistics</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Average</span>
                  <span className="font-semibold">{avg.toLocaleString()} / day</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Minimum</span>
                  <span className="font-semibold">{min.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Maximum</span>
                  <span className="font-semibold">{max.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Days with data</span>
                  <span className="font-semibold">{daysWithData}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Total days</span>
                  <span className="font-semibold">{dailyData.length}</span>
                </div>
              </div>
            </div>

            {agentTotals.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Agent Totals
                  <span className="text-xs text-text-secondary font-normal ml-1">(this period)</span>
                </h3>
                <div className="space-y-2">
                  {agentTotals.map((a) => (
                    <div
                      key={a.agent_name}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50"
                    >
                      <span className="text-sm font-medium truncate mr-2">{a.agent_name}</span>
                      <span className="text-sm font-semibold text-indigo-600 shrink-0">
                        {a.total.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-secondary mt-3">
                  Click a day in the table to see that day's agent breakdown
                </p>
              </div>
            )}

            {!config.agentColumn && (
              <div className="card p-5">
                <p className="text-sm text-text-secondary">
                  Individual agent breakdown is not available for this metric.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={!!dayModal}
        onClose={() => setDayModal(null)}
        title={`Agent Breakdown — ${dayModal || ''}`}
      >
        <div className="space-y-2">
          {dayAgents.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-4">No data for this date</p>
          ) : (
            dayAgents.map((a) => (
              <div
                key={a.agent_name}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50"
              >
                <span className="text-sm font-medium">{a.agent_name}</span>
                <span className="text-sm font-semibold text-indigo-600">
                  {a.value.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
