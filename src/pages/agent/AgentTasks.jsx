import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { formatDuration, getStatusBadgeColor, cn } from '../../lib/utils'
import { Plus, Send, Pencil, Check, X } from 'lucide-react'
import Modal from '../../components/ui/Modal'

export default function AgentTasks() {
  const { user, profile } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [registerModal, setRegisterModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState('')
  const [registering, setRegistering] = useState(false)
  const [editingCount, setEditingCount] = useState(null)
  const [editValue, setEditValue] = useState(1)
  const [editingTask, setEditingTask] = useState(null)
  const [editTaskId, setEditTaskId] = useState('')
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [taskCount, setTaskCount] = useState(1)
  const [slackLink, setSlackLink] = useState('')

  const fetchAssignments = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('assignments')
      .select('*, task:tasks(title, type)')
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setAssignments(data)
    setLoading(false)
  }, [user])

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_active', true)
      .order('title')
    if (data) setTasks(data)
  }, [])

  useEffect(() => {
    fetchAssignments()
    fetchTasks()
  }, [fetchAssignments, fetchTasks])

  async function handleSubmit(assignmentId) {
    if (!confirm('Submit this task as completed?')) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('assignments')
      .update({
        status: 'completed',
        started_at: now,
        submitted_at: now,
      })
      .eq('id', assignmentId)
    if (!error) fetchAssignments()
  }

  async function handleEditCount(assignmentId) {
    const { error } = await supabase
      .from('assignments')
      .update({ task_count: editValue })
      .eq('id', assignmentId)
    if (!error) {
      setEditingCount(null)
      fetchAssignments()
    }
  }

  async function handleEditTask(assignmentId) {
    if (!editTaskId) return
    const { error } = await supabase
      .from('assignments')
      .update({ task_id: editTaskId })
      .eq('id', assignmentId)
    if (!error) {
      setEditingTask(null)
      fetchAssignments()
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!selectedTask) return
    setRegistering(true)
    const { error } = await supabase.from('assignments').insert({
      agent_id: user.id,
      task_id: selectedTask,
      status: 'pending_approval',
      task_count: taskCount,
      mail_slack_link: slackLink.trim() || null,
      registered_by_agent: true,
    })
    setRegistering(false)
    if (!error) {
      setRegisterModal(false)
      setSelectedTask('')
      setTaskCount(1)
      setSlackLink('')
      setRegisterSuccess(true)
      fetchAssignments()
    }
  }

  const activeAssignments = assignments.filter((a) => a.status !== 'pending_approval')
  const pendingApproval = assignments.filter((a) => a.status === 'pending_approval')

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
          <h1 className="text-2xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-sm text-text-secondary mt-1">
            Track and manage your assigned tasks
          </p>
        </div>
        <button
          onClick={() => setRegisterModal(true)}
          className="btn btn-primary"
        >
          <Plus size={16} />
          Register Task
        </button>
      </div>

      {registerSuccess && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
          <span className="font-medium">✓</span>
          Task registered successfully! It's pending admin approval. You'll see it here once approved.
          <button onClick={() => setRegisterSuccess(false)} className="ml-auto text-amber-500 hover:text-amber-700 font-medium">Dismiss</button>
        </div>
      )}

      {pendingApproval.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Pending Approval ({pendingApproval.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {pendingApproval.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs border border-amber-200">
                {a.task?.title}
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Agent</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Task</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Mail/Slack Link</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Count</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Status</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Time</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary">Submit</th>
              </tr>
            </thead>
            <tbody>
              {activeAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-secondary">
                    No tasks assigned yet. Click "Register Task" to add one.
                  </td>
                </tr>
              ) : (
                activeAssignments.map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700">
                          {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium">{profile?.name || 'You'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {editingTask === a.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={editTaskId}
                            onChange={(e) => setEditTaskId(e.target.value)}
                            className="input text-xs py-1 w-32"
                            autoFocus
                          >
                            {tasks.map((t) => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleEditTask(a.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingTask(null)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingTask(a.id); setEditTaskId(a.task_id) }}
                            className="truncate block max-w-[140px] hover:text-indigo-600 transition-colors"
                          >
                            {a.task?.title || 'Unknown'}
                          </button>
                          {a.registered_by_agent && (
                            <span className="badge badge-info text-[10px] mt-0.5">Self-registered</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.mail_slack_link ? (
                        <a
                          href={a.mail_slack_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 underline"
                        >
                          {a.mail_slack_link.length > 25
                            ? a.mail_slack_link.slice(0, 25) + '…'
                            : a.mail_slack_link}
                        </a>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
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
                    <td className="px-4 py-3 text-center text-text-secondary text-xs">
                      {a.status === 'completed'
                        ? formatDuration(a.time_taken_minutes)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.status === 'completed' ? (
                        <span className="text-xs text-text-secondary">Done</span>
                      ) : (
                        <button
                          onClick={() => handleSubmit(a.id)}
                          className="btn btn-success text-xs py-1.5"
                        >
                          <Send size={12} />
                          Submit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={registerModal} onClose={() => setRegisterModal(false)} title="Register a Task">
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task</label>
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="input"
              required
            >
              <option value="">Select a task…</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Count</label>
            <input
              type="number"
              min={1}
              value={taskCount}
              onChange={(e) => setTaskCount(Number(e.target.value))}
              className="input w-24"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mail/Slack Link <span className="text-text-secondary font-normal">(optional)</span></label>
            <input
              type="url"
              value={slackLink}
              onChange={(e) => setSlackLink(e.target.value)}
              className="input"
              placeholder="https://freshdesk.com/a/tickets/... or slack link"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setRegisterModal(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button type="submit" disabled={registering} className="btn btn-primary">
              {registering ? 'Registering…' : 'Register'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
