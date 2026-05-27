import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import { NotFound } from './components/NotFound'

// D-03: Root / redirects to /dashboard (replace so back button skips the empty root)
// D-01/D-02: Route slugs are exact Section type keys — no renaming, hyphens preserved
export const router = createBrowserRouter([
  { path: '/',              element: <Navigate to="/dashboard" replace /> },
  { path: '/dashboard',     element: <App /> },
  { path: '/patients',      element: <App /> },
  { path: '/alerts',        element: <App /> },
  { path: '/billing',       element: <App /> },
  { path: '/care-programs', element: <App /> },
  { path: '/screening',     element: <App /> },
  { path: '/backlog',       element: <App /> },
  { path: '/calendar',      element: <App /> },
  { path: '/slack',         element: <App /> },
  { path: '/setup',         element: <App /> },
  // ROUT-06: catch-all renders NotFound (not blank screen)
  { path: '*',              element: <NotFound /> },
])
