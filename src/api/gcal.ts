declare const gapi: any

const CLIENT_ID = import.meta.env.VITE_GCAL_CLIENT_ID as string
const API_KEY = import.meta.env.VITE_GCAL_API_KEY as string
const SCOPES = 'https://www.googleapis.com/auth/calendar'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'

let gapiInited = false
let tokenClient: any = null

export async function initGoogleCalendar(): Promise<void> {
  return new Promise((resolve) => {
    gapi.load('client', async () => {
      await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] })
      gapiInited = true
      resolve()
    })
  })
}

export function signInGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp: any) => {
          if (resp.error) { reject(new Error(resp.error)); return }
          resolve()
        },
      })
    }
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

export function isSignedIn(): boolean {
  return gapiInited && !!gapi.client.getToken()
}

export async function getUpcomingEvents(maxResults = 10) {
  const res = await gapi.client.calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    showDeleted: false,
    singleEvents: true,
    maxResults,
    orderBy: 'startTime',
  })
  return (res.result.items ?? []) as Array<{
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
  const res = await gapi.client.calendar.events.insert({
    calendarId: 'primary',
    resource: {
      summary: title,
      description,
      start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    },
  })
  return res.result
}
