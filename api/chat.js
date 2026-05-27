// api/chat.js
// Accepts POST { system, userMessage, nextQuestion } and returns { reply: string }.
// Uses claude-haiku-4-5-20251001 via @anthropic-ai/sdk.
// All requests must carry a valid Supabase JWT.
import Anthropic from '@anthropic-ai/sdk'
import { handlePreflight, setCorsHeaders, verifyJwt } from './_lib/auth.js'

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (handlePreflight(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await verifyJwt(req, res)
  if (!user) return // verifyJwt already sent 401

  const { system, userMessage, nextQuestion } = req.body ?? {}
  if (!userMessage) {
    return res.status(400).json({ error: 'Missing userMessage' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: system ?? undefined,
      messages: [
        {
          role: 'user',
          content: nextQuestion
            ? `${userMessage}\n\n${nextQuestion}`.trim()
            : userMessage,
        },
      ],
    })
    return res.status(200).json({ reply: message.content[0].text })
  } catch (err) {
    return res.status(500).json({ error: err.message ?? 'Anthropic error' })
  }
}
