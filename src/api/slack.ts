const API = 'https://slack.com/api'
const token = import.meta.env.VITE_SLACK_BOT_TOKEN as string

async function slackFetch(endpoint: string, body: Record<string, any>) {
  const res = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`Slack error: ${data.error}`)
  return data
}

export async function getChannelMessages(channelId: string) {
  const res = await fetch(
    `${API}/conversations.history?channel=${channelId}&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!data.ok) throw new Error(`Slack error: ${data.error}`)
  return (data.messages ?? []) as Array<{ user: string; text: string; ts: string }>
}

export async function postMessage(channelId: string, text: string) {
  return slackFetch('chat.postMessage', { channel: channelId, text })
}

export async function postPatientAlert({
  patientName,
  mrn,
  alertType,
  value,
  threshold,
  provider,
}: {
  patientName: string
  mrn: string
  alertType: string
  value: string
  threshold: string
  provider: string
}) {
  const channelId = import.meta.env.VITE_SLACK_CHANNEL_ID as string
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🚨 CardioTrack Alert', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Patient:*\n${patientName}` },
        { type: 'mrkdwn', text: `*MRN:*\n${mrn}` },
        { type: 'mrkdwn', text: `*Alert Type:*\n${alertType.replace(/_/g, ' ')}` },
        { type: 'mrkdwn', text: `*Provider:*\n${provider}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Recorded Value:* ${value}\n*Threshold:* ${threshold}`,
      },
    },
    { type: 'divider' },
  ]
  return slackFetch('chat.postMessage', {
    channel: channelId,
    text: `CardioTrack Alert: ${alertType} for ${patientName} (${mrn})`,
    blocks,
  })
}
