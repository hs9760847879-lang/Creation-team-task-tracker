const FRESHDESK_BASE = 'https://amberstudent.freshdesk.com/api/v2'

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

async function getTicketsForLookback(hours) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const perPage = 100
  const allTickets = []
  let page = 1
  while (true) {
    const tickets = await fetchFreshdesk(
      `/tickets?updated_since=${encodeURIComponent(since)}&per_page=${perPage}&page=${page}&order_by=updated_at&order_type=desc`
    )
    if (tickets.length === 0) break
    allTickets.push(...tickets)
    if (tickets.length < perPage) break
    page++
  }
  return allTickets
}

function buildAgentStats(tickets) {
  const responderCounts = {}
  const internalCounts = {}
  const typeCounts = {}
  const unmatched = []

  for (const t of tickets) {
    const rid = t.responder_id
    const iid = t.internal_agent_id
    const type = t.type || 'UNKNOWN'

    if (rid) responderCounts[rid] = (responderCounts[rid] || 0) + 1
    if (iid) internalCounts[iid] = (internalCounts[iid] || 0) + 1
    typeCounts[type] = (typeCounts[type] || 0) + 1

    if (type && ['Commission Update', 'Policy Update', 'Property Creation Request'].includes(type)) {
      unmatched.push({
        id: t.id,
        type,
        subject: t.subject,
        responder_id: rid,
        internal_agent_id: iid,
        updated_at: t.updated_at,
      })
    }
  }

  return { responderCounts, internalCounts, typeCounts, unmatched: unmatched.slice(0, 50) }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const hours = parseInt(url.searchParams.get('hours') || '24', 10)
    const mode = url.searchParams.get('mode') || 'stats'

    const tickets = await getTicketsForLookback(hours)

    if (mode === 'tickets') {
      const ticketIds = url.searchParams.get('ids')
      if (ticketIds) {
        const ids = ticketIds.split(',').map(Number)
        const filtered = tickets.filter(t => ids.includes(t.id))
        res.json({ count: filtered.length, tickets: filtered.map(t => ({
          id: t.id, type: t.type, subject: t.subject,
          responder_id: t.responder_id, internal_agent_id: t.internal_agent_id,
          group_id: t.group_id, status: t.status,
          created_at: t.created_at, updated_at: t.updated_at,
        })) })
        return
      }
      res.json({ count: tickets.length, tickets: tickets.map(t => ({
        id: t.id, type: t.type, subject: t.subject,
        responder_id: t.responder_id, internal_agent_id: t.internal_agent_id,
        group_id: t.group_id, status: t.status,
        created_at: t.created_at, updated_at: t.updated_at,
      })) })
      return
    }

    const stats = buildAgentStats(tickets)
    res.json({
      lookbackHours: hours,
      totalTickets: tickets.length,
      ...stats,
    })
  } catch (err) {
    console.error('Maintenance API error:', err)
    res.status(500).json({ error: err.message })
  }
}
