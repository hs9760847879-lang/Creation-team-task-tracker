import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { getDateRange, formatDuration } from '../../lib/utils'
import { Clock, CheckCircle, ListTodo, TrendingUp } from 'lucide-react'
import StatCard from '../../components/ui/StatCard'
import StatusPieChart from '../../components/ui/StatusPieChart'
import DateFilter from '../../components/ui/DateFilter'

export default function AgentOverview() {
  const { user } = useAuth()
  const [period, setPeriod] = useState('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, inProgress: 0, notStarted: 0, needHelp: 0, waitingOnKam: 0, avgTime: null })
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { start, end } = getDateRange(period, customStart, customEnd)

    let query = supabase
      .from('assignments')
      .select('*')
      .eq('agent_id', user.id)

    if (start) query = query.gte('created_at', start)
    if (end) query = query.lte('created_at', end)

    const { data } = await query

    if (data) {
      const completed = data.filter((a) => a.status === 'completed')
      const pending = data.filter((a) => a.status === 'pending')
      const inProgress = data.filter((a) => a.status === 'in-progress')
      const notStarted = data.filter((a) => a.status === 'not_started')
      const needHelp = data.filter((a) => a.status === 'need_help')
      const waitingOnKam = data.filter((a) => a.status === 'waiting_on_kam')
      const pendingApproval = data.filter((a) => a.status === 'pending_approval')

      const completedWithTime = completed.filter((a) => a.time_taken_minutes != null)
      const avgTime = completedWithTime.length
        ? completedWithTime.reduce((s, a) => s + a.time_taken_minutes, 0) /
          completedWithTime.length
        : null

      setStats({
        total: data.length,
        completed: completed.length,
        pending: pending.length,
        inProgress: inProgress.length,
        notStarted: notStarted.length,
        needHelp: needHelp.length,
        waitingOnKam: waitingOnKam.length,
        pendingApproval: pendingApproval.length,
        avgTime,
      })

      setChartData([
        { status: 'not_started', count: notStarted.length },
        { status: 'in-progress', count: inProgress.length },
        { status: 'pending', count: pending.length },
        { status: 'need_help', count: needHelp.length },
        { status: 'waiting_on_kam', count: waitingOnKam.length },
        { status: 'pending_approval', count: pendingApproval.length },
        { status: 'completed', count: completed.length },
      ])
    }
    setLoading(false)
  }, [user, period, customStart, customEnd])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  function handlePeriodChange(newPeriod, start, end) {
    setPeriod(newPeriod)
    if (start !== undefined) setCustomStart(start)
    if (end !== undefined) setCustomEnd(end)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
          <p className="text-sm text-text-secondary mt-1">Your performance at a glance</p>
        </div>
        <DateFilter
          period={period}
          onChange={handlePeriodChange}
          customStart={customStart}
          customEnd={customEnd}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={ListTodo}
          label="Total Tasks"
          value={stats.total}
          color="blue"
        />
        <StatCard
          icon={CheckCircle}
          label="Completed"
          value={stats.completed}
          color="green"
          sub={stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : null}
        />
        <StatCard
          icon={Clock}
          label="In Progress"
          value={stats.inProgress}
          color="amber"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg. Completion Time"
          value={formatDuration(stats.avgTime)}
          color="indigo"
        />
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Task Status Breakdown</h2>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <StatusPieChart data={chartData} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Daily Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Completed today</span>
              <span className="font-semibold">{stats.completed}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                style={{
                  width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Not Started</span>
              <span className="font-semibold">{stats.notStarted}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">In Progress</span>
              <span className="font-semibold">{stats.inProgress}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Need Help</span>
              <span className="font-semibold">{stats.needHelp}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Waiting on KAM</span>
              <span className="font-semibold">{stats.waitingOnKam}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Pending</span>
              <span className="font-semibold">{stats.pending}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Pending Approval</span>
              <span className="font-semibold">{stats.pendingApproval}</span>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Productivity Score</h3>
          <div className="flex flex-col items-center justify-center h-full py-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="3"
                />
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} 100`}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-slate-900">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </span>
              </div>
            </div>
            <p className="text-sm text-text-secondary mt-2">Completion Rate</p>
          </div>
        </div>
      </div>
    </div>
  )
}
