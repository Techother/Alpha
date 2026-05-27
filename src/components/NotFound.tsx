import { useNavigate } from 'react-router-dom'

// Token duplication is intentional for Phase 6.
// Phase 7 (COMP-01) extracts T/F to src/lib/tokens.ts — do NOT export from App.tsx now.
const T = {
  bg: '#080C10', s1: '#0D1117', s2: '#111820', s3: '#16202C',
  border: '#1E2D3D', red: '#E53E3E', amber: '#DD6B20', green: '#38A169',
  teal: '#0BC5EA', blue: '#4299E1', text: '#E2E8F0', mid: '#718096', dim: '#2D3748',
}
const F = { display: "'Fraunces', serif", body: "'DM Sans', sans-serif", mono: "'DM Mono', monospace" }

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100dvh', background: T.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 16px', color: T.mid,
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>?</div>
      <div style={{
        fontFamily: F.display, fontSize: 20, fontWeight: 300,
        color: T.text, marginBottom: 16,
      }}>
        Page not found
      </div>
      <div style={{
        fontFamily: F.body, fontSize: 14, color: T.mid,
        lineHeight: 1.5, maxWidth: 360, margin: '0 auto 24px', textAlign: 'center',
      }}>
        The address doesn't exist in Alpha Health Track. Check the URL or return to the dashboard.
      </div>
      {/* Do NOT reflect pathname — XSS/STRIDE mitigation: no reflected path content per UI-SPEC */}
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          fontFamily: F.body, fontSize: 14, fontWeight: 500,
          padding: '10px 18px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid transparent',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: T.teal, color: '#000', minHeight: 44,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        Go to Dashboard
      </button>
    </div>
  )
}
