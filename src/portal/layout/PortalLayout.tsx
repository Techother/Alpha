import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const TAB_ITEMS = [
  { to: '/my-health',          label: 'Home',     icon: '🏠', end: true },
  { to: '/my-health/checkin',  label: 'Check-In', icon: '✓',  end: false },
  { to: '/my-health/trends',   label: 'Trends',   icon: '📈', end: false },
  { to: '/my-health/alerts',   label: 'Alerts',   icon: '🔔', end: false },
  { to: '/my-health/settings', label: 'Settings', icon: '⚙',  end: false },
]

export function PortalLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/my-health/login', { replace: true })
  }

  return (
    <div style={{
      maxWidth: 'var(--portal-max-width)',
      margin: '0 auto',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      background: 'var(--color-bg)',
    }}>
      {/* Top bar */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ color: 'var(--color-hf)', fontSize: 18 }}>♥</span>
          <span style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-md)', color: 'var(--color-primary)' }}>
            My Health
          </span>
        </div>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-3)' }}
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </header>

      {/* Page content */}
      <main style={{
        flex: 1,
        padding: 'var(--space-4)',
        paddingBottom: 'calc(var(--portal-tab-height) + var(--space-4))',
        overflowY: 'auto',
      }}>
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 'var(--portal-max-width)',
        height: 'var(--portal-tab-height)',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        zIndex: 10,
      }}>
        {TAB_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              textDecoration: 'none',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-faint)',
              fontSize: 9,
              fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
              transition: 'color var(--transition-fast)',
            })}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
