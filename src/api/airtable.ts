const BASE_URL = 'https://api.airtable.com/v0'
const apiKey = import.meta.env.VITE_AIRTABLE_API_KEY as string
const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID as string

function headers() {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
}

async function airtableFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE_URL}/${baseId}${path}`, { ...opts, headers: headers() })
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function getStories() {
  const data = await airtableFetch('/User%20Stories?sort%5B0%5D%5Bfield%5D=Sprint&sort%5B0%5D%5Bdirection%5D=asc')
  return (data.records ?? []).map((r: any) => ({ id: r.id, ...r.fields }))
}

export async function getSprints() {
  const data = await airtableFetch('/Sprints?sort%5B0%5D%5Bfield%5D=Name&sort%5B0%5D%5Bdirection%5D=asc')
  return (data.records ?? []).map((r: any) => ({ id: r.id, ...r.fields }))
}

export async function createStory(fields: {
  Name: string
  Priority: string
  'Story Points': number
  Sprint: string
  Status?: string
}) {
  const data = await airtableFetch('/User%20Stories', {
    method: 'POST',
    body: JSON.stringify({ fields: { Status: 'Backlog', ...fields } }),
  })
  return { id: data.id, ...data.fields }
}

export async function createSprint(fields: {
  Name: string
  'Target Date': string
  Notes?: string
}) {
  const data = await airtableFetch('/Sprints', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  })
  return { id: data.id, ...data.fields }
}
