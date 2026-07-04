import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

console.log('Freshdesk webhook function started')

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const ticketUrl = body.ticket_url || ''
    const subject = (body.subject || '').toLowerCase()
    const agentName = body.agent_name || body.assignee_name || ''

    if (!agentName) {
      return new Response(JSON.stringify({ error: 'No agent assigned' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let taskTitle = 'Freshdesk Ticket'
    if (subject.includes('commission')) {
      taskTitle = 'Commission'
    } else if (subject.includes('policy update')) {
      taskTitle = 'Policy Update'
    } else if (subject.includes('property creation')) {
      taskTitle = 'Property Creation'
    }

    const { data: task } = await supabase
      .from('tasks')
      .select('id')
      .eq('title', taskTitle)
      .eq('is_active', true)
      .single()

    if (!task) {
      return new Response(JSON.stringify({ error: `Task "${taskTitle}" not found` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: agent } = await supabase
      .from('profiles')
      .select('id')
      .eq('name', agentName)
      .eq('role', 'agent')
      .single()

    if (!agent) {
      return new Response(JSON.stringify({ error: `Agent "${agentName}" not found` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { error } = await supabase.from('assignments').insert({
      agent_id: agent.id,
      task_id: task.id,
      status: 'not_started',
      task_count: 1,
      mail_slack_link: ticketUrl,
      registered_by_agent: false,
    })

    if (error) {
      console.error('Failed to create assignment:', error)
      return new Response(JSON.stringify({ error: 'Failed to create assignment' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
