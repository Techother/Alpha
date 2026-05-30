// src/pages/BacklogPage.tsx
// Extracted from App.tsx lines 1703–1783

import { useState } from 'react'
import { T, F } from '@/lib/tokens'
import { Card, CardHeader, Btn, Tag, Spin, Field } from '@/components/ui/primitives'
import { useAsync } from '@/lib/hooks'
import { getStories, getSprints, createStory, createSprint } from '@/api/airtable'
import { postMessage } from '@/api/slack'

export default function BacklogPage() {
  const { data: stories, loading: sL, error: sE, refresh: sR } = useAsync(getStories, [])
  const { data: sprints, loading: spL, refresh: spR } = useAsync(getSprints, [])
  const [sf, setSf] = useState({ Name: '', Priority: 'Medium', 'Story Points': '3', Sprint: '' })
  const [pf, setPf] = useState({ Name: '', 'Target Date': '', Notes: '' })
  const [saving, setSaving] = useState(false)
  const [postId, setPostId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  async function addStory(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try { await createStory({ ...sf, 'Story Points': Number(sf['Story Points']) }); sR(); setSf({ Name: '', Priority: 'Medium', 'Story Points': '3', Sprint: '' }); setActionError('') }
    catch (e: any) { setActionError(e.message) } finally { setSaving(false) }
  }

  async function addSprint(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try { await createSprint(pf); spR(); setPf({ Name: '', 'Target Date': '', Notes: '' }); setActionError('') }
    catch (e: any) { setActionError(e.message) } finally { setSaving(false) }
  }

  async function postSprint(sp: any) {
    setPostId(sp.id)
    try {
      await postMessage('', `*Sprint: ${sp.Name}*\nTarget: ${sp['Target Date'] ?? '—'}\nServer: ${sp['Server Points'] ?? 0} pts | Client: ${sp['Client Points'] ?? 0} pts\n${sp.Notes ?? ''}`)
      setActionError('')
    } catch (e: any) { setActionError(e.message) } finally { setPostId(null) }
  }

  const grouped: Record<string, any[]> = {}
  for (const s of (stories ?? [])) { const sp = s.Sprint ?? 'Unassigned'; grouped[sp] = grouped[sp] ?? []; grouped[sp].push(s) }

  return (
    <div className="grid-sidebar">
      <div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>User Stories</div>
        {sE && <div style={{ color: T.red, marginBottom: 8, fontSize: 13 }}>Airtable: {sE}</div>}
        {sL ? <Spin /> : Object.entries(grouped).map(([sp, items]) => (
          <div key={sp} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: F.display, fontSize: 16, color: T.text, marginBottom: 8 }}>{sp}</div>
            <Card>
              {items.map((s: any) => (
                <div key={s.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${T.border}`, alignItems: 'center' }}>
                  <div style={{ flex: 1, fontFamily: F.body, fontSize: 13, color: T.text }}>{s.Name}</div>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert }}>{s.Priority}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: T.blue }}>{s['Story Points']}pt</span>
                  <Tag>{s.Status ?? 'Backlog'}</Tag>
                </div>
              ))}
            </Card>
          </div>
        ))}
        <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1, margin: '20px 0 12px' }}>Sprints</div>
        {spL ? <Spin /> : (sprints ?? []).map((sp: any) => (
          <div key={sp.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.body, fontSize: 14, color: T.text, fontWeight: 500 }}>{sp.Name}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, marginTop: 2 }}>Target: {sp['Target Date'] ?? '—'} · Srv: {sp['Server Points'] ?? 0} · Cli: {sp['Client Points'] ?? 0}</div>
            </div>
            <Btn variant="ghost" onClick={() => postSprint(sp)} disabled={postId === sp.id} style={{ fontSize: 12, minHeight: 36 }}>{postId === sp.id ? <Spin /> : 'Slack'}</Btn>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <CardHeader>New Story</CardHeader>
          <div style={{ padding: 16 }}>
            <form onSubmit={addStory} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Title" value={sf.Name} onChange={v => setSf(f => ({ ...f, Name: v }))} required />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>Priority</span>
                <select value={sf.Priority} onChange={e => setSf(f => ({ ...f, Priority: e.target.value }))
                } style={{ background: T.subtle, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 14, padding: '11px 14px', minHeight: 44 }}>
                  {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
                </select>
              </label>
              <Field label="Story Points" type="number" value={sf['Story Points']} onChange={v => setSf(f => ({ ...f, 'Story Points': v }))} />
              <Field label="Sprint" value={sf.Sprint} onChange={v => setSf(f => ({ ...f, Sprint: v }))} />
              <Btn type="submit" disabled={saving} full>{saving ? <Spin /> : 'Add Story'}</Btn>
              {actionError && <div style={{ color: T.red, fontSize: 12, fontFamily: F.body, marginTop: 4 }}>{actionError}</div>}
            </form>
          </div>
        </Card>
        <Card>
          <CardHeader>New Sprint</CardHeader>
          <div style={{ padding: 16 }}>
            <form onSubmit={addSprint} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Sprint Name" value={pf.Name} onChange={v => setPf(f => ({ ...f, Name: v }))} required />
              <Field label="Target Date" type="date" value={pf['Target Date']} onChange={v => setPf(f => ({ ...f, 'Target Date': v }))} />
              <Field label="Notes" value={pf.Notes} onChange={v => setPf(f => ({ ...f, Notes: v }))} />
              <Btn type="submit" disabled={saving} full>{saving ? <Spin /> : 'Create Sprint'}</Btn>
            </form>
          </div>
        </Card>
      </div>
    </div>
  )
}
