import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Role } from '@/api/supabase.types'

interface RequireRoleProps {
  role: Role
  loginPath: string
  children: ReactNode
}

export function RequireRole({ role, loginPath, children }: RequireRoleProps) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="spinner-fullscreen">
        <div className="spinner" />
      </div>
    )
  }

  if (!session || !profile) {
    return <Navigate to={loginPath} replace />
  }

  // Authenticated but wrong zone — redirect to correct zone
  if (profile.role !== role) {
    const redirect = profile.role === 'provider' ? '/admin' : '/my-health'
    return <Navigate to={redirect} replace />
  }

  return <>{children}</>
}
