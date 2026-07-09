// api/proxy-gcal.js
// Handles 2 Google Calendar operations via service account auth.
// Uses Node.js crypto for RS256 JWT signing — no googleapis package.
// All requests must carry a valid Supabase JWT.
import crypto from 'crypto'
import { handlePreflight, requireProvider, setCorsHeaders } from './_lib/auth.js'

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

// Fetch a fresh Google OAuth2 access token using service account JWT.
// Always fetches a new token per request — do not cache at module level.
async function getGoogleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id }))
  const payload = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(sa.private_key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? 'Failed to get Google access token')
  }
  return tokenData.access_token
}

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (handlePreflight(req, res)) return

  const user = await requireProvider(req, res)
  if (!user) return

  const gcalJson = process.env.GCAL_SERVICE_ACCOUNT_JSON
  const calendarId = process.env.GCAL_CALENDAR_ID
  if (!gcalJson || !calendarId) {
    return res.status(500).json({ error: 'Google Calendar credentials not configured' })
  }

  let sa
  try {
    sa = JSON.parse(gcalJson)
  } catch {
    return res.status(500).json({ error: 'GCAL_SERVICE_ACCOUNT_JSON is not valid JSON' })
  }

  try {
    const accessToken = await getGoogleAccessToken(sa)
    const gcalBase = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`
    const authHeader = { Authorization: `Bearer ${accessToken}` }

    // GET: list upcoming events
    if (req.method === 'GET') {
      const action = req.query.action
      if (action === 'events') {
        const maxResults = parseInt(req.query.maxResults ?? '10', 10)
        if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 50) {
          return res.status(400).json({ error: 'maxResults must be between 1 and 50' })
        }
        const params = new URLSearchParams({
          timeMin: new Date().toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: String(maxResults),
        })
        const r = await fetch(`${gcalBase}/events?${params}`, { headers: authHeader })
        const data = await r.json()
        if (!r.ok) return res.status(r.status).json({ error: data.error?.message ?? 'Google Calendar error' })
        return res.status(200).json({ items: data.items ?? [] })
      }
      return res.status(400).json({ error: 'Unknown action. Use ?action=events' })
    }

    // POST: create event
    if (req.method === 'POST') {
      const { action, title, startDateTime, endDateTime, description } = req.body ?? {}
      if (action === 'createEvent') {
        if (!title || !startDateTime || !endDateTime) {
          return res.status(400).json({ error: 'Missing required fields: title, startDateTime, endDateTime' })
        }
        if (typeof title !== 'string' || title.length > 200) {
          return res.status(400).json({ error: 'Title is too long' })
        }
        if (description && (typeof description !== 'string' || description.length > 2000)) {
          return res.status(400).json({ error: 'Description is too long' })
        }
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
        const r = await fetch(`${gcalBase}/events`, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: title,
            description: description ?? undefined,
            start: { dateTime: startDateTime, timeZone },
            end: { dateTime: endDateTime, timeZone },
          }),
        })
        const data = await r.json()
        if (!r.ok) return res.status(r.status).json({ error: data.error?.message ?? 'Google Calendar error' })
        return res.status(200).json(data)
      }
      return res.status(400).json({ error: 'Unknown action. Use createEvent' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' })
  }
}
