// src/router.tsx — nested layout route with lazy-loaded pages
// RootLayout is the pathless parent. All clinical routes are children.
// Per CONTEXT.md D-04 and RESEARCH.md: React.lazy() + Suspense pattern chosen.
import React, { Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import RootLayout from './App'
import { NotFound } from './components/NotFound'
import { Spin } from './components/ui/primitives'

// ── Lazy page imports (each becomes its own JS chunk) ─────────
const DashboardPage    = React.lazy(() => import('./pages/DashboardPage'))
const PatientsPage     = React.lazy(() => import('./pages/PatientsPage'))
const AlertsPage       = React.lazy(() => import('./pages/AlertsPage'))
const BillingPage      = React.lazy(() => import('./pages/BillingPage'))
const CareProgramsPage = React.lazy(() => import('./pages/CareProgramsPage'))
const ScreeningPage    = React.lazy(() => import('./pages/ScreeningPage'))
const BacklogPage      = React.lazy(() => import('./pages/BacklogPage'))
const CalendarPage     = React.lazy(() => import('./pages/CalendarPage'))
const SlackPage        = React.lazy(() => import('./pages/SlackPage'))
const SetupPage        = React.lazy(() => import('./pages/SetupPage'))

// ── Suspense wrapper helper ───────────────────────────────────
// Suspense boundary is per-route so Sidebar/TopBar stay mounted during chunk load
function wrap(Page: React.ComponentType) {
  return <Suspense fallback={<Spin />}><Page /></Suspense>
}

// ── Router ───────────────────────────────────────────────────
export const router = createBrowserRouter([
  {
    element: <RootLayout />,          // pathless layout route (COMP-04, D-04)
    children: [
      { path: '/',               element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard',      element: wrap(DashboardPage) },
      { path: '/patients',       element: wrap(PatientsPage) },
      { path: '/alerts',         element: wrap(AlertsPage) },
      { path: '/billing',        element: wrap(BillingPage) },
      { path: '/care-programs',  element: wrap(CareProgramsPage) },
      { path: '/screening',      element: wrap(ScreeningPage) },
      { path: '/backlog',        element: wrap(BacklogPage) },
      { path: '/calendar',       element: wrap(CalendarPage) },
      { path: '/slack',          element: wrap(SlackPage) },
      { path: '/setup',          element: wrap(SetupPage) },
      { path: '*',               element: <NotFound /> },   // catch-all — not lazy
    ],
  },
])
