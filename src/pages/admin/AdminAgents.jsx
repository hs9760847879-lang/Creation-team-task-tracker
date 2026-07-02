import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDuration } from '../../lib/utils'
import { Plus, Mail, MessageCircle, TrendingUp, CheckCircle, ListTodo } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import StatCard from '../../components/ui/StatCard'

export default function AdminAgents() {
  const [agents, setAgents] = useState([])
  const [agentStats, setAgentStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [inviteModal, setInviteModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newSlack, setNewSlack] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'agent')
      .order('name')

    if (profiles) {
      setAgents(profiles)
      const stats = {}
      for (const agent of profiles) {
        const { data: assignments } = await supabase
          .from('assignments')
          .select('*')
          .eq('agent_id', agent.id)
        if (assignments) {
          const completed = assignments.filter((a) => a.status === 'completed')
          const withTime = completed.filter((a) => a.time_taken_minutes != null)
          stats[agent.id] = {
            total: assignments.length,
            completed: completed.length,
            pending: assignments.filter((a) => a.status === 'pending').length,
            avgTime: withTime.length
              ? withTime.reduce((s, a) => s + a.time_taken_minutes, 0) / withTime.length
              : null,
          }
        }
      }
      setAgentStats(stats)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleInvite(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { name: newName } },
      })
      if (signUpError) throw signUpError

      if (data?.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          name: newName,
          email: newEmail,
          role: 'agent',
          slack_link: newSlack || null,
        })
        if (profileError) throw profileError
      }

      setInviteModal(false)
      setNewEmail('')
      setNewName('')
      setNewPassword('')
      setNewSlack('')
      fetchData()
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
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
          <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your team</p>
        </div>
        <button onClick={() => setInviteModal(true)} className="btn btn-primary">
          <Plus size={16} />
          Add Agent
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ListTodo} label="Total Agents" value={agents.length} color="blue" />
        <StatCard
          icon={CheckCircle}
          label="Total Tasks (All)"
          value={Object.values(agentStats).reduce((s, a) => s + a.total, 0)}
          color="indigo"
        />
        <StatCard
          icon={TrendingUp}
          label="Completed (All)"
          value={Object.values(agentStats).reduce((s, a) => s + a.completed, 0)}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Completion (All)"
          value={(() => {
            const allTimes = Object.values(agentStats)
              .map((a) => a.avgTime)
              .filter(Boolean)
            return allTimes.length
              ? formatDuration(allTimes.reduce((s, t) => s + t, 0) / allTimes.length)
              : '—'
          })()}
          color="indigo"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Agent</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Email</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Slack</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Tasks</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Completed</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Avg. Time</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Rate</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const s = agentStats[agent.id] || { total: 0, completed: 0, pending: 0, avgTime: null }
                return (
                  <tr key={agent.id} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                          {agent.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium">{agent.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${agent.email}`} className="text-indigo-600 hover:text-indigo-700 underline inline-flex items-center gap-1">
                        <Mail size={12} />
                        {agent.email}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {agent.slack_link ? (
                        <a href={agent.slack_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 underline inline-flex items-center gap-1">
                          <MessageCircle size={12} />
                          {agent.slack_link.length > 20 ? agent.slack_link.slice(0, 20) + '…' : agent.slack_link}
                        </a>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{s.total}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-emerald-600 font-medium">{s.completed}</span>
                      {s.pending > 0 && (
                        <span className="text-text-secondary text-xs ml-1">({s.pending} pending)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-text-secondary">
                      {formatDuration(s.avgTime)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-400 to-emerald-500 rounded-full"
                            style={{ width: `${s.total > 0 ? (s.completed / s.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title="Add New Agent">
        <form onSubmit={handleInvite} className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="input" placeholder="Jane Doe" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="input" placeholder="jane@example.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" placeholder="Set a password" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Slack / Contact Link (optional)</label>
            <input type="url" value={newSlack} onChange={(e) => setNewSlack(e.target.value)} className="input" placeholder="https://slack.com/team/..." />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => setInviteModal(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Adding…' : 'Add Agent'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
