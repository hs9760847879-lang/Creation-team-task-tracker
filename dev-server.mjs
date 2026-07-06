import { createServer } from 'http'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = resolve(__dirname, '.env')
const envContent = readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  let value = trimmed.slice(eqIdx + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  process.env[key] = value
}

import handler from './api/property-summary.mjs'

function createMockRes(rawRes) {
  return {
    status(code) {
      rawRes.statusCode = code
      return this
    },
    json(data) {
      rawRes.setHeader('Content-Type', 'application/json')
      rawRes.end(JSON.stringify(data))
    },
    send(body) {
      rawRes.end(body)
    },
    setHeader(name, value) {
      rawRes.setHeader(name, value)
    },
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname === '/api/property-summary') {
    const mockRes = createMockRes(res)
    try {
      await handler(req, mockRes)
    } catch (err) {
      console.error('Dev server error:', err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  res.statusCode = 404
  res.end('Not found')
})

const PORT = 3001
server.listen(PORT, () => {
  console.log(`Dev API server running on http://localhost:${PORT}`)
})
