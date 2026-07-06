import { createSign } from 'crypto'

const SHEET_ID = '15jecJzOZm_TG6w9Le4gLysJzQy9NLAWhEDzgR7sLhME'
const RANGE = encodeURIComponent("creation data dump!T:X")

const POINT4_ASSIGNEES = [
  'Jerry', 'Arshiya', 'Sayali', 'Nikhil M', 'Disha', 'Munjal',
  'Shubhi', 'Vamika', 'Shagun', 'Simran Saswani', 'Vihaan',
]

function getYesterday() {
  const now = new Date()
  const yesterday = new Date(now)
  if (now.getDay() === 1) {
    yesterday.setDate(yesterday.getDate() - 3)
  } else {
    yesterday.setDate(yesterday.getDate() - 1)
  }
  return yesterday
}

function formatDateDisplay(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function parseCellDate(val) {
  if (!val) return null
  const s = String(val).trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]))
  return null
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function computeSummary(rows) {
  const yesterdayDate = getYesterday()
  const yesterdayDisplay = formatDateDisplay(yesterdayDate)

  let point1 = 0, point2 = 0, point3 = 0, point4 = 0, point5 = 0

  for (const row of rows) {
    const colT = (row[0] || '').trim()
    const colUDate = parseCellDate(row[1])
    const colX = (row[4] || '').trim()

    const isYesterday = colUDate && isSameDay(colUDate, yesterdayDate)
    const hasAnyDate = colUDate !== null

    if (isYesterday && ['Activation on hold (Confirmed by KAM)', 'Complete Info yet to be received from the KAM', 'Created- Live/ Incomplete Info'].includes(colT)) {
      point1++
    }

    if (isYesterday && colT === 'Created- Live/ Incomplete Info') {
      point2++
    }

    if (['Property Creation WIP', 'Not Started'].includes(colT)) {
      point3++
    }

    if (hasAnyDate && colT === 'Property Creation WIP' && POINT4_ASSIGNEES.includes(colX)) {
      point4++
    }

    if (hasAnyDate && colT === 'Complete Info yet to be received from the KAM') {
      point5++
    }
  }

  return { yesterday: yesterdayDisplay, point1, point2, point3, point4, point5 }
}

async function getAccessToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set')
  const creds = JSON.parse(raw)

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const sign = createSign('RSA-SHA256')
  sign.write(`${header}.${payload}`)
  sign.end()
  const signature = sign.sign(creds.private_key, 'base64url')
  const assertion = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`Token exchange failed: ${tokenRes.status} ${errText}`)
  }

  const { access_token } = await tokenRes.json()
  return access_token
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const token = await getAccessToken()

    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!sheetRes.ok) {
      const errBody = await sheetRes.text()
      throw new Error(`Sheets API error: ${sheetRes.status} — ${errBody}`)
    }

    const json = await sheetRes.json()
    const rows = json.values || []

    const summary = computeSummary(rows)
    res.json(summary)
  } catch (err) {
    console.error('Property summary error:', err)
    res.status(500).json({ error: err.message })
  }
}
