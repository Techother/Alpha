import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AdminLogin } from '@/admin/Login'
import { AdminLayout } from '@/admin/layout/AdminLayout'
import { Dashboard } from '@/admin/pages/Dashboard'
import { Members } from '@/admin/pages/Members'
import { Alerts } from '@/admin/pages/Alerts'
import { Backlog } from '@/admin/pages/Backlog'
import { Calendar } from '@/admin/pages/Calendar'
import { SlackPanel } from '@/admin/pages/SlackPanel'
import { Setup } from '@/admin/pages/Setup'

import { PortalLogin } from '@/portal/Login'
import { PortalLayout } from '@/portal/layout/PortalLayout'
import { PortalHome } from '@/portal/pages/PortalHome'
import { PortalCheckin } from '@/portal/pages/PortalCheckin'
import { PortalTrends } from '@/portal/pages/PortalTrends'
import { PortalAlerts } from '@/portal/pages/PortalAlerts'
import { PortalMedications } from '@/portal/pages/PortalMedications'
import { PortalSettings } from '@/portal/pages/PortalSettings'

import { RequireRole } from './RequireRole'

export const router = createBrowserRouter([
  // Root → admin login
  {
    path: '/',
    element: <Navigate to="/admin/login" replace />,
  },

  // ── Admin zone ─────────────────────────────
  {
    path: '/admin/login',
    element: <AdminLogin />,
  },
  {
    path: '/admin',
    element: (
      <RequireRole role="provider" loginPath="/admin/login">
        <AdminLayout />
      </RequireRole>
    ),
    children: [
      { index: true,          element: <Dashboard /> },
      { path: 'members',      element: <Members /> },
      { path: 'alerts',       element: <Alerts /> },
      { path: 'backlog',      element: <Backlog /> },
      { path: 'calendar',     element: <Calendar /> },
      { path: 'slack',        element: <SlackPanel /> },
      { path: 'setup',        element: <Setup /> },
    ],
  },

  // ── Portal zone ────────────────────────────
  {
    path: '/my-health/login',
    element: <PortalLogin />,
  },
  {
    path: '/my-health',
    element: (
      <RequireRole role="patient" loginPath="/my-health/login">
        <PortalLayout />
      </RequireRole>
    ),
    children: [
      { index: true,           element: <PortalHome /> },
      { path: 'checkin',       element: <PortalCheckin /> },
      { path: 'trends',        element: <PortalTrends /> },
      { path: 'alerts',        element: <PortalAlerts /> },
      { path: 'medications',   element: <PortalMedications /> },
      { path: 'settings',      element: <PortalSettings /> },
    ],
  },
])
