import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { getStatusBadgeColor, formatDuration, cn } from '../../lib/utils'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import Modal from '../../components/ui/Modal'

export default function AdminTasks() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [tasks, setTasks] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [assignModal, setAssignModal] = useState(false)
  const [taskModal, setTaskModal] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('')
  const [selectedTask, setSelectedTask] = useState('')
  const [taskCount, setTaskCount] = useState(1)
  const [slackLink, setSlackLink] = useState('')
  const [newTaskName, setNewTaskName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingCount, setEditingCount] = useState(null)
  const [editValue, setEditValue] = useState(1)

  const fetchData = useCallback(async () => {
    const [aRes, tRes, agRes] = await Promise.all([
      supabase.from('assignments').select('*, agent:profiles!agent_id(name, email, slack_link), task:tasks(title, type)').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('is_active', true).order('title'),
      supabase.from('profiles').select('*').eq('role', 'agent').order('name'),
    ])
    if (aRes.data) {
      const sorted = [...aRes.data].sort((a, b) =>
        (a.agent?.name || '').localeCompare(b.agent?.name || '')
      )
      setAssignments(sorted)
    }
    if (tRes.data) setTasks(tRes.data)
    if (agRes.data) setAgents(agRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleAssign(e) {
    e.preventDefault()
    if (!selectedAgent || !selectedTask) return
    setSubmitting(true)

    const { error } = await supabase.from('assignments').insert({
      agent_id: selectedAgent,
      task_id: selectedTask,
      task_count: taskCount,
      status: 'not_started',
      mail_slack_link: slackLink.trim() || null,
    })
    setSubmitting(false)
    if (!error) {
      setAssignModal(false)
      setSelectedAgent('')
      setSelectedTask('')
      setTaskCount(1)
      setSlackLink('')
      fetchData()
    }
  }

  async function handleEditCount(assignmentId) {
    const { error } = await supabase
      .from('assignments')
      .update({ task_count: editValue })
      .eq('id', assignmentId)
    if (!error) {
      setEditingCount(null)
      fetchData()
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault()
    if (!newTaskName.trim()) return
    setSubmitting(true)
    const { error } = await supabase.from('tasks').insert({
      title: newTaskName.trim(),
      type: 'custom',
      created_by: user.id,
      is_active: true,
    })
    setSubmitting(false)
    if (!error) {
      setTaskModal(false)
      setNewTaskName('')
      fetchData()
    }
  }

  async function handleDeleteTask(taskId) {
    if (!confirm('Deactivate this task? It will be hidden from selection.')) return
    await supabase.from('tasks').update({ is_active: false }).eq('id', taskId)
    fetchData()
  }

  async function handleApprove(id) {
    await supabase.from('assignments').update({ status: 'pending' }).eq('id', id)
    fetchData()
  }

  async function handleReject(id) {
    await supabase.from('assignments').update({ status: 'completed', time_taken_minutes: 0 }).eq('id', id)
    fetchData()
  }

  const pendingApprovals = assignments.filter((a) => a.status === 'pending_approval')

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
          <h1 className="text-2xl font-bold text-slate-900">Task Manager</h1>
          <p className="text-sm text-text-secondary mt-1">Assign tasks and manage task types</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTaskModal(true)} className="btn btn-outline">
            <Plus size={16} />
            New Task Type
          </button>
          <button onClick={() => setAssignModal(true)} className="btn btn-primary">
            <Plus size={16} />
            Assign Task
          </button>
        </div>
      </div>

      {pendingApprovals.length > 0 && (
        <div className="card overflow-hidden mb-6 border-amber-200">
          <div className="px-4 py-3 border-b border-border bg-amber-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Pending Approvals ({pendingApprovals.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-amber-50/50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Agent</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Task</th>
                  <th className="text-center px-4 py-3 font-medium text-text-secondary">Count</th>
                  <th className="text-center px-4 py-3 font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-medium text-amber-700">
                          {a.agent?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium">{a.agent?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{a.task?.title || 'Unknown'}</td>
                    <td className="px-4 py-3 text-center">{a.task_count}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleApprove(a.id)} className="btn btn-success text-xs py-1.5">
                          Approve
                        </button>
                        <button onClick={() => handleReject(a.id)} className="btn btn-outline text-xs py-1.5 text-red-500 border-red-200 hover:bg-red-50">
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">All Assignments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Agent</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Task</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Count</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Status</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Time Taken</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Contact</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-secondary">
                    No assignments yet
                  </td>
                </tr>
              ) : (
                assignments.map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700">
                          {a.agent?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium">{a.agent?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{a.task?.title || 'Unknown'}</td>
                    <td className="px-4 py-3 text-center">
                      {editingCount === a.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min={1}
                            value={editValue}
                            onChange={(e) => setEditValue(Number(e.target.value))}
                            className="input w-16 text-center text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleEditCount(a.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingCount(null)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingCount(a.id); setEditValue(a.task_count) }}
                          className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors"
                        >
                          <span className="font-medium">{a.task_count}</span>
                          <Pencil size={12} className="opacity-40" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('badge', getStatusBadgeColor(a.status))}>
                        {a.status === 'pending_approval' ? 'Pending Approval' : a.status === 'not_started' ? 'Not Started' : a.status === 'need_help' ? 'Need Help' : a.status === 'waiting_on_kam' ? 'Waiting on KAM' : a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-text-secondary">
                      {a.time_taken_minutes ? formatDuration(a.time_taken_minutes) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {a.mail_slack_link ? (
                        <a href={a.mail_slack_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 underline text-xs">
                          {a.mail_slack_link.length > 25 ? a.mail_slack_link.slice(0, 25) + '…' : a.mail_slack_link}
                        </a>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Task Types</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {tasks.map((t) => (
            <div key={t.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-sm">
              <span>{t.title}</span>
              {t.type === 'custom' && (
                <button
                  onClick={() => handleDeleteTask(t.id)}
                  className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
              {t.type === 'default' && (
                <span className="text-[10px] text-text-secondary uppercase">Default</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Assign Task">
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Agent</label>
            <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="input" required>
              <option value="">Select an agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task</label>
            <select value={selectedTask} onChange={(e) => setSelectedTask(e.target.value)} className="input" required>
              <option value="">Select a task…</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Count</label>
            <input type="number" min={1} value={taskCount} onChange={(e) => setTaskCount(Number(e.target.value))} className="input w-24" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Slack / Mail Link <span className="text-text-secondary font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={slackLink}
              onChange={(e) => setSlackLink(e.target.value)}
              className="input"
              placeholder="https://slack.com/team/... or mailto:agent@example.com"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => setAssignModal(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Assigning…' : 'Assign'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={taskModal} onClose={() => setTaskModal(false)} title="New Task Type">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Name</label>
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              className="input"
              placeholder="e.g. Property Creation"
              required
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => setTaskModal(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
