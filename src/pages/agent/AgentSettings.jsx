import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Settings, Save } from 'lucide-react'

export default function AgentSettings() {
  const { profile, user } = useAuth()
  const [freshdeskId, setFreshdeskId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (profile?.freshdesk_agent_id) {
      setFreshdeskId(String(profile.freshdesk_agent_id))
    }
  }, [profile])

  async function handleSave(e) {
    e.preventDefault()
    if (!freshdeskId.trim()) return
    setSaving(true)
    setMessage({ type: '', text: '' })

    const { error } = await supabase
      .from('profiles')
      .update({ freshdesk_agent_id: Number(freshdeskId) })
      .eq('id', user.id)

    setSaving(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      supabase.functions.invoke('poll-freshdesk', {
        body: { backfillAgentId: Number(freshdeskId) },
      }).then(({ error: backfillErr }) => {
        if (backfillErr) console.error('Backfill error:', backfillErr)
      })
      setMessage({ type: 'success', text: 'Freshdesk ID saved! Tickets will be assigned to you automatically.' })
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">Link your Freshdesk account</p>
      </div>

      <div className="card p-6 max-w-lg">
        <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Settings size={18} />
          Freshdesk Integration
        </h2>

        <p className="text-sm text-text-secondary mb-4">
          Enter your Freshdesk Agent ID so that tickets assigned to you in Freshdesk are automatically added to your task list.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Freshdesk Agent ID <span className="text-red-500">*</span></label>
            <input
              type="number"
              value={freshdeskId}
              onChange={(e) => setFreshdeskId(e.target.value)}
              className="input"
              placeholder="e.g. 84045006004"
              required
            />
            <p className="text-xs text-text-secondary mt-1">
              How to find: Open Freshdesk → click your avatar → copy the number from the URL: <code className="text-indigo-600">amberstudent.freshdesk.com/a/profiles/&lt;ID&gt;/edit</code>
            </p>
          </div>

          {message.text && (
            <p className={`text-sm ${message.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
              {message.text}
            </p>
          )}

          <button type="submit" disabled={saving} className="btn btn-primary">
            <Save size={16} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}
