import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const FRESHDESK_SUBDOMAIN = 'amberstudent'
const FRESHDESK_BASE = `https://${FRESHDESK_SUBDOMAIN}.freshdesk.com/api/v2`

const TASK_MAP: Record<string, string> = {
  'commission update': 'Commission',
  'policy update': 'Policy Update',
  'property creation request': 'Property Creation',
}

function matchTaskType(type: string | null): string | null {
  const lower = (type || '').toLowerCase()
  for (const [keyword, taskTitle] of Object.entries(TASK_MAP)) {
    if (lower.includes(keyword)) return taskTitle
  }
  return null
}

async function fetchFreshdesk(path: string) {
  const apiKey = Deno.env.get('FRESHDESK_API_KEY')!
  const auth = btoa(`${apiKey}:X`)
  const res = await fetch(`${FRESHDESK_BASE}${path}`, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Freshdesk API ${res.status}: ${text}`)
  }
  return res.json()
}

interface RunOptions {
  lookbackMinutes: number
  targetAgentId?: number
}

async function runPoll(supabase: ReturnType<typeof createClient>, opts: RunOptions) {
  const since = new Date(Date.now() - opts.lookbackMinutes * 60 * 1000).toISOString()
  console.log(`Fetching tickets updated since ${since}`)

  const perPage = 100
  const allTickets: any[] = []
  let page = 1
  while (true) {
    const tickets = await fetchFreshdesk(`/tickets?updated_since=${encodeURIComponent(since)}&per_page=${perPage}&page=${page}&order_by=updated_at&order_type=desc`)
    if (tickets.length === 0) break
    allTickets.push(...tickets)
    console.log(`  Page ${page}: ${tickets.length} tickets`)
    if (tickets.length < perPage) break
    page++
  }
  console.log(`Found ${allTickets.length} recently updated tickets`)

  let agentIdToProfile: Map<number, string>
  if (opts.targetAgentId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, freshdesk_agent_id')
      .eq('freshdesk_agent_id', opts.targetAgentId)
      .single()
    agentIdToProfile = new Map()
    if (data) agentIdToProfile.set(data.freshdesk_agent_id, data.id)
    console.log(`Backfill target: FD ID ${opts.targetAgentId} → profile ${data?.id || 'not found'}`)
  } else {
    const { data } = await supabase
      .from('profiles')
      .select('id, freshdesk_agent_id')
      .not('freshdesk_agent_id', 'is', null)
    agentIdToProfile = new Map()
    for (const p of data || []) agentIdToProfile.set(p.freshdesk_agent_id, p.id)
    console.log(`Agents with FD ID: ${agentIdToProfile.size}`)
  }

  if (agentIdToProfile.size === 0) {
    console.warn('No matching agents with freshdesk_agent_id set. Nothing to do.')
    return { created: 0, skipped: 0 }
  }

  const { data: processedData } = await supabase.from('processed_tickets').select('ticket_id, responder_id')
  const processedPairs = new Set<string>()
  for (const r of processedData || []) processedPairs.add(`${r.ticket_id}:${r.responder_id}`)

  const { data: linkData } = await supabase
    .from('assignments')
    .select('mail_slack_link')
    .not('mail_slack_link', 'is', null)
  const existingLinks = new Set((linkData || []).map((r: any) => r.mail_slack_link))

  const { data: tasksData } = await supabase.from('tasks').select('id, title').eq('is_active', true)
  const taskById = new Map((tasksData || []).map((t: any) => [t.title, t.id]))

  let created = 0
  let skipped = 0

  for (const ticket of allTickets) {
    const internalAgentId: number | null = ticket.internal_agent_id

    if (opts.targetAgentId && internalAgentId !== opts.targetAgentId) continue

    const pairKey = `${ticket.id}:${internalAgentId || 0}`

    if (processedPairs.has(pairKey)) {
      skipped++
      continue
    }

    if (!internalAgentId || !agentIdToProfile.has(internalAgentId)) {
      skipped++
      await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: 0 })
      continue
    }

    const taskTitle = matchTaskType(ticket.type)
    if (!taskTitle) {
      skipped++
      await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: internalAgentId })
      continue
    }

    const taskId = taskById.get(taskTitle)
    if (!taskId) {
      console.warn(`  Task type "${taskTitle}" not found in DB`)
      skipped++
      await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: internalAgentId })
      continue
    }

    const profileId = agentIdToProfile.get(internalAgentId)
    const ticketUrl = `https://${FRESHDESK_SUBDOMAIN}.freshdesk.com/a/tickets/${ticket.id}`

    if (existingLinks.has(ticketUrl)) {
      skipped++
      await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: internalAgentId })
      continue
    }

    const { error } = await supabase.from('assignments').insert({
      agent_id: profileId,
      task_id: taskId,
      status: 'not_started',
      task_count: 1,
      mail_slack_link: ticketUrl,
      registered_by_agent: false,
    })

    if (error) {
      console.error(`  Failed to create assignment for ticket ${ticket.id}:`, error.message)
    } else {
      created++
      console.log(`  Created: ticket #${ticket.id} "${ticket.subject}" → ${profileId} (${taskTitle})`)
    }

    await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: internalAgentId })
  }

  console.log(`Done. Created: ${created}, Skipped: ${skipped}`)
  return { created, skipped }
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const url = new URL(req.url)

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      if (!body.backfillAgentId) {
        return new Response(JSON.stringify({ error: 'backfillAgentId required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const result = await runPoll(supabase, {
        lookbackMinutes: 7 * 24 * 60,
        targetAgentId: Number(body.backfillAgentId),
      })
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      console.error('Backfill error:', err)
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const token = url.searchParams.get('token')
  const expected = Deno.env.get('CRON_SECRET')

  if (!token || token !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await runPoll(supabase, { lookbackMinutes: 30 })
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Fatal error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
