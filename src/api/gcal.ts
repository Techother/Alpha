// src/api/gcal.ts
// Google Calendar calls are now handled server-side via api/proxy-gcal.js.
// This client module is a thin proxy caller — no gapi, no OAuth2 browser flow.
import { supabase } from './supabase'

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

async function proxyFetch(method: string, params?: Record<string, string>, body?: unknown) {
  const token = await getToken()
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await fetch(`/api/proxy-gcal${qs}`, {
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

// No-op: service account auth is handled server-side
export async function initGoogleCalendar(): Promise<void> {
  return Promise.resolve()
}

// No-op: no browser OAuth2 flow with service accounts
export function signInGoogle(): Promise<void> {
  return Promise.resolve()
}

// Always true: proxy handles authentication
export function isSignedIn(): boolean {
  return true
}

export async function getUpcomingEvents(maxResults = 10) {
  const data = await proxyFetch('GET', { action: 'events', maxResults: String(maxResults) })
  return (data.items ?? []) as Array<{
    id: string
    summary: string
    start: { dateTime?: string; date?: string }
    end: { dateTime?: string; date?: string }
    description?: string
  }>
}

export async function createEvent({
  title,
  startDateTime,
  endDateTime,
  description,
}: {
  title: string
  startDateTime: string
  endDateTime: string
  description?: string
}) {
  return proxyFetch('POST', undefined, { action: 'createEvent', title, startDateTime, endDateTime, description })
}
