// src/pages/CalendarPage.tsx
// Extracted from App.tsx lines 1787–1854

import { useState, useEffect } from 'react'
import { T, F } from '@/lib/tokens'
import { Card, CardHeader, Btn, Spin, Empty, Field } from '@/components/ui/primitives'
import { initGoogleCalendar, signInGoogle, isSignedIn, getUpcomingEvents, createEvent } from '@/api/gcal'

export default function CalendarPage() {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', date: '', time: '', duration: '60', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    initGoogleCalendar()
      .then(() => { setReady(true); setSignedIn(isSignedIn()) })
      .catch(() => { setReady(true) })
  }, [])

  async function handleSignIn() { try { await signInGoogle(); setSignedIn(true); load() } catch (e: any) { setError(e.message) } }
  async function load() { setLoading(true); try { setEvents(await getUpcomingEvents(10)) } catch (e: any) { setError(e.message) } finally { setLoading(false) } }
  useEffect(() => { if (signedIn) load() }, [signedIn])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const s = new Date(`${form.date}T${form.time}`)
      await createEvent({ title: form.title, startDateTime: s.toISOString(), endDateTime: new Date(s.getTime() + Number(form.duration) * 60000).toISOString(), description: form.description })
      setForm({ title: '', date: '', time: '', duration: '60', description: '' }); load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  if (!ready) return <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.textTert }}><Spin /> Loading Google Calendar…</div>
  if (!signedIn) return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
      <div style={{ fontFamily: F.display, fontSize: 22, color: T.text, marginBottom: 8 }}>Google Calendar</div>
      <div style={{ color: T.textTert, marginBottom: 24 }}>Connect to view and schedule appointments</div>
      {error && <div style={{ color: T.red, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <Btn onClick={handleSignIn}>Connect Google Calendar</Btn>
    </div>
  )

  return (
    <div className="grid-sidebar">
      <div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Upcoming Events</div>
        {error && <div style={{ color: T.red, marginBottom: 8, fontSize: 13 }}>{error}</div>}
        <Card>
          {loading ? <div style={{ padding: 20 }}><Spin /></div> : events.length === 0 ? <Empty msg="No upcoming events" /> :
            events.map(ev => {
              const dt = ev.start.dateTime || ev.start.date
              return (
                <div key={ev.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: F.body, fontSize: 14, color: T.text, fontWeight: 500 }}>{ev.summary}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, marginTop: 2 }}>{new Date(dt).toLocaleString()}</div>
                </div>
              )
            })
          }
        </Card>
      </div>
      <Card>
        <CardHeader>New Appointment</CardHeader>
        <div style={{ padding: 16 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Title" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} required />
            <Field label="Date" type="date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} required />
            <Field label="Time" type="time" value={form.time} onChange={v => setForm(f => ({ ...f, time: v }))} required />
            <Field label="Duration (min)" type="number" value={form.duration} onChange={v => setForm(f => ({ ...f, duration: v }))} />
            <Field label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
            <Btn type="submit" disabled={saving} full>{saving ? <Spin /> : 'Create Event'}</Btn>
          </form>
        </div>
      </Card>
    </div>
  )
}
