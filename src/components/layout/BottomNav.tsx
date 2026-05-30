// cardiotrack/src/components/layout/BottomNav.tsx
// Extracted from App.tsx lines 406–420
// Section derived from useLocation().pathname — NOT passed as prop from parent

import { useNavigate, useLocation } from 'react-router-dom'
import { T, F } from '@/lib/tokens'
import { NAV, type Section } from './Sidebar'

export function BottomNav({ alertCount }: { alertCount: number }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section: Section = (pathname.slice(1) as Section) || 'dashboard'

  // 5 primary items: dashboard, patients, alerts, billing, backlog
  const primary = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[6]]

  return (
    <div className="bottom-nav">
      {primary.map(n => (
        <button key={n.key} onClick={() => navigate('/' + n.key)} style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 3, padding: '8px 4px',
          background: 'none', border: 'none',
          color: section === n.key ? T.blue : T.textTert,
          cursor: 'pointer', position: 'relative',
          fontFamily: F.body, fontSize: 10, minHeight: 56,
          WebkitTapHighlightColor: 'transparent',
        }}>
          <span style={{ fontSize: 20 }}>{n.icon}</span>
          {n.label.slice(0, 6)}
          {n.key === 'alerts' && alertCount > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: '50%', marginRight: -18,
              background: T.red, color: '#fff',
              borderRadius: 8, fontSize: 9, padding: '1px 5px', fontFamily: F.mono,
            }}>
              {alertCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
