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
        { status: 'completed', count: completed.length },
        { status: 'in-progress', count: inProgress.length },
        { status: 'pending', count: pending.length },
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
    </div>
  )
}
