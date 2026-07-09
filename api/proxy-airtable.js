// api/proxy-airtable.js
// Handles 4 Airtable operations via ?resource= query param.
// All requests must carry a valid Supabase JWT.
import { handlePreflight, requireProvider, setCorsHeaders } from './_lib/auth.js'

const AIRTABLE_BASE = 'https://api.airtable.com/v0'

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (handlePreflight(req, res)) return

  const user = await requireProvider(req, res)
  if (!user) return

  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) {
    return res.status(500).json({ error: 'Airtable credentials not configured' })
  }

  const resource = req.query.resource
  const authHeader = { Authorization: `Bearer ${apiKey}` }

  try {
    if (req.method === 'GET') {
      if (resource === 'stories') {
        const r = await fetch(
          `${AIRTABLE_BASE}/${baseId}/User%20Stories?sort%5B0%5D%5Bfield%5D=Sprint&sort%5B0%5D%5Bdirection%5D=asc`,
          { headers: authHeader }
        )
        const data = await r.json()
        if (!r.ok) return res.status(r.status).json({ error: data.error?.message ?? 'Airtable error' })
        return res.status(200).json(data)
      }
      if (resource === 'sprints') {
        const r = await fetch(
          `${AIRTABLE_BASE}/${baseId}/Sprints?sort%5B0%5D%5Bfield%5D=Name&sort%5B0%5D%5Bdirection%5D=asc`,
          { headers: authHeader }
        )
        const data = await r.json()
        if (!r.ok) return res.status(r.status).json({ error: data.error?.message ?? 'Airtable error' })
        return res.status(200).json(data)
      }
      return res.status(400).json({ error: 'Unknown resource. Use ?resource=stories or ?resource=sprints' })
    }

    if (req.method === 'POST') {
      if (resource === 'stories') {
        const r = await fetch(`${AIRTABLE_BASE}/${baseId}/User%20Stories`, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { Status: 'Backlog', ...req.body?.fields } }),
        })
        const data = await r.json()
        if (!r.ok) return res.status(r.status).json({ error: data.error?.message ?? 'Airtable error' })
        return res.status(200).json(data)
      }
      if (resource === 'sprints') {
        const r = await fetch(`${AIRTABLE_BASE}/${baseId}/Sprints`, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: req.body?.fields }),
        })
        const data = await r.json()
        if (!r.ok) return res.status(r.status).json({ error: data.error?.message ?? 'Airtable error' })
        return res.status(200).json(data)
      }
      return res.status(400).json({ error: 'Unknown resource. Use ?resource=stories or ?resource=sprints' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' })
  }
}
