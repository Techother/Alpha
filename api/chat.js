// api/chat.js
// Accepts POST { system, userMessage, nextQuestion } and returns { reply: string }.
// Uses claude-haiku-4-5-20251001 via @anthropic-ai/sdk.
// All requests must carry a valid Supabase JWT.
import Anthropic from '@anthropic-ai/sdk'
import { handlePreflight, requireProvider, setCorsHeaders } from './_lib/auth.js'

const CHECKIN_SYSTEM_PROMPT = [
  'You are a compassionate cardiac care assistant.',
  'Keep responses warm, brief, and focused on the next check-in question.',
  'Do not diagnose, recommend medication changes, or provide emergency instructions beyond asking the patient to contact their care team or emergency services for urgent symptoms.',
].join(' ')

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (handlePreflight(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await requireProvider(req, res)
  if (!user) return

  const { userMessage, nextQuestion } = req.body ?? {}
  if (!userMessage) {
    return res.status(400).json({ error: 'Missing userMessage' })
  }
  if (typeof userMessage !== 'string' || userMessage.length > 1000) {
    return res.status(400).json({ error: 'userMessage must be 1000 characters or fewer' })
  }
  if (nextQuestion && (typeof nextQuestion !== 'string' || nextQuestion.length > 500)) {
    return res.status(400).json({ error: 'nextQuestion must be 500 characters or fewer' })
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
      system: CHECKIN_SYSTEM_PROMPT,
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
    return res.status(500).json({ error: 'Anthropic error' })
  }
}
