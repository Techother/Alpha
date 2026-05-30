// src/pages/SetupPage.tsx
// Extracted from App.tsx lines 1900–1955

import { useState, useEffect } from 'react'
import { T, F } from '@/lib/tokens'
import { Card, CardHeader, Tag } from '@/components/ui/primitives'
import { FEATURES } from '@/config'
import { isSignedIn } from '@/api/gcal'

export default function SetupPage() {
  const [gcalOk, setGcalOk] = useState(false)
  useEffect(() => { setGcalOk(isSignedIn()) }, [])

  const integrations = [
    { name: 'Supabase',        ok: !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY, status: 'Database & Auth',     link: 'https://supabase.com/dashboard' },
    { name: 'Airtable',        ok: true,                                                                              status: 'Product Backlog',     link: 'https://airtable.com/account' },
    { name: 'Slack',           ok: true,                                                                              status: 'Alerts & Messaging',  link: 'https://api.slack.com/apps' },
    { name: 'Google Calendar', ok: gcalOk,                                                                            status: 'Appointments',        link: 'https://console.cloud.google.com' },
    { name: 'Anthropic Proxy', ok: true,                                                                              status: 'AI Check-in Chatbot', link: 'https://docs.anthropic.com' },
    { name: 'Twilio',          ok: true,                                                                              status: 'SMS Check-ins',       link: 'https://console.twilio.com' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <CardHeader>Integration Status</CardHeader>
        {integrations.map(intg => (
          <div key={intg.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: intg.ok ? T.green : T.textTert, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.body, fontSize: 14, color: T.text, fontWeight: 500 }}>{intg.name}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, marginTop: 2 }}>{intg.status}</div>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: intg.ok ? T.green : T.textTert, whiteSpace: 'nowrap' }}>{intg.ok ? 'Connected' : 'Not set'}</div>
            <a href={intg.link} target="_blank" rel="noreferrer" style={{ fontFamily: F.mono, fontSize: 11, color: T.blue, textDecoration: 'none', whiteSpace: 'nowrap' }}>Setup →</a>
          </div>
        ))}
      </Card>

      <Card>
        <CardHeader>Feature Status</CardHeader>
        {Object.entries(FEATURES).map(([key, enabled]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: enabled ? T.green : T.textTert, flexShrink: 0 }} />
            <div style={{ flex: 1, fontFamily: F.mono, fontSize: 12, color: enabled ? T.text : T.textTert }}>{key.replace(/_/g, ' ')}</div>
            {enabled
              ? <Tag type="green">On</Tag>
              : <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert }}>Coming in v2.1</span>
            }
          </div>
        ))}
      </Card>

      <Card>
        <CardHeader>Quick Start</CardHeader>
        <pre style={{ fontFamily: F.mono, fontSize: 12, color: T.textTert, padding: 16, margin: 0, lineHeight: 1.8, overflowX: 'auto' }}>
{`1. cp .env.example .env.local
2. Fill in VITE_SUPABASE_URL + ANON_KEY
3. Run supabase/schema.sql in SQL editor
4. Add Airtable / Slack / Google creds
5. Deploy Anthropic proxy (optional)
6. npm run dev`}
        </pre>
      </Card>
    </div>
  )
}
