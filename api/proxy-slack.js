// api/proxy-slack.js
// Handles 3 Slack operations: GET messages, POST postMessage, POST postPatientAlert.
// All requests must carry a valid Supabase JWT.
import { handlePreflight, requireProvider, setCorsHeaders } from './_lib/auth.js'

const SLACK_API = 'https://slack.com/api'

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (handlePreflight(req, res)) return

  const user = await requireProvider(req, res)
  if (!user) return

  const token = process.env.SLACK_BOT_TOKEN
  const defaultChannelId = process.env.SLACK_CHANNEL_ID
  if (!token) {
    return res.status(500).json({ error: 'Slack credentials not configured' })
  }

  const authHeader = { Authorization: `Bearer ${token}` }

  try {
    // GET: fetch channel message history
    if (req.method === 'GET') {
      const action = req.query.action
      if (action === 'messages') {
        const channelId = req.query.channelId || defaultChannelId
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' })
        if (channelId !== defaultChannelId) return res.status(403).json({ error: 'Channel not allowed' })
        const r = await fetch(
          `${SLACK_API}/conversations.history?channel=${encodeURIComponent(channelId)}&limit=20`,
          { headers: authHeader }
        )
        const data = await r.json()
        if (!data.ok) return res.status(400).json({ error: data.error ?? 'Slack error' })
        return res.status(200).json({ messages: data.messages ?? [] })
      }
      return res.status(400).json({ error: 'Unknown action. Use ?action=messages' })
    }

    if (req.method === 'POST') {
      const { action } = req.body ?? {}

      if (action === 'postMessage') {
        const { channelId: rawChannelId, text } = req.body
        const channelId = rawChannelId || defaultChannelId
        if (!channelId || !text) return res.status(400).json({ error: 'Missing channelId or text' })
        if (channelId !== defaultChannelId) return res.status(403).json({ error: 'Channel not allowed' })
        if (typeof text !== 'string' || text.length > 3000) return res.status(400).json({ error: 'Message is too long' })
        const r = await fetch(`${SLACK_API}/chat.postMessage`, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: channelId, text }),
        })
        const data = await r.json()
        if (!data.ok) return res.status(400).json({ error: data.error ?? 'Slack error' })
        return res.status(200).json(data)
      }

      if (action === 'postPatientAlert') {
        const { patientName, mrn, alertType, value, threshold, provider } = req.body
        if (!patientName || !mrn || !alertType) {
          return res.status(400).json({ error: 'Missing required alert fields' })
        }
        const channelId = req.body.channelId || defaultChannelId
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' })
        if (channelId !== defaultChannelId) return res.status(403).json({ error: 'Channel not allowed' })

        // Block Kit layout preserved exactly from existing src/api/slack.ts
        const blocks = [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🚨 MKL Health Alert', emoji: true },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Patient:*\n${patientName}` },
              { type: 'mrkdwn', text: `*MRN:*\n${mrn}` },
              { type: 'mrkdwn', text: `*Alert Type:*\n${alertType.replace(/_/g, ' ')}` },
              { type: 'mrkdwn', text: `*Provider:*\n${provider ?? ''}` },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Recorded Value:* ${value ?? ''}\n*Threshold:* ${threshold ?? ''}`,
            },
          },
          { type: 'divider' },
        ]

        const r = await fetch(`${SLACK_API}/chat.postMessage`, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelId,
            text: `MKL Health Alert: ${alertType} for ${patientName} (${mrn})`,
            blocks,
          }),
        })
        const data = await r.json()
        if (!data.ok) return res.status(400).json({ error: data.error ?? 'Slack error' })
        return res.status(200).json(data)
      }

      return res.status(400).json({ error: 'Unknown action. Use postMessage or postPatientAlert' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' })
  }
}
