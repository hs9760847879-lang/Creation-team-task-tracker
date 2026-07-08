import { createClient } from '@supabase/supabase-js'

const FRESHDESK_SUBDOMAIN = 'amberstudent'
const FRESHDESK_BASE = `https://${FRESHDESK_SUBDOMAIN}.freshdesk.com/api/v2`

const TASK_MAP = {
  'commission update': 'Commission',
  'policy update': 'Policy Update',
  'property creation request': 'Property Creation',
}

function matchTaskType(type) {
  const lower = (type || '').toLowerCase()
  for (const [keyword, taskTitle] of Object.entries(TASK_MAP)) {
    if (lower.includes(keyword)) return taskTitle
  }
  return null
}

async function fetchFreshdesk(path) {
  const apiKey = process.env.FRESHDESK_API_KEY
  if (!apiKey) throw new Error('FRESHDESK_API_KEY env var not set')
  const auth = Buffer.from(`${apiKey}:X`).toString('base64')
  const res = await fetch(`${FRESHDESK_BASE}${path}`, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Freshdesk API ${res.status}: ${text.slice(0, 500)}`)
  }
  return res.json()
}

async function runPoll(supabase, opts) {
  const since = new Date(Date.now() - opts.lookbackMinutes * 60 * 1000).toISOString()
  console.log(`Fetching tickets updated since ${since}`)

  const perPage = 100
  const allTickets = []
  let page = 1
  while (true) {
    const tickets = await fetchFreshdesk(`/tickets?updated_since=${encodeURIComponent(since)}&per_page=${perPage}&page=${page}&order_by=updated_at&order_type=desc`)
    if (tickets.length === 0) break
    allTickets.push(...tickets)
    if (tickets.length < perPage) break
    page++
  }
  console.log(`Found ${allTickets.length} recently updated tickets`)

  let agentIdToProfile = new Map()
  if (opts.targetAgentId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, freshdesk_agent_id')
      .eq('freshdesk_agent_id', opts.targetAgentId)
      .single()
    if (data) agentIdToProfile.set(data.freshdesk_agent_id, data.id)
    console.log(`Backfill target: FD ID ${opts.targetAgentId} → profile ${data?.id || 'not found'}`)
  } else {
    const { data } = await supabase
      .from('profiles')
      .select('id, freshdesk_agent_id')
      .not('freshdesk_agent_id', 'is', null)
    for (const p of data || []) agentIdToProfile.set(p.freshdesk_agent_id, p.id)
    console.log(`Agents with FD ID: ${agentIdToProfile.size}`)
  }

  if (agentIdToProfile.size === 0) {
    console.warn('No matching agents with freshdesk_agent_id set. Nothing to do.')
    return { created: 0, skipped: 0 }
  }

  const { data: processedData } = await supabase.from('processed_tickets').select('ticket_id, responder_id')
  const processedPairs = new Set()
  for (const r of processedData || []) processedPairs.add(`${r.ticket_id}:${r.responder_id}`)

  const { data: linkData } = await supabase
    .from('assignments')
    .select('mail_slack_link')
    .not('mail_slack_link', 'is', null)
  const existingLinks = new Set((linkData || []).map(r => r.mail_slack_link))

  const { data: tasksData } = await supabase.from('tasks').select('id, title').eq('is_active', true)
  const taskById = new Map((tasksData || []).map(t => [t.title, t.id]))

  let created = 0
  let skipped = 0

  for (const ticket of allTickets) {
    const internalAgentId = ticket.internal_agent_id

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
      console.error(`Failed to create assignment for ticket ${ticket.id}:`, error.message)
    } else {
      created++
    }

    await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: internalAgentId })
  }

  console.log(`Done. Created: ${created}, Skipped: ${skipped}`)
  return { created, skipped }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Supabase credentials not configured' })
    return
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}')
      if (!body.backfillAgentId) {
        res.status(400).json({ error: 'backfillAgentId required' })
        return
      }
      const lookbackDays = body.lookbackDays || 7
      const result = await runPoll(supabase, {
        lookbackMinutes: lookbackDays * 24 * 60,
        targetAgentId: Number(body.backfillAgentId),
      })
      res.json(result)
    } catch (err) {
      console.error('Backfill error:', err)
      res.status(500).json({ error: err.message })
    }
    return
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const token = url.searchParams.get('token')
  const expected = process.env.CRON_SECRET

  if (!token || token !== expected) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const result = await runPoll(supabase, { lookbackMinutes: 30 })
    res.json(result)
  } catch (err) {
    console.error('Fatal error:', err)
    res.status(500).json({ error: err.message })
  }
}
