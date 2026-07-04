import { createClient } from '@supabase/supabase-js'

const FRESHDESK_SUBDOMAIN = 'amberstudent'
const FRESHDESK_BASE = `https://${FRESHDESK_SUBDOMAIN}.freshdesk.com/api/v2`

const FRESHDESK_API_KEY = process.env.FRESHDESK_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!FRESHDESK_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: FRESHDESK_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const TASK_MAP = {
  commission: 'Commission',
  'policy update': 'Policy Update',
  'property creation': 'Property Creation',
}

async function fetchFreshdesk(path) {
  const auth = Buffer.from(`${FRESHDESK_API_KEY}:X`).toString('base64')
  const res = await fetch(`${FRESHDESK_BASE}${path}`, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Freshdesk API ${res.status}: ${text}`)
  }
  return res.json()
}

function matchSubject(subject) {
  const lower = (subject || '').toLowerCase()
  for (const [keyword, taskTitle] of Object.entries(TASK_MAP)) {
    if (lower.includes(keyword)) return taskTitle
  }
  return null
}

async function getAgentsById() {
  const agents = await fetchFreshdesk('/agents?per_page=100')
  const map = new Map()
  for (const agent of agents) {
    map.set(agent.id, {
      name: agent.contact?.name?.trim(),
      email: agent.contact?.email?.trim()?.toLowerCase(),
    })
  }
  return map
}

async function getProcessedSet() {
  const { data } = await supabase.from('processed_tickets').select('ticket_id')
  return new Set((data || []).map((r) => r.ticket_id))
}

async function isFirstRun() {
  const { count } = await supabase.from('processed_tickets').select('*', { count: 'exact', head: true })
  return count === 0
}

async function getExistingLinks() {
  const { data } = await supabase
    .from('assignments')
    .select('mail_slack_link')
    .not('mail_slack_link', 'is', null)
  return new Set((data || []).map((r) => r.mail_slack_link))
}

async function run() {
  console.log('Polling Freshdesk for recently updated tickets...')

  const firstRun = await isFirstRun()
  const lookbackMinutes = firstRun ? 7 * 24 * 60 : 30
  const since = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString()
  console.log(firstRun ? 'First run — backfilling last 7 days' : 'Incremental run — checking last 30 minutes')

  const tickets = await fetchFreshdesk(`/tickets?updated_since=${encodeURIComponent(since)}&per_page=100&order_by=updated_at&order_type=desc`)
  console.log(`Found ${tickets.length} recently updated tickets`)

  const [fdAgentsById, processed, existingLinks] = await Promise.all([
    getAgentsById(),
    getProcessedSet(),
    getExistingLinks(),
  ])
  console.log(`Agents in Freshdesk: ${fdAgentsById.size}, Already processed: ${processed.size}, Existing links: ${existingLinks.size}`)

  const { data: tasks } = await supabase.from('tasks').select('id, title').eq('is_active', true)
  const taskById = new Map((tasks || []).map((t) => [t.title, t.id]))

  const { data: profiles } = await supabase.from('profiles').select('id, name, email')
  const profilesByName = new Map()
  const profilesByEmail = new Map()
  for (const p of profiles || []) {
    profilesByName.set(p.name?.trim(), p)
    if (p.email) profilesByEmail.set(p.email?.trim()?.toLowerCase(), p)
  }

  let created = 0
  let skipped = 0

  for (const ticket of tickets) {
    if (processed.has(ticket.id)) {
      skipped++
      continue
    }

    const taskTitle = matchSubject(ticket.subject)
    if (!taskTitle) {
      skipped++
      await supabase.from('processed_tickets').insert({ ticket_id: ticket.id })
      continue
    }

    const taskId = taskById.get(taskTitle)
    if (!taskId) {
      console.warn(`  Task type "${taskTitle}" not found in DB`)
      skipped++
      await supabase.from('processed_tickets').insert({ ticket_id: ticket.id })
      continue
    }

    let profile = null
    if (ticket.responder_id) {
      const fdAgent = fdAgentsById.get(ticket.responder_id)
      if (fdAgent) {
        profile = profilesByName.get(fdAgent.name) || profilesByEmail.get(fdAgent.email)
      }
    }

    if (!profile) {
      skipped++
      await supabase.from('processed_tickets').insert({ ticket_id: ticket.id })
      continue
    }

    const ticketUrl = `https://${FRESHDESK_SUBDOMAIN}.freshdesk.com/a/tickets/${ticket.id}`

    if (existingLinks.has(ticketUrl)) {
      skipped++
      await supabase.from('processed_tickets').insert({ ticket_id: ticket.id })
      continue
    }

    const { error } = await supabase.from('assignments').insert({
      agent_id: profile.id,
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
      console.log(`  Created: "${ticket.subject}" → ${profile.name} (${taskTitle})`)
    }

    await supabase.from('processed_tickets').insert({ ticket_id: ticket.id })
  }

  console.log(`Done. Created: ${created}, Skipped (already processed / no match): ${skipped}`)
}

run().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
