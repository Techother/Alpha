// src/App.tsx — RootLayout (auth shell + Outlet)
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { supabase, signOut, onAuthChange, getOpenAlerts } from './api/supabase'
import { getOverdueTcmEpisodes } from './api/tcm'
import { getPatientsNeedingScreening } from './api/screening'
import { getMonthlyBillingSummary } from './api/billing'
import { T } from './lib/tokens'
import { Spin } from './components/ui/primitives'
import { Sidebar, TITLES, type Section } from './components/layout/Sidebar'
import { BottomNav } from './components/layout/BottomNav'
import { TopBar } from './components/layout/TopBar'
import { LandingPage } from './components/layout/LandingPage'
import { LoginView } from './components/layout/LoginView'
import type { OutletContextType } from './pages/PatientsPage'
export { type OutletContextType }
type AppView = 'landing' | 'login' | 'app'

export default function RootLayout() {
  const [view, setView] = useState<AppView>('landing')
  const [session, setSession] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [alertCount, setAlertCount] = useState(0)
  const [overdueTcm, setOverdueTcm] = useState(0)
  const [screeningDue, setScreeningDue] = useState(0)
  const [billingCount, setBillingCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const section: Section = (useLocation().pathname.slice(1) as Section) || 'dashboard'

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }: any) => { setSession(session); if (session) setView('app'); setAuthLoading(false) })
    const { data: { subscription } } = onAuthChange((s: any) => { setSession(s); setView(s ? 'app' : 'landing') })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    const poll = async () => {
      try { setAlertCount((await getOpenAlerts()).length) } catch {}
      try { setOverdueTcm((await getOverdueTcmEpisodes()).length) } catch {}
      try { setScreeningDue((await getPatientsNeedingScreening()).length) } catch {}
      try { const b = await getMonthlyBillingSummary(new Date().toISOString().slice(0, 7)); setBillingCount(b.filter((r: any) => r.cpt99454Met).length) } catch {}
    }
    poll(); const t = setInterval(poll, 60000); return () => clearInterval(t)
  }, [session])

  function selectPatient(id: string | null) { setSelectedPatientId(id); if (id) navigate('/patients') }
  const ctx: OutletContextType = { selectedPatientId, selectPatient }

  if (authLoading) return <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size={32} /></div>
  if (view === 'landing') return <LandingPage onSignIn={() => setView('login')} />
  if (view === 'login' || !session) return <LoginView onBack={() => setView('landing')} />
  return (
    <>
      <Sidebar section={section} alertCount={alertCount} overdueTcm={overdueTcm} screeningDue={screeningDue} billingCount={billingCount} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main-content">
        <TopBar title={section === 'patients' && selectedPatientId ? 'Patient' : TITLES[section]} onMenu={() => setMenuOpen(o => !o)} onSignOut={() => signOut()} />
        <main className="page"><Outlet context={ctx} /></main>
      </div>
      <BottomNav alertCount={alertCount} />
    </>
  )
}
