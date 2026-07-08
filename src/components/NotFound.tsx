import { useNavigate } from 'react-router-dom'
import { T, F } from '@/lib/tokens'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100dvh', background: T.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 16px', color: T.textSec,
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>?</div>
      <div style={{
        fontFamily: F.display, fontSize: 20, fontWeight: 300,
        color: T.text, marginBottom: 16,
      }}>
        Page not found
      </div>
      <div style={{
        fontFamily: F.body, fontSize: 14, color: T.textSec,
        lineHeight: 1.5, maxWidth: 360, margin: '0 auto 24px', textAlign: 'center',
      }}>
        The address doesn't exist in MKL Health. Check the URL or return to the dashboard.
      </div>
      {/* Do NOT reflect pathname — XSS/STRIDE mitigation: no reflected path content per UI-SPEC */}
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          fontFamily: F.body, fontSize: 14, fontWeight: 500,
          padding: '10px 18px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid transparent',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: T.blue, color: '#FFFFFF', minHeight: 44,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        Go to Dashboard
      </button>
    </div>
  )
}
