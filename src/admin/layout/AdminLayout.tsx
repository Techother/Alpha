import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/admin',          label: 'Dashboard',  end: true },
  { to: '/admin/members',  label: 'Members',    end: false },
  { to: '/admin/alerts',   label: 'Alerts',     end: false },
  { to: '/admin/backlog',  label: 'Backlog',    end: false },
  { to: '/admin/calendar', label: 'Calendar',   end: false },
  { to: '/admin/slack',    label: 'Slack',      end: false },
  { to: '/admin/setup',    label: 'Setup',      end: false },
]

export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-width)',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: 'var(--space-6) var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0,
            }}>C</div>
            <span style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-md)' }}>
              CardioTrack
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: 'var(--space-4) var(--space-2)', overflow: 'auto' }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'block',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                background: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                textDecoration: 'none',
                marginBottom: 'var(--space-1)',
                transition: 'background var(--transition-fast), color var(--transition-fast)',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
            {profile?.email ?? ''}
          </p>
          <button className="btn btn-ghost" style={{ width: '100%', fontSize: 'var(--font-size-xs)' }} onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        marginLeft: 'var(--sidebar-width)',
        flex: 1,
        padding: 'var(--space-8)',
        minHeight: '100vh',
      }}>
        <Outlet />
      </main>
    </div>
  )
}
