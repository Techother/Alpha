// Vercel serverless function — Twilio SMS proxy
// Never exposes Twilio credentials to client
import { handlePreflight, requireProvider, setCorsHeaders } from './_lib/auth.js'

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (handlePreflight(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await requireProvider(req, res)
  if (!user) return

  const { to, body } = req.body
  if (!to || !body) {
    return res.status(400).json({ error: 'Missing to or body' })
  }
  const normalizedTo = typeof to === 'string' ? to.replace(/[\s().-]/g, '') : ''
  if (!/^\+[1-9]\d{7,14}$/.test(normalizedTo)) {
    return res.status(400).json({ error: 'Phone number must be in E.164 format' })
  }
  if (typeof body !== 'string' || body.length > 500) {
    return res.status(400).json({ error: 'SMS body must be 500 characters or fewer' })
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!sid || !token || !from) {
    return res.status(500).json({ error: 'Twilio credentials not configured' })
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
    const params = new URLSearchParams({ To: normalizedTo, From: from, Body: body })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message ?? 'Twilio error' })
    }
    return res.status(200).json({ success: true, sid: data.sid })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' })
  }
}
