// src/api/airtable.ts
// Calls /api/proxy-airtable — no Airtable credentials in the browser.
// Identical export signatures preserved so no callers need to change.
import { supabase } from './supabase'

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

async function proxyFetch(method: string, resource: string, body?: { fields: Record<string, unknown> }) {
  const token = await getToken()
  const res = await fetch(`/api/proxy-airtable?resource=${resource}`, {
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

export async function getStories(): Promise<Array<{ id: string; [key: string]: any }>> {
  const data = await proxyFetch('GET', 'stories')
  return (data.records ?? []).map((r: any) => ({ id: r.id, ...r.fields }))
}

export async function getSprints(): Promise<Array<{ id: string; [key: string]: any }>> {
  const data = await proxyFetch('GET', 'sprints')
  return (data.records ?? []).map((r: any) => ({ id: r.id, ...r.fields }))
}

export async function createStory(fields: {
  Name: string
  Priority: string
  'Story Points': number
  Sprint: string
  Status?: string
}): Promise<{ id: string; [key: string]: any }> {
  const data = await proxyFetch('POST', 'stories', { fields: fields as Record<string, unknown> })
  return { id: data.id, ...data.fields }
}

export async function createSprint(fields: {
  Name: string
  'Target Date': string
  Notes?: string
}): Promise<{ id: string; [key: string]: any }> {
  const data = await proxyFetch('POST', 'sprints', { fields: fields as Record<string, unknown> })
  return { id: data.id, ...data.fields }
}
