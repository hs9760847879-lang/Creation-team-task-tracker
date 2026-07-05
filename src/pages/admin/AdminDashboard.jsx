import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getDateRange, formatDuration } from '../../lib/utils'
import { Users, CheckCircle, Clock, TrendingUp, ListTodo } from 'lucide-react'
import StatCard from '../../components/ui/StatCard'
import StatusPieChart from '../../components/ui/StatusPieChart'
import DateFilter from '../../components/ui/DateFilter'

export default function AdminDashboard() {
  const [period, setPeriod] = useState('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, inProgress: 0, avgTime: null, agents: 0 })
  const [chartData, setChartData] = useState([])
  const [agentPerformance, setAgentPerformance] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateRange(period, customStart, customEnd)

    let query = supabase.from('assignments').select('*, agent:profiles!agent_id(name, email)')
    if (start) query = query.gte('created_at', start)
    if (end) query = query.lte('created_at', end)

    const { data: assignments } = await query
    const { count: agentCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'agent')

    if (assignments) {
      const completed = assignments.filter((a) => a.status === 'completed')
      const pending = assignments.filter((a) => a.status === 'pending')
      const inProgress = assignments.filter((a) => a.status === 'in-progress')
      const notStarted = assignments.filter((a) => a.status === 'not_started')
      const needHelp = assignments.filter((a) => a.status === 'need_help')
      const waitingOnKam = assignments.filter((a) => a.status === 'waiting_on_kam')
      const pendingApproval = assignments.filter((a) => a.status === 'pending_approval')
      const withTime = completed.filter((a) => a.time_taken_minutes != null)
      const avgTime = withTime.length
        ? withTime.reduce((s, a) => s + a.time_taken_minutes, 0) / withTime.length
        : null

      setStats({
        total: assignments.length,
        completed: completed.length,
        pending: pending.length,
        inProgress: inProgress.length,
        avgTime,
        agents: agentCount || 0,
      })

      setChartData([
        ...(notStarted.length ? [{ status: 'not_started', count: notStarted.length }] : []),
        { status: 'in-progress', count: inProgress.length },
        ...(pending.length ? [{ status: 'pending', count: pending.length }] : []),
        ...(pendingApproval.length ? [{ status: 'pending_approval', count: pendingApproval.length }] : []),
        ...(needHelp.length ? [{ status: 'need_help', count: needHelp.length }] : []),
        ...(waitingOnKam.length ? [{ status: 'waiting_on_kam', count: waitingOnKam.length }] : []),
        ...(completed.length ? [{ status: 'completed', count: completed.length }] : []),
      ])

      const agentMap = {}
      assignments.forEach((a) => {
        const name = a.agent?.name || 'Unknown'
        if (!agentMap[name]) {
          agentMap[name] = { name, total: 0, completed: 0, timeSum: 0, timeCount: 0 }
        }
        agentMap[name].total++
        if (a.status === 'completed') {
          agentMap[name].completed++
          if (a.time_taken_minutes != null) {
            agentMap[name].timeSum += a.time_taken_minutes
            agentMap[name].timeCount++
          }
        }
      })

      setAgentPerformance(
        Object.values(agentMap).map((a) => ({
          ...a,
          avgTime: a.timeCount > 0 ? a.timeSum / a.timeCount : null,
          completionRate: a.total > 0 ? Math.round((a.completed / a.total) * 100) : 0,
        }))
      )
    }
    setLoading(false)
  }, [period, customStart, customEnd])

  useEffect(() => { fetchStats() }, [fetchStats])

  function handlePeriodChange(newPeriod, start, end) {
    setPeriod(newPeriod)
    if (start !== undefined) setCustomStart(start)
    if (end !== undefined) setCustomEnd(end)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">Monitor team productivity</p>
        </div>
        <DateFilter
          period={period}
          onChange={handlePeriodChange}
          customStart={customStart}
          customEnd={customEnd}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={Users} label="Active Agents" value={stats.agents} color="blue" />
        <StatCard icon={ListTodo} label="Total Tasks" value={stats.total} color="indigo" />
        <StatCard icon={CheckCircle} label="Completed" value={stats.completed} color="green" />
        <StatCard icon={Clock} label="In Progress" value={stats.inProgress} color="amber" />
        <StatCard icon={TrendingUp} label="Avg. Time" value={formatDuration(stats.avgTime)} color="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Task Status Overview</h2>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <StatusPieChart data={chartData} />
          )}
        </div>
        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Agent Performance</h2>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : agentPerformance.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
              No data for this period
            </div>
          ) : (
            <div className="space-y-3">
              {agentPerformance.map((agent) => (
                <div key={agent.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div>
                    <p className="text-sm font-medium">{agent.name}</p>
                    <p className="text-xs text-text-secondary">
                      {agent.completed}/{agent.total} tasks
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{agent.completionRate}%</p>
                    <p className="text-xs text-text-secondary">
                      {formatDuration(agent.avgTime)} avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Agent Comparison</h2>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : agentPerformance.length === 0 ? (
          <div className="text-center py-10 text-text-secondary text-sm">No data for this period</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Agent</th>
                  <th className="text-center px-4 py-3 font-medium text-text-secondary">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-text-secondary">Completed</th>
                  <th className="text-center px-4 py-3 font-medium text-text-secondary">Pending</th>
                  <th className="text-center px-4 py-3 font-medium text-text-secondary">Rate</th>
                  <th className="text-center px-4 py-3 font-medium text-text-secondary">Avg Time</th>
                  <th className="text-center px-4 py-3 font-medium text-text-secondary">vs Avg</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance
                  .sort((a, b) => b.completionRate - a.completionRate)
                  .map((agent, i, arr) => {
                    const teamAvg = arr.reduce((s, a) => s + (a.avgTime || 0), 0) / arr.filter((a) => a.avgTime).length
                    const vsAvg = agent.avgTime
                      ? teamAvg > 0
                        ? Math.round(((teamAvg - agent.avgTime) / teamAvg) * 100)
                        : 0
                      : null
                    const isTop = i === 0
                    return (
                      <tr key={agent.name} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isTop && <span className="text-amber-500 text-xs">👑</span>}
                            <span className="font-medium">{agent.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{agent.total}</td>
                        <td className="px-4 py-3 text-center font-medium text-emerald-600">{agent.completed}</td>
                        <td className="px-4 py-3 text-center text-text-secondary">{agent.total - agent.completed}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-indigo-400 to-emerald-500 rounded-full" style={{ width: `${agent.completionRate}%` }} />
                            </div>
                            <span className="text-xs font-medium">{agent.completionRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-text-secondary">{formatDuration(agent.avgTime)}</td>
                        <td className="px-4 py-3 text-center">
                          {vsAvg !== null ? (
                            <span className={vsAvg >= 0 ? 'text-emerald-600 text-xs font-medium' : 'text-red-500 text-xs font-medium'}>
                              {vsAvg >= 0 ? `${vsAvg}% faster` : `${Math.abs(vsAvg)}% slower`}
                            </span>
                          ) : (
                            <span className="text-text-secondary text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
