// cardiotrack/src/components/layout/TopBar.tsx
// Extracted from App.tsx lines 424–435
// Hamburger (show-mobile), clock (hide-mobile), title, sign-out

import { useState, useEffect } from 'react'
import { T, F } from '@/lib/tokens'
import { Btn } from '@/components/ui/primitives'

export function TopBar({ title, onMenu, onSignOut }: {
  title: string
  onMenu: () => void
  onSignOut: () => void
}) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="topbar">
      <button onClick={onMenu} className="show-mobile" style={{
        background: 'none', border: 'none', color: T.textSec, cursor: 'pointer',
        fontSize: 22, padding: 4, marginLeft: -4,
        minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center',
      }}>
        ☰
      </button>
      <div style={{
        flex: 1, fontFamily: F.display, fontSize: 17, color: T.text,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {title}
      </div>
      <div className="hide-mobile" style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>
        {now.toLocaleString()}
      </div>
      <Btn variant="ghost" onClick={onSignOut} style={{ fontSize: 12, padding: '6px 12px', minHeight: 36 }}>
        Sign Out
      </Btn>
    </div>
  )
}
