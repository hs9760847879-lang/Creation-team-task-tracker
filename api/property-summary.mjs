import { createPrivateKey, sign } from 'crypto'

const SHEET_ID = '15jecJzOZm_TG6w9Le4gLysJzQy9NLAWhEDzgR7sLhME'
const RANGE = encodeURIComponent("creation data dump!T:X")
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly'

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
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    if (!isNaN(d.getTime())) return d
  }
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m2) {
    const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]))
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function createJwt(clientEmail, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: clientEmail,
    scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const message = `${b64(header)}.${b64(claim)}`

  const key = createPrivateKey(privateKey)
  const signature = sign(null, Buffer.from(message), key).toString('base64url')

  return `${message}.${signature}`
}

async function getAccessToken(cred) {
  const jwt = createJwt(cred.client_email, cred.private_key)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Failed to get access token: ${JSON.stringify(data)}`)
  return data.access_token
}

const POINT4_ASSIGNEES = [
  'Jerry', 'Arshiya', 'Sayali', 'Nikhil M', 'Disha', 'Munjal',
  'Shubhi', 'Vamika', 'Shagun', 'Simran Saswani', 'Vihaan',
]

export default async function handler(req, res) {
  try {
    const credJson = process.env.CREDENTIAL_JSON
    if (!credJson) {
      return res.status(500).json({ error: 'CREDENTIAL_JSON env var not set' })
    }
    const cred = JSON.parse(credJson)

    const token = await getAccessToken(cred)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?access_token=${token}`
    const response = await fetch(url)
    const data = await response.json()

    if (!data.values || data.values.length < 2) {
      return res.status(200).json({ yesterday: formatDateDisplay(getYesterday()), point1: 0, point2: 0, point3: 0, point4: 0, point5: 0 })
    }

    const rows = data.values
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

    return res.status(200).json({
      yesterday: yesterdayDisplay,
      point1,
      point2,
      point3,
      point4,
      point5,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
