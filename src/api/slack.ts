// src/api/slack.ts
// Calls /api/proxy-slack — no Slack credentials in the browser.
// Identical export signatures preserved so no callers need to change.
import { supabase } from './supabase'

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

async function proxyFetch(method: string, params?: Record<string, string>, body?: unknown) {
  const token = await getToken()
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await fetch(`/api/proxy-slack${qs}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `Proxy error ${res.status}`)
  }
  return res.json()
}

export async function getChannelMessages(channelId: string) {
  const data = await proxyFetch('GET', { action: 'messages', channelId })
  return (data.messages ?? []) as Array<{ user: string; text: string; ts: string }>
}

export async function postMessage(channelId: string, text: string) {
  return proxyFetch('POST', undefined, { action: 'postMessage', channelId, text })
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
  return proxyFetch('POST', undefined, {
    action: 'postPatientAlert',
    patientName,
    mrn,
    alertType,
    value,
    threshold,
    provider,
  })
}
