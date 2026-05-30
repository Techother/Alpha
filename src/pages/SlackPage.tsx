// src/pages/SlackPage.tsx
// Extracted from App.tsx lines 1858–1896

import { useState } from 'react'
import { T, F } from '@/lib/tokens'
import { Card, CardHeader, Btn, Spin, Empty } from '@/components/ui/primitives'
import { useAsync } from '@/lib/hooks'
import { getChannelMessages, postMessage } from '@/api/slack'

export default function SlackPage() {
  const { data: messages, loading, error, refresh } = useAsync(() => getChannelMessages(''), [])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState('')

  async function handleSend(e: React.FormEvent) {
    e.preventDefault(); setSending(true); setSendErr('')
    try { await postMessage('', text); setText(''); refresh() }
    catch (e: any) { setSendErr(e.message) } finally { setSending(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <div style={{ color: T.red, fontSize: 13 }}>Slack: {error}</div>}
      <Card>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>Channel Messages</span>
          <Btn variant="ghost" onClick={refresh} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>Refresh</Btn>
        </div>
        {loading ? <div style={{ padding: 20 }}><Spin /></div> : (messages ?? []).length === 0 ? <Empty msg="No messages" /> :
          (messages as any[]).map((m, i) => (
            <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: T.blue }}>{m.user ?? 'bot'}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textSec }}>{new Date(Number(m.ts) * 1000).toLocaleString()}</span>
              </div>
              <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          ))
        }
      </Card>
      <Card>
        <CardHeader>Send Message</CardHeader>
        <div style={{ padding: 16 }}>
          {sendErr && <div style={{ color: T.red, fontSize: 13, marginBottom: 8 }}>{sendErr}</div>}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…"
              style={{ flex: 1, background: T.subtle, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 15, padding: '10px 14px', outline: 'none', minHeight: 44 }} />
            <Btn type="submit" disabled={sending || !text.trim()} style={{ minWidth: 70 }}>{sending ? <Spin /> : 'Send'}</Btn>
          </form>
        </div>
      </Card>
    </div>
  )
}
