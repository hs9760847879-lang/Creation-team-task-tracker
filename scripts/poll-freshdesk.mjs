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
  'commission': 'Commission',
  'commission update': 'Commission',
  'policy update': 'Policy Update',
  'property creation': 'Property Creation',
  'property creation request': 'Property Creation',
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

function matchTaskType(type) {
  const lower = (type || '').toLowerCase()
  for (const [keyword, taskTitle] of Object.entries(TASK_MAP)) {
    if (lower.includes(keyword)) return taskTitle
  }
  return null
}

async function getProcessedPairs() {
  const { data } = await supabase.from('processed_tickets').select('ticket_id, responder_id')
  const set = new Set()
  for (const r of data || []) {
    set.add(`${r.ticket_id}:${r.responder_id}`)
  }
  return set
}

async function getExistingLinks() {
  const { data } = await supabase
    .from('assignments')
    .select('mail_slack_link')
    .not('mail_slack_link', 'is', null)
  return new Set((data || []).map((r) => r.mail_slack_link))
}

async function getAgentIdMap() {
  const { data } = await supabase
    .from('profiles')
    .select('id, freshdesk_agent_id')
    .not('freshdesk_agent_id', 'is', null)
  const map = new Map()
  for (const p of data || []) {
    map.set(p.freshdesk_agent_id, p.id)
  }
  return map
}

async function getProfileNameMap() {
  const { data } = await supabase.from('profiles').select('id, name').eq('role', 'agent')
  const map = new Map()
  for (const p of data || []) {
    map.set(p.name.toLowerCase(), p.id)
  }
  return map
}

async function isFirstRun() {
  const { count } = await supabase.from('processed_tickets').select('*', { count: 'exact', head: true })
  return count === 0
}

async function run() {
  console.log('Polling Freshdesk for recently updated tickets...')

  const firstRun = await isFirstRun()
  const lookbackMinutes = firstRun ? 7 * 24 * 60 : 30
  const since = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString()
  console.log(firstRun ? 'First run — backfilling last 7 days' : 'Incremental run — checking last 30 minutes')

  const tickets = await fetchFreshdesk(`/tickets?updated_since=${encodeURIComponent(since)}&per_page=100&order_by=updated_at&order_type=desc`)
  console.log(`Found ${tickets.length} recently updated tickets`)

  const [agentIdToProfile, processedPairs, existingLinks, profileNameMap] = await Promise.all([
    getAgentIdMap(),
    getProcessedPairs(),
    getExistingLinks(),
    getProfileNameMap(),
  ])
  console.log(`Agents with FD ID: ${agentIdToProfile.size}, Processed pairs: ${processedPairs.size}, Existing links: ${existingLinks.size}, Name map: ${profileNameMap.size}`)

  const { data: tasks } = await supabase.from('tasks').select('id, title').eq('is_active', true)
  const taskById = new Map((tasks || []).map((t) => [t.title, t.id]))

  if (agentIdToProfile.size === 0 && profileNameMap.size === 0) {
    console.warn('No agents found in either FD ID map or name map. Nothing to do.')
    return
  }

  let created = 0
  let skipped = 0

  for (const ticket of tickets) {
    const matches = []

    // Priority 1: internal_agent_id → match by freshdesk_agent_id
    if (ticket.internal_agent_id && agentIdToProfile.has(ticket.internal_agent_id)) {
      const pairKey = `${ticket.id}:${ticket.internal_agent_id}`
      if (!processedPairs.has(pairKey)) {
        matches.push({ profileId: agentIdToProfile.get(ticket.internal_agent_id), responderValue: ticket.internal_agent_id })
      }
    }

    // Priority 2: collaborator name → flexible match against profile name
    const collabName = ticket.custom_fields?.cf_supply_support_collaborator
    if (collabName) {
      const collabLower = collabName.toLowerCase()
      let matchedProfileId = null
      for (const [name, id] of profileNameMap) {
        if (collabLower.includes(name)) {
          matchedProfileId = id
          break
        }
      }
      if (matchedProfileId && !matches.some(m => m.profileId === matchedProfileId)) {
        const pairKey = `${ticket.id}:0`
        if (!processedPairs.has(pairKey)) {
          matches.push({ profileId: matchedProfileId, responderValue: 0 })
        }
      }
    }

    if (matches.length === 0) {
      skipped++
      await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: ticket.responder_id || -1 })
      continue
    }

    const taskTitle = matchTaskType(ticket.type)
    if (!taskTitle) {
      skipped++
      for (const m of matches) {
        await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: m.responderValue })
      }
      continue
    }

    const taskId = taskById.get(taskTitle)
    if (!taskId) {
      console.warn(`  Task type "${taskTitle}" not found in DB`)
      skipped++
      for (const m of matches) {
        await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: m.responderValue })
      }
      continue
    }

    const ticketUrl = `https://${FRESHDESK_SUBDOMAIN}.freshdesk.com/a/tickets/${ticket.id}`

    if (existingLinks.has(ticketUrl)) {
      skipped++
      for (const m of matches) {
        await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: m.responderValue })
      }
      continue
    }

    for (const m of matches) {
      const { error } = await supabase.from('assignments').insert({
        agent_id: m.profileId,
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
        console.log(`  Created: ticket #${ticket.id} "${ticket.subject}" → profile ${m.profileId} (${taskTitle})`)
      }

      await supabase.from('processed_tickets').insert({ ticket_id: ticket.id, responder_id: m.responderValue })
    }
  }

  console.log(`Done. Created: ${created}, Skipped: ${skipped}`)
}

run().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
