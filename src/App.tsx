import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleUserRound, Dumbbell, LayoutDashboard, Menu, MoreVertical, Pencil, Plus, Sparkles, Trash2, Users, X } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import { useClientAreaData, type ClientAppointment } from './hooks/useClientAreaData'
import { useCoachDashboardData, type CoachProgram } from './hooks/useCoachDashboardData'
import { useClientDetail, type ClientDetailAppointment, type ClientDetailPackage, type ClientDetailProgram } from './hooks/useClientDetail'
import { useProgramDetail, type ProgramExercise } from './hooks/useProgramDetail'
import { useClientProgramDetail, type ClientProgramExercise } from './hooks/useClientProgramDetail'
import { useServices, type ServiceRecord } from './hooks/useServices'
import { useQuestionnaire, type Questionnaire } from './hooks/useQuestionnaire'
import { useMaterials, type MaterialRecord } from './hooks/useMaterials'
import { paymentStatuses, usePayments, type PaymentRecord, type PaymentStatus } from './hooks/usePayments'
import { useAvailability, type AvailableSlot } from './hooks/useAvailability'
import { useBooking } from './hooks/useBooking'
import { useAvailabilityRules, type AvailabilityRule } from './hooks/useAvailabilityRules'
import { useBlockedTimes, type BlockedTime } from './hooks/useBlockedTimes'
import { updateAppointment, useCoachCalendarAppointments, type CoachCalendarAppointment } from './hooks/useAppointments'
import { useContactRequests } from './hooks/useContactRequests'
import { PUBLIC_PAGE_THEMES, useCoachPage, validateSlug, type AdditionalLink, type PublicPageTheme, type SocialLinks } from './hooks/useCoachPage'
import { usePublicCoachPage } from './hooks/usePublicCoachPage'
import { Globe, Instagram, Music2, Youtube } from 'lucide-react'

type View = 'home' | 'services' | 'booking' | 'client' | 'coach' | 'profile' | 'client-detail' | 'program-detail' | 'client-program-detail' | 'login' | 'register' | 'coach-page' | 'coach-public' | 'onboarding'

const paths: Record<View, string> = {
  home: '/',
  services: '/servizi',
  booking: '/contatti',
  client: '/area-clienti',
  coach: '/dashboard',
  profile: '/profilo',
  'client-detail': '/dashboard',
  'program-detail': '/dashboard',
  'client-program-detail': '/area-clienti',
  login: '/login',
  register: '/register',
  'coach-page': '/dashboard/pagina',
  'coach-public': '/',
  onboarding: '/onboarding',
}

const SLUG_SEGMENT_PATTERN = /^\/([a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?)\/?$/

function viewFromPathname(pathname: string): View {
  if (pathname === '/servizi') return 'services'
  if (pathname === '/contatti') return 'booking'
  if (pathname === '/area-clienti') return 'client'
  if (/^\/area-clienti\/program\/[^/]+\/?$/.test(pathname)) return 'client-program-detail'
  if (pathname === '/onboarding') return 'onboarding'
  if (pathname === '/dashboard/pagina') return 'coach-page'
  if (pathname === '/dashboard') return 'coach'
  if (pathname === '/profilo') return 'profile'
  if (/^\/dashboard\/client\/[^/]+\/program\/[^/]+\/?$/.test(pathname)) return 'program-detail'
  if (/^\/dashboard\/client\/[^/]+\/?$/.test(pathname)) return 'client-detail'
  if (pathname === '/login') return 'login'
  if (pathname === '/register') return 'register'
  if (pathname !== '/' && SLUG_SEGMENT_PATTERN.test(pathname)) return 'coach-public'
  return 'home'
}

function routeFromPathname(pathname: string): { view: View; clientId?: string; programId?: string; slug?: string } {
  const programMatch = pathname.match(/^\/dashboard\/client\/([^/]+)\/program\/([^/]+)\/?$/)
  const clientProgramMatch = pathname.match(/^\/area-clienti\/program\/([^/]+)\/?$/)
  const detailMatch = pathname.match(/^\/dashboard\/client\/([^/]+)\/?$/)
  const view = viewFromPathname(pathname)
  const slugMatch = view === 'coach-public' ? pathname.match(SLUG_SEGMENT_PATTERN) : null
  return {
    view,
    clientId: programMatch?.[1] ?? detailMatch?.[1],
    programId: programMatch?.[2] ?? clientProgramMatch?.[1],
    slug: slugMatch?.[1],
  }
}

function navigateToPath(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function App() {
  const { user, profile, loading, profileError, logout } = useAuth()
  const [route, setRoute] = useState(() => routeFromPathname(window.location.pathname))
  const [routeHash, setRouteHash] = useState(() => window.location.hash)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!mobileMenuOpen) return
    const handler = (event: MouseEvent) => { if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) setMobileMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mobileMenuOpen])
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('gc-theme') as 'dark' | 'light' | null) ?? 'light')
  const privateRoute = ['client', 'coach', 'profile', 'client-detail', 'program-detail', 'client-program-detail', 'coach-page'].includes(route.view)
  const isCoachPublicRoute = route.view === 'coach-public'
  const isOnboardingRoute = route.view === 'onboarding'
  const coachId = profile?.role === 'COACH' ? profile.id : null
  const onboardingStatus = useCoachPage(profile?.role === 'COACH', coachId)
  const coachConfigured = onboardingStatus.page?.is_published === true

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('gc-theme', theme)
  }, [theme])

  useEffect(() => {
    const onPopState = () => {
      setRoute(routeFromPathname(window.location.pathname))
      setRouteHash(window.location.hash)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (route.view !== 'coach' || (routeHash !== '#appuntamenti' && routeHash !== '#clienti')) return
    window.setTimeout(() => document.getElementById(routeHash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }, [route.view, routeHash])

  useEffect(() => {
    if (loading) return
    if (route.view === 'client' && !user) navigate('login')
    if ((route.view === 'coach' || route.view === 'client-detail' || route.view === 'program-detail' || route.view === 'coach-page') && (!user || profile?.role !== 'COACH')) navigate(user ? 'client' : 'login')
    if (route.view === 'client-program-detail' && (!user || profile?.role !== 'CLIENT')) navigate(user ? 'home' : 'login')
    if (route.view === 'profile' && !user) navigate('login')
    if (route.view === 'onboarding' && (!user || profile?.role !== 'COACH')) navigate(user ? 'client' : 'login')
    if (onboardingStatus.loading) return
    if ((route.view === 'coach' || route.view === 'client-detail' || route.view === 'program-detail' || route.view === 'coach-page') && user && profile?.role === 'COACH' && !coachConfigured) navigate('onboarding')
  }, [coachConfigured, loading, onboardingStatus.loading, profile?.role, route.view, user])

  const navigate = (next: View) => {
    window.history.pushState({}, '', paths[next])
    setRoute({ view: next })
    setMenuOpen(false)
    setMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const go = (next: View) => navigate(next)
  const goToCoachSection = (section: 'appuntamenti' | 'clienti') => {
    const hash = `#${section}`
    window.history.pushState({}, '', `${paths.coach}${hash}`)
    setRoute({ view: 'coach' })
    setRouteHash(hash)
  }
  const goToCoachAppointments = () => goToCoachSection('appuntamenti')
  const goToCoachClients = () => goToCoachSection('clienti')
  const goToCoachRegistration = () => navigateToPath('/register?intent=coach')
  const goToSection = (section: string) => {
    navigate('home')
    window.setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  if (loading) return <div className="auth-state"><span className="eyebrow">Connessione sicura</span><h1>Caricamento sessione.</h1></div>
  if (profileError && user) return <div className="auth-state"><span className="eyebrow">Profilo non disponibile</span><h1>Impossibile caricare il profilo.</h1><p>{profileError}</p><button className="primary-button" onClick={() => void logout()}>Esci</button></div>

  return <div className={`app-shell ${privateRoute ? 'has-private-app' : ''}`}>
    {!privateRoute && !isCoachPublicRoute && !isOnboardingRoute && <header className="site-header">
      <button className="wordmark" onClick={() => go('home')} aria-label="Torna alla home"><span className="wordmark-mark">O</span><span>Ocklan</span></button>
      <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Navigazione principale">
        <button onClick={() => goToSection('funzionalita')}>Funzionalità</button><button onClick={() => goToSection('come-funziona')}>Come funziona</button>
        <div className="mobile-nav-actions">
          {!user && <button className="ghost-button" onClick={() => { setMenuOpen(false); go('login') }}>Accedi</button>}
          {user && <button className="ghost-button" onClick={() => { setMenuOpen(false); go(profile?.role === 'COACH' ? 'coach' : 'client') }}><CircleUserRound size={16} /> Area personale</button>}
          {user && <button className="ghost-button" onClick={() => { setMenuOpen(false); void logout() }}>Esci</button>}
          <button className="primary-button compact" onClick={() => { setMenuOpen(false); goToCoachRegistration() }}>Inizia gratis <ArrowUpRight size={16} /></button>
        </div>
      </nav>
      <div className="header-actions">{user ? <><button className="ghost-button hide-mobile" onClick={() => go(profile?.role === 'COACH' ? 'coach' : 'client')}><CircleUserRound size={16} /> Area personale</button><button className="ghost-button hide-mobile" onClick={() => void logout()}>Esci</button></> : <button className="ghost-button hide-mobile" onClick={() => go('login')}>Accedi</button>}<button className="primary-button compact" onClick={goToCoachRegistration}>Inizia gratis <ArrowUpRight size={16} /></button><button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Apri menu">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button></div>
    </header>}

    {privateRoute ? <div className="private-app-shell"><div className="mobile-private-header" ref={mobileMenuRef}><button className="wordmark" onClick={() => go(profile?.role === 'COACH' ? 'coach' : 'client')} aria-label="Area personale"><span className="wordmark-mark">O</span><span>Ocklan</span></button><button className="icon-button mobile-menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Apri menu">{mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button></div>{mobileMenuOpen && <nav className="mobile-private-nav is-open" aria-label="Navigazione area personale"><button className={route.view === (profile?.role === 'COACH' ? 'coach' : 'client') && routeHash !== '#appuntamenti' && routeHash !== '#clienti' ? 'is-active' : ''} onClick={() => { setMobileMenuOpen(false); go(profile?.role === 'COACH' ? 'coach' : 'client') }}><CircleUserRound size={17} /> Panoramica</button>{profile?.role === 'COACH' && <button className={route.view === 'coach' && routeHash === '#appuntamenti' ? 'is-active' : ''} onClick={() => { setMobileMenuOpen(false); goToCoachAppointments() }}><CalendarDays size={17} /> Appuntamenti</button>}{profile?.role === 'COACH' && <button className={route.view === 'coach' && routeHash === '#clienti' ? 'is-active' : ''} onClick={() => { setMobileMenuOpen(false); goToCoachClients() }}><Dumbbell size={17} /> Clienti</button>}{profile?.role === 'COACH' && <button className={route.view === 'coach-page' ? 'is-active' : ''} onClick={() => { setMobileMenuOpen(false); go('coach-page') }}><Sparkles size={17} /> Pagina pubblica</button>}{profile?.role === 'CLIENT' && <button className={route.view === 'client' ? 'is-active' : ''} onClick={() => { setMobileMenuOpen(false); go('client') }}><CalendarDays size={17} /> Appuntamenti</button>}<button className={route.view === 'profile' ? 'is-active' : ''} onClick={() => { setMobileMenuOpen(false); go('profile') }}><CircleUserRound size={17} /> Profilo</button><div className="mobile-nav-divider"></div><button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Modalità chiara' : 'Modalità scura'}</button><button className="ghost-button" onClick={() => { setMobileMenuOpen(false); void logout() }}>Esci</button></nav>}<PrivateNavigation route={route.view} routeHash={routeHash} profile={profile} go={go} goToCoachAppointments={goToCoachAppointments} goToCoachClients={goToCoachClients} logout={logout} theme={theme} setTheme={setTheme} /><div className="private-app-content">{route.view === 'client' && <ClientArea go={go} />}{route.view === 'coach' && <CoachDashboard go={go} />}{route.view === 'profile' && <ProfilePage />}{route.view === 'coach-page' && <CoachPageSettings />}{route.view === 'client-detail' && <ClientDetailPage clientId={route.clientId} go={go} />}{route.view === 'program-detail' && <ProgramDetailPage clientId={route.clientId} programId={route.programId} />}{route.view === 'client-program-detail' && <ClientProgramDetailPage programId={route.programId} />}</div></div> : null}
    {isOnboardingRoute && <OnboardingFlow go={go} coachPage={onboardingStatus} />}
    {!privateRoute && route.view === 'home' && <Home go={go} goToCoachRegistration={goToCoachRegistration} />}
    {!privateRoute && route.view === 'services' && <Services go={go} />}
    {!privateRoute && route.view === 'booking' && <Booking go={go} />}
    {!privateRoute && route.view === 'coach-public' && route.slug && <CoachPublicPage slug={route.slug} />}
    {(route.view === 'login' || route.view === 'register') && <AuthPage mode={route.view} go={go} coachConfigured={coachConfigured} coachPageLoading={onboardingStatus.loading} />}

    {!privateRoute && !isCoachPublicRoute && !isOnboardingRoute && <footer className="site-footer"><div><span className="footer-name">Ocklan</span><span className="muted">Il tuo coaching, tutto in un unico posto.</span></div><div className="footer-links"><button className="text-button" onClick={() => go('login')}>Accedi</button><button className="text-button" onClick={goToCoachRegistration}>Registrati</button></div></footer>}
  </div>
}

function PrivateNavigation({ route, routeHash, profile, go, goToCoachAppointments, goToCoachClients, logout, theme, setTheme }: { route: View; routeHash: string; profile: ReturnType<typeof useAuth>['profile']; go: (view: View) => void; goToCoachAppointments: () => void; goToCoachClients: () => void; logout: () => Promise<{ error: unknown }>; theme: 'dark' | 'light'; setTheme: (theme: 'dark' | 'light') => void }) {
  const coach = profile?.role === 'COACH'
  return <aside className="private-sidebar"><button className="private-brand" onClick={() => go(coach ? 'coach' : 'client')}><ProfileAvatar profile={profile} /><span>{profile?.full_name || 'Il tuo profilo'}</span></button><nav className="private-nav" aria-label="Navigazione area personale"><button className={route === (coach ? 'coach' : 'client') && routeHash !== '#appuntamenti' && routeHash !== '#clienti' ? 'is-active' : ''} onClick={() => go(coach ? 'coach' : 'client')}><CircleUserRound size={17} /> Panoramica</button>{coach && <button className={route === 'coach' && routeHash === '#appuntamenti' ? 'is-active' : ''} onClick={goToCoachAppointments}><CalendarDays size={17} /> Appuntamenti</button>}{coach && <button className={route === 'coach' && routeHash === '#clienti' ? 'is-active' : ''} onClick={goToCoachClients}><Dumbbell size={17} /> Clienti</button>}{coach && <button className={route === 'coach-page' ? 'is-active' : ''} onClick={() => go('coach-page')}><Sparkles size={17} /> Pagina pubblica</button>}{!coach && <button className={route === 'client' ? 'is-active' : ''} onClick={() => go('client')}><CalendarDays size={17} /> Appuntamenti</button>}<button className={route === 'profile' ? 'is-active' : ''} onClick={() => go('profile')}><CircleUserRound size={17} /> Profilo</button></nav><div className="private-sidebar-bottom"><button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Modalità chiara' : 'Modalità scura'}</button><button className="private-logout" onClick={() => void logout()}>Esci</button></div></aside>
}

function ProfileAvatar({ profile }: { profile: ReturnType<typeof useAuth>['profile'] }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (!profile?.avatar_url) {
      setUrl(null)
      return () => { active = false }
    }
    void supabase.storage.from('profile-avatars').createSignedUrl(profile.avatar_url, 3600).then(({ data }) => {
      if (active) setUrl(data?.signedUrl ?? null)
    })
    return () => { active = false }
  }, [profile?.avatar_url])
  return url ? <img className="private-profile-avatar" src={url} alt="" /> : <span className="wordmark-mark">{initials(profile?.full_name ?? '')}</span>
}

// Signup intent is derived from the real entry point, not from a manipulable
// query param: a pending booking that carries a coach slug means the person is
// registering from a coach public page (CLIENT linked to that coach); anything
// else reaching the register screen is a coach signing up from the landing.
function signupIntentFromContext(): { role: 'COACH' } | { role: 'CLIENT'; coachSlug?: string } {
  if (new URLSearchParams(window.location.search).get('intent') === 'coach') return { role: 'COACH' }
  const raw = localStorage.getItem('pending-booking')
  if (raw) {
    try {
      const pending = JSON.parse(raw) as { coachSlug?: string }
      if (pending.coachSlug) return { role: 'CLIENT', coachSlug: pending.coachSlug }
    } catch {
      // ignore malformed pending state, treated as coach signup
    }
  }
  return { role: 'COACH' }
}

function AuthPage({ mode, go, coachConfigured, coachPageLoading }: { mode: 'login' | 'register'; go: (view: View) => void; coachConfigured: boolean; coachPageLoading: boolean }) {  const { user, profile, login, register } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !profile) return
    if (profile.role === 'COACH') {
      if (coachPageLoading) return
      go(coachConfigured ? 'coach' : 'onboarding')
      return
    }
    const pendingBooking = localStorage.getItem('pending-booking')
    if (pendingBooking) go('booking')
    else go('client')
  }, [coachConfigured, coachPageLoading, go, profile, user])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    const result = mode === 'login'
      ? await login(email, password)
      : await register(fullName, email, password, signupIntentFromContext())
    setBusy(false)
    if (result.error) {
      setError(result.error.message === 'Invalid login credentials' ? 'Email o password non corretti.' : result.error.message)
      return
    }
    if (mode === 'register' && 'needsConfirmation' in result && result.needsConfirmation) setMessage('Registrazione completata. Controlla la tua email per confermare l’account.')
  }

  return <main className="app-page narrow-page auth-page"><div className="page-heading"><div className="eyebrow">{mode === 'login' ? 'Area riservata' : 'Nuovo account'}</div><h1>{mode === 'login' ? <>Bentornato<br /><em>atleta.</em></> : <>Inizia il tuo<br /><em>percorso.</em></>}</h1><p>{mode === 'login' ? 'Accedi per vedere il tuo percorso e i tuoi appuntamenti.' : 'Crea un account per accedere alla tua area personale.'}</p></div><form className="booking-form" onSubmit={(event) => void submit(event)}>{mode === 'register' && <label>Nome e cognome<input required minLength={2} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Il tuo nome" /></label>}<label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="La tua email" /></label><label>Password<input required minLength={6} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Almeno 6 caratteri" /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Attendi...' : mode === 'login' ? 'Accedi' : 'Registrati'} <ArrowUpRight size={18} /></button></form><button className="text-button auth-switch" onClick={() => go(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}</button></main>
}

function Home({ go, goToCoachRegistration }: { go: (view: View) => void; goToCoachRegistration: () => void }) {
  const scrollToProcess = () => document.getElementById('come-funziona')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return <main className="saas-landing">
    <section className="home-hero">
      <div className="home-hero-copy">
        <div className="eyebrow"><span className="eyebrow-dot" /> Per coach e personal trainer</div>
        <h1>Il tuo coaching.<br /><em>Tutto in un unico posto.</em></h1>
        <p>Gestisci clienti, programmi, servizi e prenotazioni senza saltare tra mille strumenti.</p>
        <div className="hero-actions"><button className="primary-button" onClick={goToCoachRegistration}>Inizia gratis <ArrowUpRight size={18} /></button><button className="text-button" onClick={scrollToProcess}>Scopri come funziona <ChevronRight size={17} /></button></div>
      </div>
      <div className="home-hero-visual">
        <div className="app-preview-card">
          <div className="app-preview-header"><span className="app-preview-dot" /><span className="app-preview-dot" /><span className="app-preview-dot" /></div>
          <div className="app-preview-stats">
            <div className="app-preview-stat"><span className="muted">Clienti attivi</span><strong>18</strong></div>
            <div className="app-preview-stat"><span className="muted">Appuntamenti</span><strong>7</strong></div>
            <div className="app-preview-stat"><span className="muted">Servizi</span><strong>4</strong></div>
          </div>
          <div className="app-preview-row"><CalendarDays size={17} /><span>Sessione online · oggi 18:00</span></div>
          <div className="app-preview-row"><Users size={17} /><span>Nuovo cliente iscritto</span></div>
          <div className="app-preview-row"><Dumbbell size={17} /><span>Programma "Forza base" aggiornato</span></div>
        </div>
      </div>
    </section>

    <section className="home-intro"><span className="eyebrow">Meno strumenti. Più coaching.</span><h2>Clienti, programmi, appuntamenti e servizi<br /><em>possono diventare difficili da gestire</em><br />quando sono sparsi ovunque.</h2><p>Ocklan riunisce tutto in un unico spazio.</p>
      <div className="home-intro-grid">
        <article className="home-intro-card"><Users size={20} /><strong>Clienti</strong><span>Tutto quello che serve per gestire i tuoi clienti.</span></article>
        <article className="home-intro-card"><Dumbbell size={20} /><strong>Programmi</strong><span>Crea e gestisci i percorsi di allenamento.</span></article>
        <article className="home-intro-card"><CalendarDays size={20} /><strong>Prenotazioni</strong><span>Gestisci disponibilità e appuntamenti.</span></article>
      </div>
    </section>

    <section className="home-process" id="come-funziona"><div className="section-heading"><div><div className="eyebrow">Come funziona</div><h2>Inizia in<br /><em>pochi minuti.</em></h2></div></div><div className="home-process-grid">{[['01', 'Crea il tuo spazio', 'Registrati e configura il tuo profilo da coach.'], ['02', 'Configura il tuo coaching', 'Aggiungi servizi, disponibilità e programmi.'], ['03', 'Condividi il tuo link', 'I tuoi clienti possono trovare i tuoi servizi e prenotare.']].map(([number, title, text]) => <article className="home-process-card" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="home-product-preview section" id="funzionalita"><div className="section-heading"><div><div className="eyebrow">Tutto quello che ti serve</div><h2>Il tuo coaching,<br /><em>visto da vicino.</em></h2></div></div>
      <div className="product-preview-grid">
        <div className="product-preview-card">
          <div className="preview-mini-label"><LayoutDashboard size={16} /> Dashboard</div>
          <div className="preview-mini-stats"><span>Clienti · 18</span><span>Appuntamenti · 7</span></div>
        </div>
        <div className="product-preview-card">
          <div className="preview-mini-label"><Sparkles size={16} /> Pagina pubblica</div>
          <div className="preview-mini-body"><span className="preview-mini-avatar" /><span>ocklan.com/iltuonome</span></div>
        </div>
        <div className="product-preview-card">
          <div className="preview-mini-label"><CalendarDays size={16} /> Calendario</div>
          <div className="preview-mini-body"><span>Lun</span><span>Mar</span><span className="is-active">Mer</span><span>Gio</span><span>Ven</span></div>
        </div>
        <div className="product-preview-card">
          <div className="preview-mini-label"><Dumbbell size={16} /> Servizi</div>
          <div className="preview-mini-body"><span>Coaching 3 mesi · €400</span></div>
        </div>
      </div>
    </section>

    <section className="home-services section"><div className="section-heading"><div><div className="eyebrow">Costruito per il tuo coaching</div><h2>Funzionalità<br /><em>principali.</em></h2></div></div><div className="service-grid">
      <div className="service-card tone-1"><Sparkles size={22} /><strong>Pagina personale</strong><span className="service-description">Un link professionale dove presentare il tuo coaching e i tuoi servizi.</span></div>
      <div className="service-card tone-2"><Users size={22} /><strong>Clienti</strong><span className="service-description">Gestisci clienti e percorsi in un unico spazio.</span></div>
      <div className="service-card tone-3"><Dumbbell size={22} /><strong>Programmi</strong><span className="service-description">Organizza programmi ed esercizi.</span></div>
      <div className="service-card tone-1"><CalendarDays size={22} /><strong>Calendario</strong><span className="service-description">Gestisci disponibilità e prenotazioni.</span></div>
    </div></section>

    <section className="home-final-cta"><div className="eyebrow">Il prossimo passo è tuo</div><h2>Pronto a semplificare<br /><em>il tuo coaching?</em></h2><p>Crea il tuo spazio e porta tutta la tua attività in un unico posto.</p><button className="primary-button" onClick={goToCoachRegistration}>Inizia gratis <ArrowUpRight size={18} /></button></section>
  </main>
}

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)
  const questions = [
    ['Serve esperienza per iniziare?', 'No. Il percorso parte dal tuo livello attuale: costruiamo basi solide e progressioni adatte ai tuoi obiettivi.'],
    ['Come si svolgono le sessioni?', 'Puoi allenarti online o in presenza, con indicazioni chiare, programmazione personalizzata e supporto durante il percorso.'],
    ['Quanto tempo serve per vedere progressi?', 'Dipende dal punto di partenza e dalla costanza. Misuriamo i progressi settimana dopo settimana per rendere il lavoro concreto.'],
    ['Posso lavorare su una skill specifica?', 'Sì. Pull-up, handstand, front lever e le altre skill vengono inserite in un percorso coerente con forza, tecnica e mobilita.'],
  ]
  return <section className="section faq-section" id="faq"><div className="section-heading"><div><div className="eyebrow">Domande frequenti</div><h2>Tutto quello che<br /><em>vuoi sapere.</em></h2></div><p>Se non trovi la risposta che cerchi, scrivimi: partiamo dalla tua situazione.</p></div><div className="faq-list">{questions.map(([question, answer], index) => <div className={`faq-item ${open === index ? 'is-open' : ''}`} key={question}><button className="faq-question" onClick={() => setOpen(open === index ? null : index)} aria-expanded={open === index}><strong>{question}</strong><ChevronDown size={18} /></button>{open === index && <p>{answer}</p>}</div>)}</div></section>
}

function Services({ go }: { go: (view: View) => void }) {
  const { services, loading, error } = useServices(true, true)
  return <main className="app-page"><div className="page-heading"><div className="eyebrow">Percorsi personalizzati</div><h1>Costruiamo il tuo<br /><em>prossimo livello.</em></h1><p>Tre modi per iniziare. Un solo obiettivo: allenarti con intenzione e vedere progressi che restano.</p></div>{loading ? <p className="muted">Caricamento percorsi...</p> : error ? <p className="form-error" role="alert">{error}</p> : <div className="services-list">{services.map((service, i) => <article className={`service-row tone-${(i % 3) + 1}`} key={service.id}><span className="row-number">0{i + 1}</span><div><span className="service-eyebrow">{service.billing_type}</span><h2>{service.name}</h2><p>{service.description}</p></div><div className="row-price"><b>{formatEuro(service.price_cents)}</b><span>{service.duration_minutes} min</span></div><button className="primary-button compact" onClick={() => go('booking')}>Scegli <ArrowUpRight size={16} /></button></article>)}</div>}<div className="info-note"><Check size={18} /><span>Ogni percorso parte da una call conoscitiva. Nessun impegno, solo chiarezza.</span></div></main>
}

function Booking({ go }: { go: (view: View) => void }) {
  const rawPending = localStorage.getItem('pending-booking')
  let publicTheme: PublicPageTheme | null = null
  let coachSlug: string | null = null
  try {
    const pending = rawPending ? JSON.parse(rawPending) as { theme?: PublicPageTheme; coachSlug?: string } : null
    publicTheme = pending?.theme && PUBLIC_PAGE_THEMES.includes(pending.theme) ? pending.theme : null
    coachSlug = pending?.coachSlug ?? null
  } catch {
    // The booking flow handles malformed pending state separately.
  }
  return <main className={`app-page narrow-page${publicTheme ? ` public-booking-page public-theme-${publicTheme}` : ''}`}><button className="back-link" onClick={() => coachSlug ? navigateToPath(`/${coachSlug}`) : go('services')}><ChevronRight size={16} className="rotate" /> {coachSlug ? 'Torna al profilo' : 'Torna ai percorsi'}</button><div className="page-heading"><div className="eyebrow">Prenota il primo passo</div><h1>Scegli il tuo<br /><em>appuntamento.</em></h1><p>Seleziona un servizio, un giorno e un orario realmente disponibile.</p></div><ClientBookingSection go={go} onBooked={() => undefined} /></main>
}

const PUBLIC_SOCIAL_ICONS: { key: keyof SocialLinks; label: string; Icon: typeof Instagram }[] = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'tiktok', label: 'TikTok', Icon: Music2 },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
  { key: 'website', label: 'Sito web', Icon: Globe },
]

function CoachPublicPage({ slug }: { slug: string }) {
  const { loading, notFound, error, page, services } = usePublicCoachPage(slug)

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark'
  }, [])

  const startBooking = (serviceId?: string) => {
    localStorage.setItem('pending-booking', JSON.stringify({ coachSlug: slug, coachId: page?.coach_id, theme: page?.theme, ...(serviceId ? { serviceId } : {}) }))
    navigateToPath('/contatti')
  }

  if (loading) return <main className="app-page coach-public-page"><div className="data-state"><span className="eyebrow">Pagina pubblica</span><p>Caricamento in corso...</p></div></main>

  if (notFound || error) return <main className="app-page coach-public-page coach-public-missing">
    <div className="data-state data-error" role="alert">
      <span className="eyebrow">{error ? 'Errore' : 'Pagina non trovata'}</span>
      <h1>{error ? 'Qualcosa è andato storto.' : 'Questa pagina non esiste o non è più disponibile.'}</h1>
      <p>{error ?? 'Controlla il link oppure torna alla home.'}</p>
      <a className="primary-button" href="/">Torna alla home</a>
    </div>
  </main>

  if (!page) return null

  const socials = PUBLIC_SOCIAL_ICONS.filter((item) => page.social_links[item.key])

  return <main className={`coach-public-page public-theme-${page.theme}`}>
    <section className="coach-public-identity">
      {page.avatar_url ? <img className="coach-public-avatar" src={page.avatar_url} alt={page.display_name} /> : <span className="coach-public-avatar coach-public-avatar-placeholder">{initials(page.display_name)}</span>}
      <h1>{page.display_name}</h1>
      {page.occupation && <p className="coach-public-occupation">{page.occupation}</p>}
      {page.bio && <p className="coach-public-bio">{page.bio}</p>}
      <button className="primary-button coach-public-cta" onClick={() => startBooking()}>Prenota una call <ArrowUpRight size={18} /></button>
    </section>

    <section className="coach-public-services">
      <div className="section-heading"><div><span className="eyebrow">Percorsi</span><h2>Servizi disponibili</h2></div></div>
      {services.length === 0 && <EmptyState title="Nessun servizio pubblicato" text="Il coach non ha ancora pubblicato servizi prenotabili." />}
      {services.length > 0 && <div className="coach-public-service-grid">{services.map((service) => <article className="panel coach-public-service-card" key={service.id}>
        <h3>{service.name}</h3>
        {service.description && <p>{service.description}</p>}
        <div className="coach-public-service-meta">
          <span>{formatEuro(service.price_cents)}</span>
          {service.duration_minutes > 0 && <span>{service.duration_minutes} min</span>}
          {service.sessions_count !== null && <span>{service.sessions_count} sessioni</span>}
        </div>
        <button className="ghost-button" onClick={() => startBooking(service.id)}>Prenota <ArrowUpRight size={15} /></button>
      </article>)}</div>}
    </section>

    {socials.length > 0 && <section className="coach-public-socials-section">
      <div className="section-heading"><div><span className="eyebrow">Social</span><h2>Seguimi</h2></div></div>
      <div className="coach-public-socials">{socials.map(({ key, label, Icon }) => <a key={key} href={page.social_links[key]} target="_blank" rel="noopener noreferrer" aria-label={label} className="icon-button"><Icon size={19} /></a>)}</div>
    </section>}

    <footer className="coach-public-footer"><span>{page.display_name}</span></footer>
  </main>
}

const ONBOARDING_STEPS = ['welcome', 'profile', 'link', 'services', 'availability', 'social', 'publish'] as const
type OnboardingStep = typeof ONBOARDING_STEPS[number]
const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: 'Benvenuto',
  profile: 'Profilo',
  link: 'Il tuo link',
  services: 'Servizi',
  availability: 'Disponibilità',
  social: 'Social',
  publish: 'Pubblicazione',
}
const ONBOARDING_STORAGE_KEY_PREFIX = 'coachplatform-onboarding-step:'

function OnboardingFlow({ go, coachPage }: { go: (view: View) => void; coachPage: ReturnType<typeof useCoachPage> }) {
  const { profile } = useAuth()
  const { page, loading, save, uploadAvatar, refresh } = coachPage
  const servicesData = useServices(profile?.role === 'COACH', false, true)
  const onboardingStorageKey = profile?.id ? `${ONBOARDING_STORAGE_KEY_PREFIX}${profile.id}` : null

  const [stepIndex, setStepIndex] = useState(() => {
    if (!onboardingStorageKey) return 0
    const stored = localStorage.getItem(onboardingStorageKey)
    const index = stored ? ONBOARDING_STEPS.indexOf(stored as OnboardingStep) : -1
    return index >= 0 ? index : 0
  })
  const step = ONBOARDING_STEPS[stepIndex]

  const [displayName, setDisplayName] = useState('')
  const [occupation, setOccupation] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [slug, setSlug] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({})
  const [initialized, setInitialized] = useState(false)

  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [profileError, setProfileErrorMsg] = useState<string | null>(null)
  const [profileBusy, setProfileBusy] = useState(false)
  const [slugError, setSlugErrorMsg] = useState<string | null>(null)
  const [slugBusy, setSlugBusy] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publicationComplete, setPublicationComplete] = useState(false)
  const [socialBusy, setSocialBusy] = useState(false)
  const [serviceModal, setServiceModal] = useState<ServiceRecord | null | undefined>(undefined)

  useEffect(() => {
    if (loading) return
    if (page) {
      setDisplayName(page.display_name)
      setOccupation(page.occupation ?? '')
      setBio(page.bio ?? '')
      setAvatarUrl(page.avatar_url ?? '')
      setSlug(page.slug)
      setSocialLinks(page.social_links)
    } else if (!initialized) {
      setDisplayName(profile?.full_name ?? '')
    }
    setInitialized(true)
  }, [initialized, loading, page, profile?.full_name])

  useEffect(() => {
    if (onboardingStorageKey) localStorage.setItem(onboardingStorageKey, step)
  }, [onboardingStorageKey, step])

  const goToStep = (index: number) => setStepIndex(Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, index)))
  const nextStep = () => goToStep(stepIndex + 1)
  const prevStep = () => goToStep(stepIndex - 1)

  const pickAvatar = async (file: File) => {
    if (avatarBusy) return
    setAvatarBusy(true)
    setAvatarError(null)
    const result = await uploadAvatar(file)
    setAvatarBusy(false)
    if (result.error || !result.url) {
      setAvatarError(result.error ?? 'Non è stato possibile caricare l’immagine.')
      return
    }
    setAvatarUrl(result.url)
  }

  const saveProfileStep = async () => {
    if (profileBusy) return
    if (!displayName.trim()) { setProfileErrorMsg('Il nome è obbligatorio.'); return }
    if (!occupation.trim()) { setProfileErrorMsg('L’occupazione è obbligatoria.'); return }
    setProfileBusy(true)
    setProfileErrorMsg(null)
    const buildInput = (chosenSlug: string) => ({
      slug: chosenSlug,
      display_name: displayName,
      occupation,
      bio,
      avatar_url: avatarUrl,
      social_links: socialLinks,
      is_published: page?.is_published ?? false,
    })
    const baseSlug = slug.trim().toLowerCase() || suggestSlug(displayName)
    let chosenSlug = baseSlug
    let result = await save(buildInput(chosenSlug))
    // On first insert the auto-suggested slug may already be taken by another
    // coach: retry with a numeric suffix so the coach is not blocked here.
    // Never rewrites a slug the coach typed manually.
    for (let attempt = 2; result.error?.includes('slug') && !slug.trim() && attempt <= 5; attempt++) {
      chosenSlug = `${baseSlug}-${attempt}`
      result = await save(buildInput(chosenSlug))
    }
    setProfileBusy(false)
    if (result.error) { setProfileErrorMsg(result.error); return }
    if (!slug) setSlug(chosenSlug)
    refresh()
    nextStep()
  }

  const saveSlugStep = async () => {
    if (slugBusy) return
    const cleanSlug = slug.trim().toLowerCase()
    const validationError = validateSlug(cleanSlug)
    if (validationError) { setSlugErrorMsg(validationError); return }
    setSlugBusy(true)
    setSlugErrorMsg(null)
    const result = await save({
      slug: cleanSlug,
      display_name: displayName,
      occupation,
      bio,
      avatar_url: avatarUrl,
      social_links: socialLinks,
      is_published: page?.is_published ?? false,
    })
    setSlugBusy(false)
    if (result.error) { setSlugErrorMsg(result.error); return }
    refresh()
    nextStep()
  }

  const saveSocialStep = async () => {
    if (socialBusy) return
    setSocialBusy(true)
    setPublishError(null)
    const result = await save({
      slug: slug.trim().toLowerCase(),
      display_name: displayName,
      occupation,
      bio,
      avatar_url: avatarUrl,
      social_links: socialLinks,
      is_published: page?.is_published ?? false,
    })
    setSocialBusy(false)
    if (result.error) { setPublishError(result.error); return }
    refresh()
    nextStep()
  }

  const publish = async () => {
    if (publishBusy) return
    setPublishBusy(true)
    setPublishError(null)
    const result = await save({
      slug: slug.trim().toLowerCase(),
      display_name: displayName,
      occupation,
      bio,
      avatar_url: avatarUrl,
      social_links: socialLinks,
      is_published: true,
    })
    setPublishBusy(false)
    if (result.error) { setPublishError(result.error); return }
    if (onboardingStorageKey) localStorage.removeItem(onboardingStorageKey)
    refresh()
    setPublicationComplete(true)
  }

  if (profile?.role !== 'COACH') return null

  return <>
    <main className="onboarding-page">
    <header className="onboarding-header">
      <span className="onboarding-brand"><span className="wordmark-mark">O</span> Ocklan</span>
      <span className="onboarding-progress-label">Passaggio {stepIndex + 1} di {ONBOARDING_STEPS.length}</span>
    </header>
    <div className="onboarding-progress-bar"><div className="onboarding-progress-fill" style={{ width: `${((stepIndex + 1) / ONBOARDING_STEPS.length) * 100}%` }} /></div>

    <div className="onboarding-body">
      <div className="onboarding-card">
        {step === 'welcome' && <div className="onboarding-step">
          <div className="eyebrow">Benvenuto</div>
          <h1>Costruiamo il tuo<br /><em>spazio di coaching.</em></h1>
          <p>Bastano pochi passaggi per configurare la tua pagina, i tuoi servizi e le tue disponibilità.</p>
          <div className="onboarding-summary-steps">
            <span>Profilo</span><ChevronRight size={16} /><span>Servizi</span><ChevronRight size={16} /><span>Disponibilità</span><ChevronRight size={16} /><span>Pubblica</span>
          </div>
        </div>}

        {step === 'profile' && <div className="onboarding-step">
          <div className="eyebrow">Profilo</div>
          <h1>Parliamo un po'<br /><em>di te.</em></h1>
          <p>Queste informazioni appariranno sulla tua pagina pubblica.</p>
          <CoachPageAvatarPicker avatarUrl={avatarUrl} displayName={displayName} busy={avatarBusy} onPick={(file) => void pickAvatar(file)} />
          {avatarError && <p className="form-error" role="alert">{avatarError}</p>}
          <label>Nome<input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label>Occupazione<input required value={occupation} onChange={(event) => setOccupation(event.target.value)} placeholder="es. Calisthenics Coach" /></label>
          <label>Descrizione<textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Racconta chi sei e cosa offri." /></label>
          {profileError && <p className="form-error" role="alert">{profileError}</p>}
        </div>}

        {step === 'link' && <div className="onboarding-step">
          <div className="eyebrow">Il tuo link</div>
          <h1>Come vuoi<br /><em>farti trovare?</em></h1>
          <p>Questo sarà l’indirizzo della tua pagina pubblica.</p>
          <label>Slug pubblico<input required value={slug} onChange={(event) => { setSlug(event.target.value.toLowerCase()); setSlugErrorMsg(null) }} placeholder="es. nomedelcoach" /></label>
          <div className="onboarding-slug-preview">ocklan.com/<strong>{slug || 'tuo-slug'}</strong></div>
          {slugError && <p className="form-error" role="alert">{slugError}</p>}
        </div>}

        {step === 'services' && <div className="onboarding-step onboarding-step-wide">
          <div className="eyebrow">Servizi</div>
          <h1>Che cosa<br /><em>offri?</em></h1>
          <p>I servizi saranno mostrati nella tua pagina pubblica e potranno essere prenotati dai tuoi clienti.</p>
          <div className="onboarding-services-list">
            {servicesData.loading && <p className="muted">Caricamento servizi...</p>}
            {servicesData.error && <p className="form-error" role="alert">{servicesData.error}</p>}
            {!servicesData.loading && !servicesData.error && (servicesData.services.length ? servicesData.services.map((service) => <ServiceRow service={service} key={service.id} onEdit={() => setServiceModal(service)} onRefresh={servicesData.refresh} />) : <EmptyState title="Nessun servizio" text="Crea il primo servizio della tua pagina, ad esempio Coaching 3 mesi." />)}
          </div>
          <button type="button" className="ghost-button" onClick={() => setServiceModal(null)}><Plus size={16} /> Aggiungi servizio</button>
        </div>}

        {step === 'availability' && <div className="onboarding-step onboarding-step-wide">
          <div className="eyebrow">Disponibilità</div>
          <h1>Quando vuoi<br /><em>lavorare?</em></h1>
          <p>Configura una disponibilità settimanale di base. Potrai modificarla in qualsiasi momento dalla dashboard.</p>
          <CoachAvailabilitySection />
        </div>}

        {step === 'social' && <div className="onboarding-step">
          <div className="eyebrow">Social</div>
          <h1>Fatti<br /><em>conoscere.</em></h1>
          <p>Facoltativo: aggiungi i tuoi profili social alla pagina pubblica.</p>
          {SOCIAL_LINK_FIELDS.map((field) => <label key={field.key}>{field.label}<input value={socialLinks[field.key] ?? ''} onChange={(event) => setSocialLinks((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} /></label>)}
          {publishError && <p className="form-error" role="alert">{publishError}</p>}
        </div>}

        {step === 'publish' && <div className="onboarding-step onboarding-step-wide">
          <div className="eyebrow">Pronto</div>
          <h1>Il tuo spazio<br /><em>è pronto.</em></h1>
          <p>Controlla il riepilogo e pubblica la tua pagina quando sei pronto.</p>
          <div className="onboarding-recap">
            <div className="onboarding-recap-identity">
              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span className="coach-page-avatar-placeholder">{initials(displayName)}</span>}
              <div><strong>{displayName || 'Il tuo nome'}</strong><span>{occupation || 'La tua occupazione'}</span></div>
            </div>
            {bio && <p className="muted">{bio}</p>}
            <div className="onboarding-recap-stats">
              <span>{servicesData.services.length} servizi</span>
              <span>ocklan.com/{slug || 'tuo-slug'}</span>
              <span>{Object.values(socialLinks).filter(Boolean).length} social collegati</span>
            </div>
          </div>
          {publishError && <p className="form-error" role="alert">{publishError}</p>}
          {page?.is_published && <p className="form-message" role="status">La tua pagina è già pubblicata. <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer">Aprila <ArrowUpRight size={14} /></a></p>}
        </div>}

        <div className="onboarding-actions">
          {stepIndex > 0 && <button type="button" className="ghost-button" onClick={prevStep} disabled={profileBusy || slugBusy || socialBusy || publishBusy}>Indietro</button>}
          <div className="onboarding-actions-end">
            {step === 'services' && <button type="button" className="text-button" onClick={nextStep}>Salta per ora</button>}
            {step === 'availability' && <button type="button" className="text-button" onClick={nextStep}>Configura più tardi</button>}
            {step === 'welcome' && <button type="button" className="primary-button" onClick={nextStep}>Cominciamo <ArrowUpRight size={17} /></button>}
            {step === 'profile' && <button type="button" className="primary-button" onClick={() => void saveProfileStep()} disabled={profileBusy}>{profileBusy ? 'Salvataggio...' : 'Continua'} <ArrowUpRight size={17} /></button>}
            {step === 'link' && <button type="button" className="primary-button" onClick={() => void saveSlugStep()} disabled={slugBusy}>{slugBusy ? 'Salvataggio...' : 'Continua'} <ArrowUpRight size={17} /></button>}
            {step === 'services' && <button type="button" className="primary-button" onClick={nextStep}>Continua <ArrowUpRight size={17} /></button>}
            {step === 'availability' && <button type="button" className="primary-button" onClick={nextStep}>Continua <ArrowUpRight size={17} /></button>}
            {step === 'social' && <button type="button" className="primary-button" onClick={() => void saveSocialStep()} disabled={socialBusy}>{socialBusy ? 'Salvataggio...' : 'Continua'} <ArrowUpRight size={17} /></button>}
            {step === 'publish' && <button type="button" className="primary-button" onClick={() => void publish()} disabled={publishBusy}>{publishBusy ? 'Pubblicazione...' : 'Pubblica il mio spazio'} <ArrowUpRight size={17} /></button>}
          </div>
        </div>
      </div>
      <div className="onboarding-dots" aria-label={`Passaggio ${stepIndex + 1} di ${ONBOARDING_STEPS.length}`}>
        {ONBOARDING_STEPS.map((item, index) => <span key={item} className={index === stepIndex ? 'is-active' : index < stepIndex ? 'is-done' : ''} title={ONBOARDING_STEP_LABELS[item]} />)}
      </div>
    </div>

    {serviceModal !== undefined && <ServiceModal service={serviceModal} onClose={() => setServiceModal(undefined)} onSaved={() => { setServiceModal(undefined); servicesData.refresh() }} />}
    </main>
    {publicationComplete && <div className="modal-backdrop booking-confirmation-backdrop" role="presentation">
      <section className="modal-card booking-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="publication-confirmation-title">
        <div className="booking-confirmation-icon"><Check size={30} /></div>
        <span className="eyebrow">Pubblicazione completata</span>
        <h2 id="publication-confirmation-title">Il tuo spazio è online</h2>
        <p className="booking-confirmation-copy">La tua pagina pubblica è stata creata e pubblicata correttamente.</p>
        <div className="booking-confirmation-actions"><button type="button" className="primary-button" onClick={() => go('coach')}>Vai alla Dashboard <ArrowUpRight size={16} /></button></div>
      </section>
    </div>}
  </>
}

function suggestSlug(name: string): string {
  const base = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base.slice(0, 50) || 'coach'
}

function ProfilePage() {
  const { user, profile, updateProfile, logout } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [avatarPath, setAvatarPath] = useState(profile?.avatar_url ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(profile?.full_name ?? '')
    setAvatarPath(profile?.avatar_url ?? '')
    setRemoveAvatar(false)
  }, [profile?.full_name, profile?.avatar_url])

  useEffect(() => {
    let active = true
    if (!avatarPath) {
      setAvatarUrl(null)
      return () => { active = false }
    }
    void supabase.storage.from('profile-avatars').createSignedUrl(avatarPath, 3600).then(({ data }) => {
      if (active) setAvatarUrl(data?.signedUrl ?? null)
    })
    return () => { active = false }
  }, [avatarPath])

  useEffect(() => () => { if (avatarUrl?.startsWith('blob:')) URL.revokeObjectURL(avatarUrl) }, [avatarUrl])

  const selectFile = (selected: File | undefined) => {
    if (!selected) return
    if (!selected.type.startsWith('image/')) {
      setError('Seleziona un’immagine valida.')
      return
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError('L’immagine deve essere più piccola di 5 MB.')
      return
    }
    if (avatarUrl?.startsWith('blob:')) URL.revokeObjectURL(avatarUrl)
    setFile(selected)
    setRemoveAvatar(false)
    setAvatarUrl(URL.createObjectURL(selected))
    setError(null)
    setMessage(null)
  }

  const save = async () => {
    if (!user || busy) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Il nome è obbligatorio.')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    let nextPath = removeAvatar ? null : avatarPath || null
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      nextPath = `${user.id}/avatar.${extension}`
      const upload = await supabase.storage.from('profile-avatars').upload(nextPath, file, { upsert: true, contentType: file.type })
      if (upload.error) {
        setBusy(false)
        setError('Non è stato possibile caricare l’immagine.')
        return
      }
    }
    const result = await updateProfile({ full_name: trimmedName, avatar_url: nextPath })
    if (result.error) {
      setBusy(false)
      setError('Non è stato possibile salvare il profilo.')
      return
    }
    if (removeAvatar && avatarPath) await supabase.storage.from('profile-avatars').remove([avatarPath])
    setFile(null)
    setRemoveAvatar(false)
    setAvatarPath(nextPath ?? '')
    setBusy(false)
    setMessage('Profilo aggiornato correttamente.')
  }

  return <main className="app-page profile-page"><div className="page-heading"><div className="eyebrow">Account personale</div><h1>Il tuo<br /><em>profilo.</em></h1><p>Gestisci il nome e l’immagine che utilizzi nella tua area personale.</p></div><section className="panel profile-card"><div className="profile-avatar-block">{avatarUrl ? <img className="profile-avatar" src={avatarUrl} alt={`Avatar di ${name || 'utente'}`} /> : <span className="profile-avatar profile-avatar-placeholder">{initials(name)}</span>}<label className="ghost-button profile-file-button">Scegli immagine<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => selectFile(event.target.files?.[0])} /></label>{(avatarPath || file) && <button type="button" className="text-button profile-remove-button" onClick={() => { setRemoveAvatar(true); setFile(null); setAvatarUrl(null); setMessage(null) }}>Rimuovi immagine</button>}<small>JPG, PNG, WEBP o GIF · massimo 5 MB</small></div><div className="profile-form"><label>Nome e cognome<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label><label>Email<input value={user?.email ?? ''} disabled /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}<div className="profile-actions"><button className="primary-button" onClick={() => void save()} disabled={busy}>{busy ? 'Salvataggio...' : 'Salva profilo'} <ArrowUpRight size={17} /></button><button className="ghost-button" onClick={() => void logout()}>Esci dall’account</button></div></div></section></main>
}

const SOCIAL_LINK_FIELDS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/tuonome' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@tuonome' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@tuonome' },
]

function CoachPageAvatarPicker({ avatarUrl, displayName, onPick, busy }: { avatarUrl: string; displayName: string; onPick: (file: File) => void; busy: boolean }) {
  const inputId = 'coach-page-avatar-input'
  return <div className="coach-page-avatar-picker">
    <label htmlFor={inputId} className="coach-page-avatar-button" aria-label="Carica foto profilo">
      {avatarUrl ? <img src={avatarUrl} alt={`Foto profilo di ${displayName || 'coach'}`} /> : <span className="coach-page-avatar-placeholder">{initials(displayName)}</span>}
      <span className="coach-page-avatar-overlay">{busy ? '...' : 'Carica foto'}</span>
    </label>
    <input id={inputId} type="file" accept="image/*" hidden disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onPick(file); event.target.value = '' }} />
  </div>
}

function CoachPageSettings() {
  const { profile, coachId } = useAuth()
  const { page, loading, error: loadError, save, saveTheme, uploadAvatar, refresh } = useCoachPage(profile?.role === 'COACH', coachId)
  const servicesData = useServices(profile?.role === 'COACH', false, true)

  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [occupation, setOccupation] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({})
  const [isPublished, setIsPublished] = useState(false)
  const [pageTheme, setPageTheme] = useState<PublicPageTheme>('obsidian')

  const [busy, setBusy] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [themeBusy, setThemeBusy] = useState(false)
  const [themeError, setThemeError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [serviceModal, setServiceModal] = useState<ServiceRecord | null | undefined>(undefined)

  useEffect(() => {
    if (loading) return
    if (page) {
      setDisplayName(page.display_name)
      setSlug(page.slug)
      setOccupation(page.occupation ?? '')
      setBio(page.bio ?? '')
      setAvatarUrl(page.avatar_url ?? '')
      setSocialLinks(page.social_links)
      setIsPublished(page.is_published)
      setPageTheme(page.theme)
    } else if (!initialized) {
      setDisplayName(profile?.full_name ?? '')
    }
    setInitialized(true)
  }, [initialized, loading, page, profile?.full_name])

  const updateSocialLink = (key: keyof SocialLinks, value: string) => {
    setSocialLinks((current) => ({ ...current, [key]: value }))
  }

  const pickAvatar = async (file: File) => {
    if (avatarBusy) return
    setAvatarBusy(true)
    setAvatarError(null)
    const result = await uploadAvatar(file)
    setAvatarBusy(false)
    if (result.error || !result.url) {
      setAvatarError(result.error ?? 'Non è stato possibile caricare l’immagine.')
      return
    }
    setAvatarUrl(result.url)
    setMessage(null)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setSaveError(null)
    setMessage(null)
    const result = await save({
      slug: slug.trim().toLowerCase(),
      display_name: displayName,
      occupation,
      bio,
      avatar_url: avatarUrl,
      social_links: socialLinks,
      is_published: isPublished,
      theme: pageTheme,
    })
    setBusy(false)
    if (result.error) {
      setSaveError(result.error)
      return
    }
    setMessage('Pagina pubblica salvata correttamente.')
    refresh()
  }

  const selectTheme = async (theme: PublicPageTheme) => {
    if (themeBusy || theme === pageTheme) return
    setPageTheme(theme)
    setThemeError(null)
    if (!page) return
    setThemeBusy(true)
    const result = await saveTheme(theme)
    setThemeBusy(false)
    if (result.error) {
      setPageTheme(page.theme)
      setThemeError(result.error)
      return
    }
    setMessage('Colore della pagina aggiornato.')
  }

  if (profile?.role !== 'COACH') return null

  return <main className="app-page dashboard-page coach-page-settings">
    <div className="page-heading"><div className="eyebrow">Pagina pubblica</div><h1>La tua<br /><em>pagina.</em></h1><p>Configura la pagina pubblica che i tuoi clienti vedranno all’indirizzo dedicato.</p></div>
    {loading && <div className="data-state"><span className="eyebrow">Pagina pubblica</span><p>Caricamento in corso...</p></div>}
    {loadError && <div className="data-state data-error" role="alert"><span className="eyebrow">Errore</span><p>{loadError}</p></div>}
    {!loading && !loadError && <>
      {!page && <div className="data-state"><span className="eyebrow">Nessuna pagina</span><p>Non hai ancora creato la tua pagina pubblica. Compila il modulo qui sotto per crearla.</p></div>}
      <form className="booking-form modal-form coach-page-form" onSubmit={(event) => void submit(event)}>
        <section className="panel coach-page-profile-section">
          <div className="panel-heading"><div><span className="eyebrow">Profilo</span><h2>Come ti presenti</h2></div></div>
          <CoachPageAvatarPicker avatarUrl={avatarUrl} displayName={displayName} busy={avatarBusy} onPick={(file) => void pickAvatar(file)} />
          {avatarError && <p className="form-error" role="alert">{avatarError}</p>}
          <label>Nome<input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label>Occupazione<input value={occupation} onChange={(event) => setOccupation(event.target.value)} placeholder="es. Calisthenics Coach" /></label>
          <label>Descrizione<textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Racconta chi sei e cosa offri." /></label>
        </section>

        <section className="panel coach-page-theme-section">
          <div className="panel-heading"><div><span className="eyebrow">Aspetto</span><h2>Colore della pagina</h2></div></div>
          <div className="theme-picker" aria-label="Colore della pagina">
            {PUBLIC_PAGE_THEMES.map((theme) => <button type="button" className={`theme-option public-theme-${theme} ${pageTheme === theme ? 'is-selected' : ''}`} key={theme} onClick={() => void selectTheme(theme)} disabled={themeBusy} aria-pressed={pageTheme === theme}>
              <span className="theme-preview"><span /><i /></span><strong>{theme === 'obsidian' ? 'Obsidian' : theme[0].toUpperCase() + theme.slice(1)}</strong>
            </button>)}
          </div>
          {themeError && <p className="form-error" role="alert">{themeError}</p>}
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Catalogo</span><h2>Servizi</h2></div><button type="button" className="primary-button compact" onClick={() => setServiceModal(null)}><Plus size={16} /> Aggiungi servizio</button></div>
          {servicesData.loading && <p className="data-state">Caricamento servizi...</p>}
          {servicesData.error && <p className="form-error" role="alert">{servicesData.error}</p>}
          {!servicesData.loading && !servicesData.error && (servicesData.services.length ? servicesData.services.map((service) => <ServiceRow service={service} key={service.id} onEdit={() => setServiceModal(service)} onRefresh={servicesData.refresh} />) : <EmptyState title="Nessun servizio" text="Crea il primo servizio della tua pagina, ad esempio Coaching 3 mesi." />)}
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Prenotazioni</span><h2>Come funziona</h2></div></div>
          <p className="muted">I servizi prenotabili utilizzeranno il calendario e le disponibilità già configurate nella tua dashboard.</p>
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Social</span><h2>Profili social</h2></div></div>
          <div className="exercise-form-grid">
            {SOCIAL_LINK_FIELDS.map((field) => <label key={field.key}>{field.label}<input value={socialLinks[field.key] ?? ''} onChange={(event) => updateSocialLink(field.key, event.target.value)} placeholder={field.placeholder} /></label>)}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Link pagina</span><h2>Slug e pubblicazione</h2></div></div>
          <label>Slug pubblico<input required value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="es. nomedelcoach" /><small>La tua pagina sarà raggiungibile su <code>/{slug || 'tuo-slug'}</code>. Solo lettere minuscole, numeri e trattini.</small></label>
          <label className="checkbox-field"><input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} /> Pagina pubblicata</label>
          {page && <a className="ghost-button" href={`/${page.slug}`} target="_blank" rel="noopener noreferrer">Apri pagina <ArrowUpRight size={15} /></a>}
        </section>

        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        {message && <p className="form-message" role="status">{message}</p>}
        <div className="modal-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Salvataggio...' : 'Salva modifiche'} <ArrowUpRight size={17} /></button></div>
      </form>
      {serviceModal !== undefined && <ServiceModal service={serviceModal} onClose={() => setServiceModal(undefined)} onSaved={() => { setServiceModal(undefined); servicesData.refresh() }} />}
    </>}
  </main>
}

function localDateValue() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function localDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const mondayOffset = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - mondayOffset + 1))
}

function ClientBookingSection({ go, onBooked }: { go?: (view: View) => void; onBooked: () => void }) {
  const { user } = useAuth()
  const [coachSlug, setCoachSlug] = useState<string | null>(null)
  const [filterCoachId, setFilterCoachId] = useState<string | null>(null)
  const { services, loading: servicesLoading, error: servicesError } = useServices(true, true, false, filterCoachId)
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(localDateValue)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [confirmed, setConfirmed] = useState<AvailableSlot | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = parseLocalDate(localDateValue())
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const { slots, loading: slotsLoading, error: slotsError, refresh: refreshSlots } = useAvailability(serviceId, date)
  const { book, loading: bookingLoading, error: bookingError } = useBooking()
  const service = services.find((item) => item.id === serviceId)

  useEffect(() => {
    const raw = localStorage.getItem('pending-booking')
    if (!raw) return
    try {
      const pending = JSON.parse(raw) as { serviceId?: string; date?: string; slot?: AvailableSlot; coachSlug?: string; coachId?: string }
      if (pending.coachSlug) setCoachSlug(pending.coachSlug)
      if (pending.coachId) setFilterCoachId(pending.coachId)
    } catch {
      // Malformed pending booking; will be handled by service restoration below.
    }
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem('pending-booking')
    if (!raw || !services.length) return
    try {
      const pending = JSON.parse(raw) as { serviceId?: string; date?: string; slot?: AvailableSlot }
      if (pending.serviceId && services.some((item) => item.id === pending.serviceId)) setServiceId(pending.serviceId)
      if (pending.date) setDate(pending.date)
      if (pending.slot) setSelectedSlot(pending.slot)
    } catch {
      localStorage.removeItem('pending-booking')
    }
  }, [services])

  const chooseService = (value: string) => {
    setServiceId(value)
    setSelectedSlot(null)
    setConfirmed(null)
  }
  const chooseDate = (value: string) => {
    setDate(value)
    setSelectedSlot(null)
    setConfirmed(null)
    const selected = parseLocalDate(value)
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1))
  }
  const confirmBooking = async () => {
    if (!service || !selectedSlot || bookingLoading) return
    if (!user) {
      const rawPending = localStorage.getItem('pending-booking')
      let existingCoachSlug: string | undefined
      let existingTheme: PublicPageTheme | undefined
      let existingCoachId: string | undefined
      if (rawPending) {
        try {
          const pending = JSON.parse(rawPending) as { coachSlug?: string; theme?: PublicPageTheme; coachId?: string }
          existingCoachSlug = pending.coachSlug
          existingTheme = pending.theme
          existingCoachId = pending.coachId
        } catch {
          // A malformed pending booking cannot provide a coach context.
        }
      }
      localStorage.setItem('pending-booking', JSON.stringify({ serviceId, date, slot: selectedSlot, ...(existingCoachSlug ? { coachSlug: existingCoachSlug } : {}), ...(existingTheme ? { theme: existingTheme } : {}), ...(existingCoachId ? { coachId: existingCoachId } : {}) }))
      go?.('login')
      return
    }
    const success = await book(service.id, selectedSlot)
    if (success) {
      setConfirmed(selectedSlot)
      setSelectedSlot(null)
      refreshSlots()
      onBooked()
      localStorage.removeItem('pending-booking')
    } else {
      setSelectedSlot(null)
      refreshSlots()
    }
  }

  return <section className="panel booking-panel">
    <div className="panel-heading"><div><span className="eyebrow">Disponibilità reale</span><h2>Prenota un appuntamento</h2></div></div>
    {servicesError && <p className="form-error" role="alert">{servicesError}</p>}
    <div className="booking-steps">
      <label>1. Servizio<select value={serviceId} onChange={(event) => chooseService(event.target.value)} disabled={servicesLoading || services.length === 0}><option value="">{servicesLoading ? 'Caricamento servizi...' : services.length ? 'Seleziona un servizio' : 'Nessun servizio attivo disponibile'}</option>{services.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.duration_minutes} min · {formatEuro(item.price_cents)}</option>)}</select></label>
      {!servicesLoading && !servicesError && services.length === 0 && <p className="form-error" role="status">Non ci sono servizi attivi configurati. Chiedi al Coach di pubblicarne uno.</p>}
      {service && <p className="booking-service-info">{service.description || 'Servizio personalizzato'} · {service.duration_minutes} minuti · {formatEuro(service.price_cents)}</p>}
      {service && <div className="booking-calendar"><div className="calendar-heading"><span className="form-label">2. Scegli il giorno</span><div className="calendar-month-controls"><button type="button" className="icon-button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Mese precedente"><ChevronLeft size={18} /></button><strong>{calendarMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</strong><button type="button" className="icon-button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Mese successivo"><ChevronRight size={18} /></button></div></div><div className="calendar-weekdays">{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendarDays(calendarMonth).map((day) => { const value = localDateString(day); const today = localDateValue(); const outsideMonth = day.getMonth() !== calendarMonth.getMonth(); const past = value < today; const selected = value === date; return <button type="button" key={value} className={`calendar-day ${outsideMonth ? 'is-outside' : ''} ${selected ? 'is-selected' : ''}`} disabled={past} onClick={() => chooseDate(value)} aria-label={`Seleziona ${day.toLocaleDateString('it-IT')}`}><span>{day.getDate()}</span>{value === today && <small>oggi</small>}</button> })}</div><p className="calendar-help">Seleziona un giorno per verificare gli orari realmente disponibili.</p></div>}
      <div><span className="form-label">3. Slot disponibili</span>{slotsLoading && <p className="muted">Caricamento orari...</p>}{slotsError && <p className="form-error" role="alert">{slotsError}</p>}{!slotsLoading && !slotsError && (slots.length ? <div className="slot-grid">{slots.map((slot) => <button type="button" className={selectedSlot?.starts_at === slot.starts_at ? 'slot-button is-selected' : 'slot-button'} key={slot.starts_at} onClick={() => setSelectedSlot(slot)}>{formatTime(slot.starts_at)}</button>)}</div> : <p className="muted">Nessun orario disponibile per questa data.</p>)}</div>
      {service && selectedSlot && <div className="booking-summary"><span className="eyebrow">Riepilogo</span><strong>{service.name}</strong><span>{formatDate(selectedSlot.starts_at)} · {formatTime(selectedSlot.starts_at)} - {formatTime(selectedSlot.ends_at)}</span><span>{service.duration_minutes} minuti · {formatEuro(service.price_cents)}</span><button className="primary-button compact" type="button" onClick={() => void confirmBooking()} disabled={bookingLoading}>{bookingLoading ? 'Conferma in corso...' : 'Conferma prenotazione'} <ArrowUpRight size={16} /></button></div>}
      {bookingError && <p className="form-error" role="alert">{bookingError}</p>}
    </div>
    {confirmed && service && <div className="modal-backdrop booking-confirmation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmed(null) }}>
      <section className="modal-card booking-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="booking-confirmation-title">
        <button type="button" className="modal-close" onClick={() => setConfirmed(null)} aria-label="Chiudi conferma"><X size={20} /></button>
        <div className="booking-confirmation-icon"><Check size={30} /></div>
        <span className="eyebrow">Tutto confermato</span>
        <h2 id="booking-confirmation-title">Prenotazione confermata</h2>
        <p className="booking-confirmation-copy">Il tuo appuntamento è stato registrato correttamente.</p>
        <div className="booking-confirmation-details">
          <strong>{service.name}</strong>
          <span>{formatDate(confirmed.starts_at)}</span>
          <span>{formatTime(confirmed.starts_at)} - {formatTime(confirmed.ends_at)}</span>
        </div>
        <div className="booking-confirmation-actions">
          {coachSlug ? <button type="button" className="primary-button" onClick={() => { setConfirmed(null); navigateToPath(`/${coachSlug}`) }}>Torna al profilo <ArrowUpRight size={16} /></button> : <button type="button" className="primary-button" onClick={() => { setConfirmed(null); go?.('client') }}>Vai alla mia area <ArrowUpRight size={16} /></button>}
          <button type="button" className="ghost-button" onClick={() => setConfirmed(null)}>Chiudi</button>
        </div>
      </section>
    </div>}
  </section>
}

function ClientArea({ go }: { go: (view: View) => void }) {
  const { profile } = useAuth()
  const { program, programs, appointments, packages, loading, error, refresh } = useClientAreaData(profile?.id)
  const questionnaireData = useQuestionnaire(profile?.id, profile?.role === 'CLIENT')
  const materialsData = useMaterials({ clientId: profile?.id, enabled: profile?.role === 'CLIENT', activeOnly: true })
  const paymentsData = usePayments({ clientId: profile?.id, enabled: profile?.role === 'CLIENT' })
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false)
  const name = profile?.full_name || 'atleta'
  const questionnaireComplete = Boolean(questionnaireData.questionnaire?.submitted_at)
  const nextAppointment = appointments.find((item) => new Date(item.starts_at).getTime() >= Date.now() && item.status !== 'CANCELLED')
  const nextStep = !questionnaireComplete
    ? { label: 'Primo passo', title: 'Completa il questionario', text: 'Racconta al coach il tuo punto di partenza e cosa vuoi costruire.', action: 'questionnaire' as const }
    : !nextAppointment
      ? { label: 'Prossimo passo', title: 'Prenota la call conoscitiva', text: 'Scegli un giorno e un orario per iniziare a definire il tuo percorso.', action: 'booking' as const }
      : program
        ? { label: 'Il tuo percorso', title: 'Inizia dal tuo programma', text: 'La call è in calendario. Quando vuoi, puoi già consultare il percorso assegnato.', action: 'program' as const }
        : { label: 'Prossimo passo', title: 'Tieni d’occhio il tuo appuntamento', text: 'Il prossimo step è la call conoscitiva. Qui troverai il programma dopo il confronto con il tuo coach.', action: 'appointment' as const }

  return <main className="app-page dashboard-page">
    <div className="dashboard-top"><div><div className="eyebrow">Area personale</div><h1>Ciao, {name} <span className="wave">+</span></h1><p>Il lavoro di oggi costruisce il risultato di domani.</p></div><button className="primary-button compact" onClick={() => go('booking')}>Prenota <CalendarDays size={16} /></button></div>
    {loading && <div className="data-state"><span className="eyebrow">Area personale</span><p>Caricamento dei tuoi dati...</p></div>}
    {error && <div className="data-state data-error" role="alert"><span className="eyebrow">Errore</span><p>{error}</p></div>}
    {!loading && !error && <>
      <section className={`client-onboarding ${program ? 'has-program' : ''}`}>
        <div className="client-onboarding-copy">
          <span className="eyebrow">{nextStep.label}</span>
          <h2>{nextStep.title}</h2>
          <p>{nextStep.text}</p>
          {nextStep.action === 'questionnaire' && <button className="primary-button compact" onClick={() => setQuestionnaireOpen(true)}>Completa il questionario <ArrowUpRight size={16} /></button>}
          {nextStep.action === 'booking' && <button className="primary-button compact" onClick={() => go('booking')}>Prenota la call <CalendarDays size={16} /></button>}
          {nextStep.action === 'program' && program && <button className="primary-button compact" onClick={() => navigateToPath(`/area-clienti/program/${program.id}`)}>Apri il programma <ArrowUpRight size={16} /></button>}
        </div>
        <div className="client-onboarding-steps" aria-label="Stato del percorso iniziale">
          <div className={questionnaireComplete ? 'is-complete' : 'is-current'}><span>01</span><strong>Questionario</strong><small>{questionnaireComplete ? 'Completato' : 'Da completare'}</small></div>
          <div className={nextAppointment ? 'is-complete' : questionnaireComplete ? 'is-current' : ''}><span>02</span><strong>Call conoscitiva</strong><small>{nextAppointment ? 'In calendario' : 'Da prenotare'}</small></div>
          <div className={program ? 'is-current' : ''}><span>03</span><strong>Il tuo percorso</strong><small>{program ? 'Disponibile' : 'Dopo la call'}</small></div>
        </div>
      </section>
      <div className="client-grid">
      <section className="path-card">{program ? <><div className="card-top"><span className="eyebrow">I tuoi programmi</span><span className="status-pill">{program.status}</span></div><h2>{program.title}</h2><p>{program.service?.name ?? 'Programma personalizzato'}{program.goal ? ` / ${program.goal}` : ''}</p>{program.starts_at && <p>Dal {formatDate(program.starts_at)}{program.ends_at ? ` al ${formatDate(program.ends_at)}` : ''}</p>}<div className="client-program-links">{programs.map((item) => <button className="text-button" key={item.id} onClick={() => navigateToPath(`/area-clienti/program/${item.id}`)}>{item.title} <ChevronRight size={16} /></button>)}</div></> : <EmptyState title="Nessun percorso attivo" text="Il tuo coach non ha ancora assegnato un programma." />}</section>
      <section className="sessions-card"><span className="eyebrow">Pacchetti</span>{packages.length ? packages.map((item) => <div className="package-summary" key={item.id}><strong>{item.service?.name ?? 'Pacchetto coaching'}</strong><div className="session-number">{Math.max(item.total_sessions - item.used_sessions, 0)}<small>/{item.total_sessions}</small></div><span className="muted">{item.used_sessions} utilizzate · {item.status}</span><span className="muted">{item.purchased_at ? `Acquistato il ${formatDate(item.purchased_at)}` : ''}{item.starts_at ? ` · Dal ${formatDate(item.starts_at)}` : ''}{item.expires_at ? ` · Fino al ${formatDate(item.expires_at)}` : ''}</span></div>) : <EmptyState title="Nessun pacchetto" text="Non risultano pacchetti associati al tuo profilo." />}</section>
      <section className="appointments-card"><div className="card-top"><span className="eyebrow">I miei appuntamenti</span></div>{appointments.length ? <><h3 className="appointment-group-title">Prossimi</h3>{appointments.filter((item) => new Date(item.starts_at).getTime() >= Date.now()).map((item) => <AppointmentRow item={item} key={item.id} />)}<h3 className="appointment-group-title">Passati</h3>{appointments.filter((item) => new Date(item.starts_at).getTime() < Date.now()).slice().reverse().map((item) => <AppointmentRow item={item} key={item.id} />)}</> : <EmptyState title="Nessun appuntamento" text="Non hai ancora appuntamenti." />}</section>
      <ClientBookingSection onBooked={refresh} />
      <section className="materials-card"><div className="card-top"><span className="eyebrow">Onboarding</span><span className="status-pill">{questionnaireData.questionnaire?.submitted_at ? 'Compilato' : 'Da compilare'}</span></div><h2>Questionario iniziale</h2><p className="questionnaire-summary">{questionnaireData.questionnaire?.submitted_at ? `Completato il ${formatDate(questionnaireData.questionnaire.submitted_at)}` : 'Aiuta il coach a costruire il tuo percorso.'}</p><button className="primary-button compact" onClick={() => setQuestionnaireOpen(true)}>{questionnaireData.questionnaire?.submitted_at ? 'Visualizza questionario' : 'Completa questionario'} <ArrowUpRight size={16} /></button></section>
      <section className="materials-card"><div className="card-top"><span className="eyebrow">Risorse</span><span className="status-pill">{materialsData.materials.length} disponibili</span></div><h2>Materiali</h2>{materialsData.loading && <p className="muted">Caricamento materiali...</p>}{materialsData.error && <p className="form-error" role="alert">{materialsData.error}</p>}{!materialsData.loading && !materialsData.error && (materialsData.materials.length ? materialsData.materials.map((material) => <MaterialClientRow material={material} key={material.id} />) : <EmptyState title="Nessun materiale" text="Il tuo coach non ha ancora condiviso risorse." />)}</section>
      <section className="materials-card"><div className="card-top"><span className="eyebrow">Pagamenti</span><span className="status-pill">{paymentsData.payments.length}</span></div><h2>I miei pagamenti</h2>{paymentsData.loading && <p className="muted">Caricamento pagamenti...</p>}{paymentsData.error && <p className="form-error" role="alert">{paymentsData.error}</p>}{!paymentsData.loading && !paymentsData.error && (paymentsData.payments.length ? paymentsData.payments.map((payment) => <PaymentRow payment={payment} showClient={false} key={payment.id} />) : <EmptyState title="Nessun pagamento" text="Non risultano pagamenti associati al tuo profilo." />)}</section>
      </div>
    </>}
    {questionnaireOpen && <QuestionnaireModal clientId={profile?.id} questionnaire={questionnaireData.questionnaire} editable onClose={() => setQuestionnaireOpen(false)} onSaved={() => { setQuestionnaireOpen(false); questionnaireData.refresh() }} onSave={questionnaireData.save} />}
  </main>
}

function ClientProgramDetailPage({ programId }: { programId: string | undefined }) {
  const { profile } = useAuth()
  const { program, exercises, loading, error } = useClientProgramDetail(programId, profile?.id)

  if (loading) return <main className="app-page dashboard-page"><button className="back-link" onClick={() => navigateToPath('/area-clienti')}><ChevronRight size={16} className="rotate" /> Torna ai programmi</button><div className="data-state"><span className="eyebrow">Area personale</span><p>Caricamento del programma...</p></div></main>
  if (error) return <main className="app-page dashboard-page"><button className="back-link" onClick={() => navigateToPath('/area-clienti')}><ChevronRight size={16} className="rotate" /> Torna ai programmi</button><div className="data-state data-error" role="alert"><span className="eyebrow">Errore</span><p>{error}</p></div></main>
  if (!program) return <main className="app-page dashboard-page"><button className="back-link" onClick={() => navigateToPath('/area-clienti')}><ChevronRight size={16} className="rotate" /> Torna ai programmi</button><div className="data-state"><span className="eyebrow">Area personale</span><h2>Programma non trovato.</h2><p>Il programma non esiste o non è accessibile con il tuo profilo.</p></div></main>

  return <main className="app-page dashboard-page">
    <button className="back-link" onClick={() => navigateToPath('/area-clienti')}><ChevronRight size={16} className="rotate" /> Torna ai programmi</button>
    <div className="detail-heading client-program-heading"><div><span className="eyebrow">Il tuo programma</span><h1>{program.title}</h1><p>{program.service?.name ?? 'Programma personalizzato'}{program.goal ? ` · ${program.goal}` : ''}</p></div><span className="status-pill">{program.status}</span></div>
    <div className="detail-grid client-program-grid">
      <section className="panel detail-section detail-wide"><div className="panel-heading"><div><span className="eyebrow">Riepilogo</span><h2>Il percorso</h2></div></div><div className="program-meta"><span>Servizio<strong>{program.service?.name ?? 'Programma personalizzato'}</strong></span>{program.goal && <span>Obiettivo<strong>{program.goal}</strong></span>}{(program.starts_at || program.ends_at) && <span>Periodo<strong>{program.starts_at ? formatDate(program.starts_at) : 'Data non indicata'}{program.ends_at ? ` - ${formatDate(program.ends_at)}` : ''}</strong></span>}</div></section>
      <section className="panel detail-section detail-wide"><div className="panel-heading"><div><span className="eyebrow">Allenamento</span><h2>Esercizi</h2></div></div>{exercises.length ? <div className="exercise-list client-exercise-list">{exercises.map((exercise, index) => <ClientExerciseRow exercise={exercise} index={index} key={exercise.id} />)}</div> : <EmptyState title="Nessun esercizio" text="Questo programma non contiene ancora esercizi." />}</section>
    </div>
  </main>
}

function ClientExerciseRow({ exercise, index }: { exercise: ClientProgramExercise; index: number }) {
  const metrics = [
    exercise.sets !== null ? { label: 'Serie', value: exercise.sets } : null,
    exercise.reps ? { label: 'Ripetizioni', value: exercise.reps } : null,
    exercise.duration_seconds !== null ? { label: 'Durata', value: `${exercise.duration_seconds} sec` } : null,
    exercise.rest_seconds !== null ? { label: 'Recupero', value: `${exercise.rest_seconds} sec` } : null,
    exercise.load ? { label: 'Carico', value: exercise.load } : null,
  ].filter((metric) => metric !== null)
  return <article className="exercise-row client-exercise-row"><div className="exercise-position">{(index + 1).toString().padStart(2, '0')}</div><div className="exercise-content"><div className="exercise-title-row"><strong>{exercise.exercise_name}</strong>{exercise.video_url && <a className="exercise-video-link" href={exercise.video_url} target="_blank" rel="noopener noreferrer" aria-label={`Guarda il video di ${exercise.exercise_name}`}>Video <ArrowUpRight size={14} /></a>}</div>{metrics.length > 0 && <div className="exercise-metrics">{metrics.map((metric) => <span key={metric.label}><small>{metric.label}</small><b>{metric.value}</b></span>)}</div>}{exercise.notes && <p className="exercise-notes">{exercise.notes}</p>}</div></article>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatEuro(amountCents: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amountCents / 100)
}

function parseEuroToCents(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(normalized)) return null
  const [euros, cents = ''] = normalized.split('.')
  const amount = Number(euros) * 100 + Number(cents.padEnd(2, '0') || 0)
  return Number.isSafeInteger(amount) ? amount : null
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{text}</span></div>
}

function AppointmentRow({ item }: { item: ClientAppointment }) {
  return <div className="appointment"><div className="date-block"><b>{new Date(item.starts_at).getDate().toString().padStart(2, '0')}</b><span>{new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(new Date(item.starts_at))}</span></div><div><strong>{item.service?.name ?? 'Appuntamento'}</strong><span>{formatTime(item.starts_at)} - {formatTime(item.ends_at)}{item.location ? ` · ${item.location}` : ''}</span><span>{item.meeting_url || ''}{item.meeting_url && item.payment_method ? ' · ' : ''}{item.payment_method}{item.notes ? ` · ${item.notes}` : ''}</span></div><span className="appointment-status">{item.status}</span></div>
}

const weekdayLabels = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

function databaseWeekday(index: number) {
  return index === 6 ? 0 : index + 1
}

function localDateTimeIso(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString()
}

function CoachAvailabilitySection() {
  const rulesData = useAvailabilityRules(true)
  const blockedData = useBlockedTimes(true)
  const [drafts, setDrafts] = useState<Record<number, AvailabilityRule>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [blockedDate, setBlockedDate] = useState('')
  const [blockedStart, setBlockedStart] = useState('')
  const [blockedEnd, setBlockedEnd] = useState('')
  const [blockedReason, setBlockedReason] = useState('')
  const [blockedBusy, setBlockedBusy] = useState(false)
  const [blockedError, setBlockedError] = useState<string | null>(null)

  useEffect(() => {
    const next: Record<number, AvailabilityRule> = {}
    weekdayLabels.forEach((_, index) => {
      const weekday = databaseWeekday(index)
      const existing = rulesData.rules.find((rule) => rule.weekday === weekday)
      next[weekday] = existing ?? {
        id: '',
        weekday,
        starts_at: '09:00',
        ends_at: '18:00',
        slot_minutes: 60,
        is_active: false,
      }
    })
    setDrafts(next)
  }, [rulesData.rules])

  const updateDraft = (weekday: number, changes: Partial<AvailabilityRule>) => {
    setDrafts((current) => ({ ...current, [weekday]: { ...current[weekday], ...changes } }))
  }

  const saveRules = async () => {
    if (saving) return
    const values = Object.values(drafts)
    if (values.some((rule) => rule.starts_at >= rule.ends_at || !Number.isInteger(rule.slot_minutes) || rule.slot_minutes <= 0)) {
      setMessage('Controlla orari e durata degli slot.')
      return
    }
    setSaving(true)
    setMessage(null)
    for (const rule of values) {
      const result = await rulesData.save({ ...rule, id: rule.id || undefined })
      if (result.error) {
        setMessage('Non è stato possibile salvare le disponibilità.')
        setSaving(false)
        return
      }
    }
    setSaving(false)
    setMessage('Disponibilità salvate.')
    rulesData.refresh()
  }

  const createBlocked = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (blockedBusy) return
    const starts = new Date(`${blockedDate}T${blockedStart}`)
    const ends = new Date(`${blockedDate}T${blockedEnd}`)
    if (!blockedDate || !blockedStart || !blockedEnd || Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts || ends <= new Date()) {
      setBlockedError('Inserisci un intervallo futuro valido.')
      return
    }
    setBlockedBusy(true)
    setBlockedError(null)
    const result = await blockedData.create(localDateTimeIso(blockedDate, blockedStart), localDateTimeIso(blockedDate, blockedEnd), blockedReason)
    setBlockedBusy(false)
    if (result.error) {
      setBlockedError('Non è stato possibile salvare il periodo.')
      return
    }
    setBlockedDate('')
    setBlockedStart('')
    setBlockedEnd('')
    setBlockedReason('')
    setFormOpen(false)
    blockedData.refresh()
  }

  const deleteBlocked = async (item: BlockedTime) => {
    if (!window.confirm('Eliminare questo periodo non disponibile?')) return
    const result = await blockedData.remove(item.id)
    if (result.error) setBlockedError('Non è stato possibile eliminare il periodo.')
    else blockedData.refresh()
  }

  return <section className="panel coach-programs availability-panel">
    <div className="panel-heading"><div><span className="eyebrow">Booking</span><h2>Disponibilità</h2></div><button className="primary-button compact" onClick={() => void saveRules()} disabled={saving || rulesData.loading}>{saving ? 'Salvataggio...' : 'Salva disponibilità'}</button></div>
    {rulesData.loading && <p className="muted">Caricamento disponibilità...</p>}
    {rulesData.error && <p className="form-error" role="alert">{rulesData.error}</p>}
    {message && <p className="form-message" role="status">{message}</p>}
    {!rulesData.loading && <div className="availability-list">{weekdayLabels.map((label, index) => { const weekday = databaseWeekday(index); const rule = drafts[weekday]; return rule ? <div className={`availability-row ${rule.is_active ? '' : 'is-inactive'}`} key={weekday}><strong>{label}</strong><label className="checkbox-field"><input type="checkbox" checked={rule.is_active} onChange={(event) => updateDraft(weekday, { is_active: event.target.checked })} /> Attivo</label><input type="time" value={rule.starts_at.slice(0, 5)} onChange={(event) => updateDraft(weekday, { starts_at: event.target.value })} /><span>—</span><input type="time" value={rule.ends_at.slice(0, 5)} onChange={(event) => updateDraft(weekday, { ends_at: event.target.value })} /><label className="slot-minutes-field">Slot <input type="number" min="1" step="1" value={rule.slot_minutes} onChange={(event) => updateDraft(weekday, { slot_minutes: Number(event.target.value) })} /> min</label></div> : null })}</div>}
    <div className="blocked-heading"><div><span className="eyebrow">Eccezioni</span><h3>Periodi non disponibili</h3></div><button className="ghost-button" onClick={() => setFormOpen((value) => !value)}><Plus size={16} /> Aggiungi periodo</button></div>
    {blockedData.loading && <p className="muted">Caricamento periodi...</p>}
    {blockedData.error && <p className="form-error" role="alert">{blockedData.error}</p>}
    {formOpen && <form className="blocked-form" onSubmit={(event) => void createBlocked(event)}><label>Data<input required type="date" min={new Date().toISOString().slice(0, 10)} value={blockedDate} onChange={(event) => setBlockedDate(event.target.value)} /></label><label>Inizio<input required type="time" value={blockedStart} onChange={(event) => setBlockedStart(event.target.value)} /></label><label>Fine<input required type="time" value={blockedEnd} onChange={(event) => setBlockedEnd(event.target.value)} /></label><label>Motivo<input value={blockedReason} onChange={(event) => setBlockedReason(event.target.value)} placeholder="Vacanza, gara..." /></label>{blockedError && <p className="form-error" role="alert">{blockedError}</p>}<div className="modal-actions"><button type="button" className="ghost-button" onClick={() => setFormOpen(false)} disabled={blockedBusy}>Annulla</button><button className="primary-button compact" type="submit" disabled={blockedBusy}>{blockedBusy ? 'Salvataggio...' : 'Salva periodo'}</button></div></form>}
    {!blockedData.loading && (blockedData.blockedTimes.length ? blockedData.blockedTimes.map((item) => <div className="blocked-row" key={item.id}><div><strong>{formatDate(item.starts_at)}</strong><span>{formatTime(item.starts_at)} — {formatTime(item.ends_at)}{item.reason ? ` · ${item.reason}` : ''}</span></div><button className="ghost-button danger-button" onClick={() => void deleteBlocked(item)}>Elimina</button></div>) : <EmptyState title="Nessun periodo" text="Non risultano eccezioni future." />)}
  </section>
}

function CoachDashboard({ go }: { go: (view: View) => void }) {
  const { profile } = useAuth()
  const { clients, programs, loading, error, refresh } = useCoachDashboardData(profile?.role === 'COACH')
  const servicesData = useServices(profile?.role === 'COACH', false, true)
  const materialsData = useMaterials({ enabled: profile?.role === 'COACH' })
  const paymentsData = usePayments({ enabled: profile?.role === 'COACH' })
  const contactData = useContactRequests(profile?.role === 'COACH')
  const name = profile?.full_name || 'Coach'
  const activePrograms = programs.filter((program) => program.status === 'ACTIVE').length
  const [createClientOpen, setCreateClientOpen] = useState(false)
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false)
  const [serviceModal, setServiceModal] = useState<ServiceRecord | null | undefined>(undefined)
  const [materialModal, setMaterialModal] = useState<MaterialRecord | null | undefined>(undefined)
  const [paymentModal, setPaymentModal] = useState<PaymentRecord | null | undefined>(undefined)
  const [appointmentToEdit, setAppointmentToEdit] = useState<CoachCalendarAppointment | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const calendarGrid = calendarDays(calendarMonth)
  const calendarStartsAt = new Date(calendarGrid[0].getFullYear(), calendarGrid[0].getMonth(), calendarGrid[0].getDate()).toISOString()
  const calendarEndsAt = new Date(calendarGrid[calendarGrid.length - 1].getFullYear(), calendarGrid[calendarGrid.length - 1].getMonth(), calendarGrid[calendarGrid.length - 1].getDate() + 1).toISOString()
  const calendarData = useCoachCalendarAppointments(profile?.role === 'COACH', calendarStartsAt, calendarEndsAt)

  return <main className="app-page dashboard-page coach-dashboard-page">
    <div className="dashboard-top"><div><div className="eyebrow">Gestionale / Dati reali</div><h1>Buongiorno, {name} <span className="wave">+</span></h1><p>Panoramica aggiornata dal database.</p></div><div className="dashboard-actions"><button className="primary-button compact" onClick={() => setAppointmentModalOpen(true)}><Plus size={16} /> Nuovo appuntamento</button><button className="ghost-button" onClick={() => setCreateClientOpen(true)}><Plus size={16} /> Nuovo cliente</button></div></div>
    {loading && <div className="data-state"><span className="eyebrow">Gestionale</span><p>Caricamento dei dati reali...</p></div>}
    {error && <div className="data-state data-error" role="alert"><span className="eyebrow">Errore</span><p>{error}</p></div>}
    {!loading && !error && <><div className="coach-metrics">
      <MetricCard label="Clienti" value={clients.length} />
      <MetricCard label="Programmi attivi" value={activePrograms} />
      <MetricCard label="Appuntamenti nel calendario" value={calendarData.appointments.length} />
      <MetricCard label="Programmi totali" value={programs.length} />
    </div><div className="coach-lower">
      <section className="panel" id="clienti"><div className="panel-heading"><div><span className="eyebrow">Clienti</span><h2>Clienti attivi</h2></div></div>{clients.length ? clients.map((client) => <button className="coach-appointment client-list-item" key={client.id} onClick={() => { window.history.pushState({}, '', `/dashboard/client/${client.id}`); window.dispatchEvent(new PopStateEvent('popstate')) }}><span className="client-avatar">{initials(client.full_name)}</span><div><strong>{client.full_name || 'Nome non indicato'}</strong><span>{client.programCount} programmi · Iscritto il {formatDate(client.created_at)}</span></div><ChevronRight size={17} /></button>) : <EmptyState title="Nessun cliente" text="Non risultano utenti con ruolo CLIENT." />}</section>
      <CoachAppointmentsCalendar month={calendarMonth} appointments={calendarData.appointments} loading={calendarData.loading} error={calendarData.error} onPreviousMonth={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} onNextMonth={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} onToday={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} onEdit={(appointment) => setAppointmentToEdit(appointment)} />
    </div><section className="panel coach-programs"><div className="panel-heading"><div><span className="eyebrow">Programmi</span><h2>Programmi cliente</h2></div></div>{programs.length ? programs.map((program) => <CoachProgramRow item={program} key={program.id} />) : <EmptyState title="Nessun programma" text="Non risultano programmi assegnati." />}</section><section className="panel coach-programs"><div className="panel-heading"><div><span className="eyebrow">Contatti</span><h2>Richieste dal sito</h2></div></div>{contactData.loading && <p className="muted">Caricamento richieste...</p>}{contactData.error && <p className="form-error" role="alert">{contactData.error}</p>}{!contactData.loading && !contactData.error && (contactData.requests.length ? contactData.requests.map((request) => <article className="detail-row" key={request.id}><div><strong>{request.name}</strong><span>{request.email} · {formatDate(request.created_at)}</span><p>{request.message}</p></div></article>) : <EmptyState title="Nessuna richiesta" text="Non risultano richieste di contatto." />)}</section><CoachAvailabilitySection /><section className="panel coach-programs"><div className="panel-heading"><div><span className="eyebrow">Pagamenti</span><h2>Gestione pagamenti</h2></div><button className="primary-button compact" onClick={() => setPaymentModal(null)}><Plus size={16} /> Nuovo pagamento</button></div>{paymentsData.loading && <p className="data-state">Caricamento pagamenti...</p>}{paymentsData.error && <p className="form-error" role="alert">{paymentsData.error}</p>}{!paymentsData.loading && !paymentsData.error && <><div className="payment-stats"><MetricCard label="Pagamenti" value={paymentsData.payments.length} /><MetricCard label="Totale importi" value={formatEuro(paymentsData.payments.reduce((sum, item) => sum + item.amount_cents, 0))} /><MetricCard label="Incassato PAID" value={formatEuro(paymentsData.payments.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + item.amount_cents, 0))} /><MetricCard label="PENDING" value={paymentsData.payments.filter((item) => item.status === 'PENDING').length} /></div>{paymentsData.payments.length ? paymentsData.payments.map((payment) => <PaymentRow payment={payment} showClient onEdit={() => setPaymentModal(payment)} key={payment.id} />) : <EmptyState title="Nessun pagamento" text="Registra il primo pagamento manuale." />}</>}</section><section className="panel coach-programs"><div className="panel-heading"><div><span className="eyebrow">Catalogo</span><h2>Servizi</h2></div><button className="primary-button compact" onClick={() => setServiceModal(null)}><Plus size={16} /> Nuovo servizio</button></div>{servicesData.loading && <p className="data-state">Caricamento servizi...</p>}{servicesData.error && <p className="form-error" role="alert">{servicesData.error}</p>}{!servicesData.loading && !servicesData.error && (servicesData.services.length ? servicesData.services.map((service) => <ServiceRow service={service} key={service.id} onEdit={() => setServiceModal(service)} onRefresh={servicesData.refresh} />) : <EmptyState title="Nessun servizio" text="Crea il primo servizio del catalogo." />)}</section><section className="panel coach-programs"><div className="panel-heading"><div><span className="eyebrow">Risorse</span><h2>Materiali</h2></div><button className="primary-button compact" onClick={() => setMaterialModal(null)}><Plus size={16} /> Nuovo materiale</button></div>{materialsData.loading && <p className="data-state">Caricamento materiali...</p>}{materialsData.error && <p className="form-error" role="alert">{materialsData.error}</p>}{!materialsData.loading && !materialsData.error && (materialsData.materials.length ? materialsData.materials.map((material) => <MaterialCoachRow material={material} clients={clients} onEdit={() => setMaterialModal(material)} onRefresh={materialsData.refresh} key={material.id} />) : <EmptyState title="Nessun materiale" text="Condividi il primo link con un cliente." />)}</section></>}
    {createClientOpen && <CreateClientModal onClose={() => setCreateClientOpen(false)} onCreated={() => { setCreateClientOpen(false); refresh() }} />}
    {appointmentModalOpen && <CreateAppointmentModal clients={clients} onClose={() => setAppointmentModalOpen(false)} onCreated={() => { setAppointmentModalOpen(false); refresh() }} />}
    {serviceModal !== undefined && <ServiceModal service={serviceModal} onClose={() => setServiceModal(undefined)} onSaved={() => { setServiceModal(undefined); servicesData.refresh() }} />}
    {materialModal !== undefined && <MaterialModal material={materialModal} clients={clients} onClose={() => setMaterialModal(undefined)} onSaved={() => { setMaterialModal(undefined); materialsData.refresh() }} />}
    {paymentModal !== undefined && <PaymentModal payment={paymentModal} clients={clients} onClose={() => setPaymentModal(undefined)} onSaved={() => { setPaymentModal(undefined); paymentsData.refresh() }} />}
    {appointmentToEdit && <AppointmentEditModal appointment={appointmentToEdit} onClose={() => setAppointmentToEdit(null)} onSaved={() => { setAppointmentToEdit(null); refresh(); calendarData.refresh() }} />}
  </main>
}

function CoachAppointmentsCalendar({ month, appointments, loading, error, onPreviousMonth, onNextMonth, onToday, onEdit }: { month: Date; appointments: CoachCalendarAppointment[]; loading: boolean; error: string | null; onPreviousMonth: () => void; onNextMonth: () => void; onToday: () => void; onEdit: (appointment: CoachCalendarAppointment) => void }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const days = calendarDays(month)
  const today = localDateValue()
  const selectedAppointments = selectedDate ? appointments.filter((appointment) => appointmentOverlapsDate(appointment, selectedDate)).sort((first, second) => first.starts_at.localeCompare(second.starts_at)) : []
  const selectDay = (date: string, count: number) => { if (count) setSelectedDate(date) }

  return <section className="panel coach-appointments-calendar" id="appuntamenti">
    <div className="panel-heading"><div><span className="eyebrow">Agenda</span><h2>Calendario appuntamenti</h2></div><div className="calendar-month-controls"><button type="button" className="icon-button" onClick={onPreviousMonth} aria-label="Mese precedente"><ChevronLeft size={18} /></button><button type="button" className="calendar-today-button" onClick={onToday}>Oggi</button><strong aria-live="polite">{month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</strong><button type="button" className="icon-button" onClick={onNextMonth} aria-label="Mese successivo"><ChevronRight size={18} /></button></div></div>
    <div className="coach-calendar-weekdays" aria-hidden="true">{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div>
    {loading ? <p className="muted calendar-state">Caricamento appuntamenti...</p> : error ? <p className="form-error calendar-state" role="alert">{error}</p> : <div className="coach-calendar-grid">{days.map((day) => { const date = localDateString(day); const count = appointments.filter((appointment) => appointmentOverlapsDate(appointment, date)).length; const outsideMonth = day.getMonth() !== month.getMonth(); return <button type="button" className={`coach-calendar-day${outsideMonth ? ' is-outside' : ''}${date === today ? ' is-today' : ''}${count ? ' has-appointments' : ''}`} key={date} onClick={() => selectDay(date, count)} disabled={!count} aria-label={count ? `${day.toLocaleDateString('it-IT')}: ${count} ${count === 1 ? 'appuntamento' : 'appuntamenti'}` : `${day.toLocaleDateString('it-IT')}: nessun appuntamento`}><span>{day.getDate()}</span>{count > 0 && <small>{count}</small>}</button> })}</div>}
    {!loading && !error && appointments.length === 0 && <p className="muted calendar-empty">Nessun appuntamento nel periodo visualizzato.</p>}
    {selectedDate && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDate(null) }}><section className="modal-card calendar-day-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-day-title"><div className="modal-heading"><div><span className="eyebrow">Appuntamenti del giorno</span><h2 id="calendar-day-title">{formatDate(`${selectedDate}T12:00:00`)}</h2></div><button type="button" className="icon-button" onClick={() => setSelectedDate(null)} aria-label="Chiudi"><X size={20} /></button></div><div className="calendar-day-appointments">{selectedAppointments.map((appointment) => <article className={`calendar-appointment ${appointment.status === 'CANCELLED' ? 'is-inactive' : ''}`} key={appointment.id}><span className="calendar-appointment-time">{formatTime(appointment.starts_at)}</span><div><strong>{appointment.client?.full_name || 'Cliente non indicato'}</strong><span>{appointment.service?.name || 'Servizio non indicato'} · {appointment.status}</span>{appointment.location && <span>{appointment.location}</span>}{appointment.meeting_url && <a href={appointment.meeting_url} target="_blank" rel="noreferrer">Apri meeting <ArrowUpRight size={13} /></a>}{appointment.notes && <p>{appointment.notes}</p>}</div><button type="button" className="ghost-button" onClick={() => onEdit(appointment)}>Modifica</button></article>)}</div></section></div>}
  </section>
}

function appointmentOverlapsDate(appointment: CoachCalendarAppointment, date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const startsAt = new Date(year, month - 1, day)
  const endsAt = new Date(year, month - 1, day + 1)
  return new Date(appointment.starts_at) < endsAt && new Date(appointment.ends_at) > startsAt
}

function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const normalizedName = fullName.trim()
    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedName.length < 2) {
      setError('Inserisci nome e cognome.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Inserisci un indirizzo email valido.')
      return
    }

    setBusy(true)
    setError(null)
    const { error: functionError } = await supabase.functions.invoke('create-client', {
      body: { email: normalizedEmail, full_name: normalizedName },
    })
    setBusy(false)

    if (functionError) {
      const status = functionError.context?.status
      if (status === 409) setError('Esiste già un account con questa email.')
      else if (status === 401 || status === 403) setError('Non hai i permessi per creare un cliente.')
      else if (status === 400) setError('Controlla nome ed email e riprova.')
      else setError('Impossibile creare il cliente. Riprova tra poco.')
      return
    }

    setSuccess(true)
    window.setTimeout(onCreated, 900)
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-client-title">
      <div className="modal-heading"><div><span className="eyebrow">Nuovo cliente</span><h2 id="create-client-title">Aggiungi un<br /><em>atleta.</em></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div>
      {success ? <div className="modal-feedback success-feedback"><Check size={24} /><p>Cliente creato. È stata inviata un’email di invito per completare l’accesso.</p></div> : <form className="booking-form modal-form" onSubmit={(event) => void submit(event)}><label>Nome e cognome<input required autoFocus value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nome Cognome" /></label><label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cliente@email.com" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Annulla</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Creazione...' : 'Crea cliente'} <ArrowUpRight size={17} /></button></div></form>}
    </section>
  </div>
}

function ServiceRow({ service, onEdit, onRefresh }: { service: ServiceRecord; onEdit: () => void; onRefresh: () => void }) {
  const { coachId } = useAuth()
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const handler = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])
  const toggle = async () => {
    if (!coachId) return
    setBusy(true)
    const result = await supabase.from('services').update({ is_active: !service.is_active }).eq('id', service.id).eq('coach_id', coachId)
    setBusy(false)
    if (!result.error) onRefresh()
  }
  const remove = async () => {
    if (!coachId) return
    if (!window.confirm('Sei sicuro di voler eliminare questo servizio? L\'operazione è permanente.')) return
    setBusy(true)
    const result = await supabase.from('services').delete().eq('id', service.id).eq('coach_id', coachId)
    setBusy(false)
    if (result.error) {
      if (result.error.message.includes('foreign key') || result.error.message.includes('violates') || result.error.code === '23503') {
        window.alert('Impossibile eliminare questo servizio perché è associato a dati esistenti. Disattivalo invece per conservarne lo storico.')
      } else {
        window.alert('Si è verificato un errore durante l\'eliminazione del servizio.')
      }
      return
    }
    onRefresh()
  }
  return <div className={`service-management-row ${service.is_active ? '' : 'is-inactive'}`}><div><strong>{service.name}</strong>{service.description && <span>{service.description}</span>}<span>{(service.price_cents / 100).toFixed(2)} EUR · {service.duration_minutes} min{service.sessions_count !== null ? ` · ${service.sessions_count} sessioni` : ''}</span></div><div className="service-row-actions"><span className="status-pill">{service.is_active ? 'Attivo' : 'Non attivo'}</span><button className="ghost-button" onClick={onEdit}>Modifica</button><button className="ghost-button" disabled={busy} onClick={() => void toggle()}>{service.is_active ? 'Disattiva' : 'Attiva'}</button><button className="ghost-button danger-button" disabled={busy} onClick={() => void remove()}>Elimina</button><div className="service-overflow" ref={menuRef}><button className="service-overflow-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Azioni servizio"><MoreVertical size={18} /></button>{menuOpen && <div className="service-overflow-menu"><button onClick={() => { setMenuOpen(false); onEdit() }}>Modifica</button><button disabled={busy} onClick={() => { setMenuOpen(false); void toggle() }}>{service.is_active ? 'Disattiva' : 'Attiva'}</button><button className="danger-button" disabled={busy} onClick={() => { setMenuOpen(false); void remove() }}>Elimina</button></div>}</div></div></div>
}

function ServiceModal({ service, onClose, onSaved }: { service: ServiceRecord | null; onClose: () => void; onSaved: () => void }) {
  const { coachId } = useAuth()
  const [name, setName] = useState(service?.name ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [price, setPrice] = useState(service ? (service.price_cents / 100).toFixed(2) : '')
  const [billingType, setBillingType] = useState(service?.billing_type ?? 'ONE_TIME')
  const [duration, setDuration] = useState(service?.duration_minutes?.toString() ?? '60')
  const [sessions, setSessions] = useState(service?.sessions_count?.toString() ?? '')
  const [pathwayDays, setPathwayDays] = useState(service?.pathway_days?.toString() ?? '')
  const [intro, setIntro] = useState(service?.requires_intro_call ?? false)
  const [appointmentType, setAppointmentType] = useState(service?.appointment_type ?? '')
  const [active, setActive] = useState(service?.is_active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [busy, onClose])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const priceNumber = Number(price)
    const numberFields = [duration, sessions, pathwayDays]
    if (!name.trim() || (price && (!Number.isFinite(priceNumber) || priceNumber < 0)) || numberFields.some((value) => value && (!Number.isInteger(Number(value)) || Number(value) < 0))) {
      setError('Controlla nome, prezzo e valori numerici.')
      return
    }
    setBusy(true)
    setError(null)
    if (!coachId) {
      setError('Coach non disponibile. Riprova dopo aver effettuato nuovamente l’accesso.')
      setBusy(false)
      return
    }
    const payload = { name: name.trim(), description: description.trim(), price_cents: Math.round(priceNumber * 100), billing_type: billingType, duration_minutes: duration ? Number(duration) : 0, sessions_count: sessions ? Number(sessions) : null, pathway_days: pathwayDays ? Number(pathwayDays) : null, requires_intro_call: intro, appointment_type: appointmentType.trim() || null, is_active: active }
    const result = service
      ? await supabase.from('services').update(payload).eq('id', service.id).eq('coach_id', coachId)
      : await supabase.from('services').insert({ coach_id: coachId, ...payload })
    setBusy(false)
    if (result.error) { setError('Non è stato possibile salvare il servizio.'); return }
    onSaved()
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="modal-card exercise-modal" role="dialog" aria-modal="true" aria-labelledby="service-modal-title"><div className="modal-heading"><div><span className="eyebrow">{service ? 'Modifica servizio' : 'Nuovo servizio'}</span><h2 id="service-modal-title">Gestisci il<br /><em>servizio.</em></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div><form className="booking-form modal-form" onSubmit={(event) => void submit(event)}><label>Nome<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label>Descrizione<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="exercise-form-grid"><label>Prezzo (EUR)<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label>Fatturazione<input value={billingType} onChange={(event) => setBillingType(event.target.value)} /></label><label>Durata (minuti)<input type="number" min="0" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></label><label>Sessioni<input type="number" min="0" step="1" value={sessions} onChange={(event) => setSessions(event.target.value)} /></label><label>Durata percorso (giorni)<input type="number" min="0" step="1" value={pathwayDays} onChange={(event) => setPathwayDays(event.target.value)} /></label></div><label>Tipo appuntamento<input value={appointmentType} onChange={(event) => setAppointmentType(event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={intro} onChange={(event) => setIntro(event.target.checked)} /> Richiede call introduttiva</label><label className="checkbox-field"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Servizio attivo</label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Annulla</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Salvataggio...' : 'Salva servizio'} <ArrowUpRight size={17} /></button></div></form></section></div>
}

function MaterialClientRow({ material }: { material: MaterialRecord }) {
 return <article className="material-row"><div><strong>{material.title}</strong><span>{material.material_type}</span>{material.description && <p>{material.description}</p>}</div><a className="ghost-button" href={material.url} target="_blank" rel="noopener noreferrer">Apri <ArrowUpRight size={15} /></a></article>
}

function MaterialCoachRow({ material, clients, onEdit, onRefresh }: { material: MaterialRecord; clients: { id: string; full_name: string }[]; onEdit: () => void; onRefresh: () => void }) {
 const [busy, setBusy] = useState(false)
 const client = clients.find((item) => item.id === material.client_id)
 const toggleActive = async () => {
   if (busy) return
   setBusy(true)
   const result = await supabase.from('materials').update({ is_active: !material.is_active }).eq('id', material.id)
   setBusy(false)
   if (!result.error) onRefresh()
 }
 return <article className={`material-row ${!material.is_active ? 'is-inactive' : ''}`}><div><strong>{material.title}</strong><span>{client?.full_name || 'Cliente non indicato'} · {material.material_type} · {material.is_active ? 'Attivo' : 'Archiviato'}</span>{material.description && <p>{material.description}</p>}</div><div className="service-row-actions"><a className="ghost-button" href={material.url} target="_blank" rel="noopener noreferrer">Apri</a><button className="ghost-button" onClick={onEdit}>Modifica</button><button className="ghost-button" disabled={busy} onClick={() => void toggleActive()}>{material.is_active ? 'Archivia' : 'Riattiva'}</button></div></article>
}

function MaterialModal({ material, clients, onClose, onSaved }: { material: MaterialRecord | null; clients: { id: string; full_name: string }[]; onClose: () => void; onSaved: () => void }) {
 const { coachId } = useAuth()
 const [clientId, setClientId] = useState(material?.client_id ?? '')
 const [title, setTitle] = useState(material?.title ?? '')
 const [description, setDescription] = useState(material?.description ?? '')
 const [url, setUrl] = useState(material?.url ?? '')
 const [file, setFile] = useState<File | null>(null)
 const [materialType, setMaterialType] = useState(material?.material_type ?? 'LINK')
 const [active, setActive] = useState(material?.is_active ?? true)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState<string | null>(null)

 useEffect(() => {
   const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
   window.addEventListener('keydown', onKeyDown)
   return () => window.removeEventListener('keydown', onKeyDown)
 }, [busy, onClose])

 const submit = async (event: React.FormEvent<HTMLFormElement>) => {
   event.preventDefault()
   if (busy) return
   const normalizedTitle = title.trim()
   const normalizedUrl = url.trim()
   if (!clientId || !normalizedTitle || (!normalizedUrl && !file)) {
     setError('Inserisci cliente, titolo e URL oppure seleziona un file.')
     return
   }
   if (!coachId) {
     setError('Coach non disponibile. Riprova dopo aver effettuato nuovamente l’accesso.')
     return
   }
   if (!file && normalizedUrl) {
     try {
       const parsedUrl = new URL(normalizedUrl)
       if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('invalid')
     } catch {
       setError('Inserisci un URL valido con http:// o https://.')
       return
     }
   }
   setBusy(true)
   setError(null)
   let storedUrl = normalizedUrl
   let storedType = materialType.trim() || 'LINK'
   if (file) {
     const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
     storedUrl = `${clientId}/${crypto.randomUUID()}-${safeName}`
     const upload = await supabase.storage.from('coach-materials').upload(storedUrl, file, { upsert: false })
     if (upload.error) {
       setBusy(false)
       setError('Non è stato possibile caricare il file. Riprova.')
       return
     }
     storedType = 'FILE'
   } else if (material?.material_type === 'FILE') {
     storedUrl = material.file_path ?? material.url
     storedType = 'FILE'
   }
   const payload = { coach_id: coachId, client_id: clientId, title: normalizedTitle, description: description.trim(), url: storedUrl, material_type: storedType, is_active: active }
   const result = material
     ? await supabase.from('materials').update({ title: payload.title, description: payload.description, ...(file ? { url: payload.url, material_type: payload.material_type } : {}), is_active: payload.is_active }).eq('id', material.id)
     : await supabase.from('materials').insert(payload)
   setBusy(false)
   if (result.error) {
     setError('Non è stato possibile salvare il materiale. Riprova.')
     return
   }
   onSaved()
 }

 return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="modal-card exercise-modal" role="dialog" aria-modal="true" aria-labelledby="material-modal-title"><div className="modal-heading"><div><span className="eyebrow">{material ? 'Modifica materiale' : 'Nuovo materiale'}</span><h2 id="material-modal-title">Condividi una<br /><em>risorsa.</em></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div><form className="booking-form modal-form" onSubmit={(event) => void submit(event)}><label>Cliente<select required value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={Boolean(material)}><option value="">Seleziona cliente</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.full_name || 'Nome non indicato'}</option>)}</select></label><label>Titolo<input required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Descrizione<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label><label>URL<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /></label><label>File<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><div className="exercise-form-grid"><label>Tipo<input value={materialType} onChange={(event) => setMaterialType(event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Materiale attivo</label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Annulla</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Salvataggio...' : 'Salva materiale'} <ArrowUpRight size={17} /></button></div></form></section></div>
}

function PaymentRow({ payment, showClient, onEdit }: { payment: PaymentRecord; showClient: boolean; onEdit?: () => void }) {
  const appointmentLabel = payment.appointment
    ? `${formatDate(payment.appointment.starts_at)} · ${formatTime(payment.appointment.starts_at)}${payment.appointment.service?.name ? ` · ${payment.appointment.service.name}` : ''}`
    : 'Nessun appuntamento'
  return <article className="payment-row"><div><strong>{showClient ? payment.client?.full_name || 'Cliente non indicato' : payment.service?.name || 'Pagamento'}</strong><span>{showClient && payment.service?.name ? payment.service.name : appointmentLabel}</span><span>{payment.provider ? `Provider: ${payment.provider}` : 'Provider non indicato'}{payment.provider_reference ? ` · ${payment.provider_reference}` : ''}</span><span>{formatDate(payment.created_at)}</span></div><div className="payment-row-end"><strong>{formatEuro(payment.amount_cents)}</strong><span className={`status-dot payment-status-${payment.status.toLowerCase()}`}>{payment.status}</span>{onEdit && <button className="ghost-button" onClick={onEdit}>Modifica</button>}</div></article>
}

function PaymentModal({ payment, clients, initialClientId, onClose, onSaved }: { payment: PaymentRecord | null; clients: { id: string; full_name: string }[]; initialClientId?: string; onClose: () => void; onSaved: () => void }) {
  const { coachId } = useAuth()
  const servicesData = useServices(true, false, true)
  const [clientId, setClientId] = useState(payment?.client_id ?? initialClientId ?? '')
  const [serviceId, setServiceId] = useState(payment?.service_id ?? '')
  const [appointmentId, setAppointmentId] = useState(payment?.appointment_id ?? '')
  const [amount, setAmount] = useState(payment ? (payment.amount_cents / 100).toFixed(2) : '')
  const [status, setStatus] = useState<PaymentStatus>(payment?.status ?? 'PENDING')
  const [provider, setProvider] = useState(payment?.provider ?? '')
  const [providerReference, setProviderReference] = useState(payment?.provider_reference ?? '')
  const [appointments, setAppointments] = useState<{ id: string; starts_at: string; ends_at: string; service: { name: string } | null }[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  useEffect(() => {
    let active = true
    setAppointmentId(payment?.appointment_id ?? '')
    if (!clientId) {
      setAppointments([])
      return () => { active = false }
    }
    setAppointmentsLoading(true)
    void supabase.from('appointments').select('id, starts_at, ends_at, service:services(name)').eq('client_id', clientId).order('starts_at', { ascending: false }).then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) setError('Non è stato possibile caricare gli appuntamenti.')
      else setAppointments((data ?? []).map((item) => ({ ...item, service: Array.isArray(item.service) ? item.service[0] ?? null : item.service })) as typeof appointments)
      setAppointmentsLoading(false)
    })
    return () => { active = false }
  }, [clientId, payment?.appointment_id])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const amountCents = parseEuroToCents(amount)
    if (!clientId || amountCents === null || amountCents < 0 || amountCents > 1000000000) {
      setError('Inserisci cliente e un importo valido (massimo EUR 10.000.000).')
      return
    }
    if (serviceId && !servicesData.services.some((service) => service.id === serviceId)) {
      setError('Seleziona un servizio valido.')
      return
    }
    setBusy(true)
    setError(null)
    if (!coachId) {
      setError('Coach non disponibile. Riprova dopo aver effettuato nuovamente l’accesso.')
      setBusy(false)
      return
    }
    const payload = { coach_id: coachId, client_id: clientId, service_id: serviceId || null, appointment_id: appointmentId || null, amount_cents: amountCents, status, provider: provider.trim() || null, provider_reference: providerReference.trim() || null }
    const result = payment
      ? await supabase.from('payments').update({ service_id: payload.service_id, appointment_id: payload.appointment_id, amount_cents: payload.amount_cents, status: payload.status, provider: payload.provider, provider_reference: payload.provider_reference }).eq('id', payment.id)
      : await supabase.from('payments').insert(payload)
    setBusy(false)
    if (result.error) {
      setError('Non è stato possibile salvare il pagamento. Riprova.')
      return
    }
    onSaved()
  }

  const availableServices = servicesData.services.filter((service) => service.is_active || service.id === serviceId)
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="modal-card exercise-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title"><div className="modal-heading"><div><span className="eyebrow">{payment ? 'Modifica pagamento' : 'Nuovo pagamento'}</span><h2 id="payment-modal-title">Registra il<br /><em>pagamento.</em></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div><form className="booking-form modal-form" onSubmit={(event) => void submit(event)}><label>Cliente<select required value={clientId} onChange={(event) => { setClientId(event.target.value); setAppointmentId('') }} disabled={Boolean(payment || initialClientId)}><option value="">Seleziona cliente</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.full_name || 'Nome non indicato'}</option>)}</select></label><label>Servizio<select value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={servicesData.loading}><option value="">Nessun servizio</option>{availableServices.map((service) => <option value={service.id} key={service.id}>{service.name}{!service.is_active ? ' (inattivo)' : ''}</option>)}</select></label><label>Appuntamento<select value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)} disabled={!clientId || appointmentsLoading}><option value="">{appointmentsLoading ? 'Caricamento...' : appointments.length ? 'Nessun appuntamento' : 'Nessun appuntamento disponibile'}</option>{appointments.map((appointment) => <option value={appointment.id} key={appointment.id}>{formatDate(appointment.starts_at)} · {formatTime(appointment.starts_at)}{appointment.service?.name ? ` · ${appointment.service.name}` : ''}</option>)}</select></label><div className="exercise-form-grid"><label>Importo (EUR)<input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label><label>Stato<select value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus)}>{paymentStatuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></label></div><label>Provider<input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Es. bonifico" /></label><label>Riferimento provider<input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Annulla</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Salvataggio...' : 'Salva pagamento'} <ArrowUpRight size={17} /></button></div></form></section></div>
}

function CreateAppointmentModal({ clients, onClose, onCreated }: { clients: { id: string; full_name: string }[]; onClose: () => void; onCreated: () => void }) {
  const { coachId } = useAuth()
  const [services, setServices] = useState<{ id: string; name: string }[]>([])
  const [clientId, setClientId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState('PENDING')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const statuses = ['PENDING', 'BOOKED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']

  useEffect(() => {
    let active = true
    if (!coachId) {
      setServices([])
      return () => { active = false }
    }
    void supabase.from('services').select('id, name').eq('coach_id', coachId).eq('is_active', true).order('name').then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) setError('Non è stato possibile caricare i servizi.')
      else setServices(data ?? [])
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { active = false; window.removeEventListener('keydown', onKeyDown) }
  }, [busy, coachId, onClose])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    if (!clientId || !date || !time) {
      setError('Seleziona cliente, data e ora.')
      return
    }
    const minutes = Number(duration)
    const startsAt = new Date(`${date}T${time}`)
    if (!Number.isFinite(minutes) || minutes <= 0 || Number.isNaN(startsAt.getTime())) {
      setError('Inserisci una data, un’ora e una durata valide.')
      return
    }
    const endsAt = new Date(startsAt.getTime() + minutes * 60 * 1000)
    setBusy(true)
    setError(null)
    if (!coachId) {
      setError('Coach non disponibile. Riprova dopo aver effettuato nuovamente l’accesso.')
      setBusy(false)
      return
    }
    const result = await supabase.from('appointments').insert({
      coach_id: coachId,
      client_id: clientId,
      service_id: serviceId || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status,
      location: location.trim() || null,
    })
    setBusy(false)
    if (result.error) {
      setError('Non è stato possibile creare l’appuntamento. Riprova.')
      return
    }
    onCreated()
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-appointment-title">
      <div className="modal-heading"><div><span className="eyebrow">Nuovo appuntamento</span><h2 id="create-appointment-title">Organizza la<br /><em>sessione.</em></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div>
      <form className="booking-form modal-form" onSubmit={(event) => void submit(event)}>
        <label>Cliente<select required value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Seleziona cliente</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.full_name || 'Nome non indicato'}</option>)}</select></label>
        <label>Servizio<select value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="">Nessun servizio</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
        <div className="exercise-form-grid"><label>Data<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Ora<input required type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label><label>Durata (minuti)<input required type="number" min="1" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></label><label>Stato<select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></label></div>
        <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Studio / Online" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Annulla</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Salvataggio...' : 'Crea appuntamento'} <ArrowUpRight size={17} /></button></div>
      </form>
    </section>
  </div>
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return <div className="metric-card"><span className="eyebrow">{label}</span><strong>{value}</strong><span>Dati Supabase</span></div>
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '??'
}

function CoachAppointmentRow({ item, onEdit, onRefresh }: { item: CoachCalendarAppointment; onEdit: () => void; onRefresh: () => void }) {
  const cancel = async () => {
    if (item.status === 'CANCELLED' || !window.confirm('Cancellare questo appuntamento?')) return
    const result = await updateAppointment(item.id, { starts_at: item.starts_at, ends_at: item.ends_at, status: 'CANCELLED', location: item.location, meeting_url: item.meeting_url, notes: item.notes, payment_method: item.payment_method })
    if (result.error) window.alert(result.error.message.includes('appointments_no_active_overlap') ? 'Questo orario è già occupato.' : 'Non è stato possibile cancellare l’appuntamento.')
    else onRefresh()
  }
  return <div className="coach-appointment appointment-management-row"><span className="time-label">{formatTime(item.starts_at)}</span><span className="client-avatar">{initials(item.client?.full_name ?? '')}</span><div><strong>{item.client?.full_name || 'Cliente non indicato'}</strong><span>{item.service?.name || 'Servizio non indicato'} · {formatDate(item.starts_at)} · {formatTime(item.starts_at)} - {formatTime(item.ends_at)}</span><span>{item.location || 'Location non indicata'}{item.meeting_url ? ` · ${item.meeting_url}` : ''}{item.notes ? ` · ${item.notes}` : ''} · {item.payment_method}</span></div><span className="status-dot">{item.status}</span><div className="service-row-actions"><button className="ghost-button" onClick={onEdit}>Modifica</button>{item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && <button className="ghost-button danger-button" onClick={() => void cancel()}>Cancella</button>}</div></div>
}

function CoachProgramRow({ item }: { item: CoachProgram }) {
  return <button className="coach-appointment program-list-item" onClick={() => navigateToPath(`/dashboard/client/${item.client_id}/program/${item.id}`)}><span className="client-avatar">{initials(item.client?.full_name ?? '')}</span><div><strong>{item.client?.full_name || 'Cliente non indicato'} · {item.title}</strong><span>{item.service?.name || 'Servizio non indicato'} · {item.goal || 'Obiettivo non indicato'}{item.starts_at ? ` · Dal ${formatDate(item.starts_at)}` : ''}{item.ends_at ? ` al ${formatDate(item.ends_at)}` : ''}</span></div><span className="status-dot">{item.status}</span></button>
}

type EditableAppointment = {
  id: string
  service_id: string | null
  starts_at: string
  ends_at: string
  status: 'PENDING' | 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'
  location: string | null
  meeting_url: string | null
  notes: string | null
  payment_method: string
}

function AppointmentEditModal({ appointment, onClose, onSaved }: { appointment: EditableAppointment; onClose: () => void; onSaved: () => void }) {
  const { services, loading: servicesLoading } = useServices(true, false, true)
  const initialStart = new Date(appointment.starts_at)
  const [date, setDate] = useState(initialStart.toISOString().slice(0, 10))
  const [time, setTime] = useState(initialStart.toTimeString().slice(0, 5))
  const [duration, setDuration] = useState(String(Math.round((new Date(appointment.ends_at).getTime() - initialStart.getTime()) / 60000)))
  const [status, setStatus] = useState<EditableAppointment['status']>(appointment.status)
  const [location, setLocation] = useState(appointment.location ?? '')
  const [meetingUrl, setMeetingUrl] = useState(appointment.meeting_url ?? '')
  const [notes, setNotes] = useState(appointment.notes ?? '')
  const [paymentMethod, setPaymentMethod] = useState(appointment.payment_method)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const service = services.find((item) => item.id === appointment.service_id)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [busy, onClose])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const minutes = Number(duration)
    if (!date || !time || !Number.isInteger(minutes) || minutes <= 0 || (service && minutes !== service.duration_minutes)) {
      setError(service ? `La durata deve essere di ${service.duration_minutes} minuti.` : 'Inserisci una durata valida.')
      return
    }
    const startsAt = new Date(`${date}T${time}`)
    const endsAt = new Date(startsAt.getTime() + minutes * 60 * 1000)
    if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
      setError('Inserisci una data e un’ora future valide.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await updateAppointment(appointment.id, {
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status,
      location: location.trim() || null,
      meeting_url: meetingUrl.trim() || null,
      notes: notes.trim() || null,
      payment_method: paymentMethod.trim() || 'IN_PERSON',
    })
    setBusy(false)
    if (result.error) {
      setError(result.error.message.includes('appointments_no_active_overlap') ? 'Questo orario è già occupato.' : 'Non è stato possibile aggiornare l’appuntamento.')
      return
    }
    onSaved()
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="modal-card exercise-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-edit-title"><div className="modal-heading"><div><span className="eyebrow">Gestione appuntamento</span><h2 id="appointment-edit-title">Modifica la<br /><em>sessione.</em></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div><form className="booking-form modal-form" onSubmit={(event) => void submit(event)}><div className="exercise-form-grid"><label>Data<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Ora<input required type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label><label>Durata (minuti)<input required type="number" min="1" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} disabled={Boolean(service)} /></label><label>Stato<select value={status} onChange={(event) => setStatus(event.target.value as EditableAppointment['status'])}>{['PENDING', 'BOOKED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'].map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div><label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} /></label><label>Meeting URL<input type="url" value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} /></label><label>Metodo pagamento<input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} /></label><label>Note<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>{servicesLoading && <p className="muted">Caricamento servizio...</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Annulla</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Salvataggio...' : 'Salva modifiche'} <ArrowUpRight size={17} /></button></div></form></section></div>
}

function ClientDetailPage({ clientId, go }: { clientId: string | undefined; go: (view: View) => void }) {
  const { profile } = useAuth()
  const { profile: client, programs, appointments, packages, notes, loading, error, refresh, updateProfile } = useClientDetail(clientId, profile?.role === 'COACH')
  const questionnaireData = useQuestionnaire(clientId, profile?.role === 'COACH')
  const paymentsData = usePayments({ clientId, enabled: profile?.role === 'COACH' && Boolean(clientId) })
  const [programModalOpen, setProgramModalOpen] = useState(false)
  const [packageModal, setPackageModal] = useState<ClientDetailPackage | null | undefined>(undefined)
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [paymentModal, setPaymentModal] = useState<PaymentRecord | null | undefined>(undefined)
  const [appointmentToEdit, setAppointmentToEdit] = useState<ClientDetailAppointment | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const now = Date.now()

  if (loading) return <main className="app-page dashboard-page"><button className="back-link" onClick={() => go('coach')}><ChevronRight size={16} className="rotate" /> Torna ai clienti</button><div className="data-state"><span className="eyebrow">Scheda cliente</span><p>Caricamento dei dati...</p></div></main>
  if (error) return <main className="app-page dashboard-page"><button className="back-link" onClick={() => go('coach')}><ChevronRight size={16} className="rotate" /> Torna ai clienti</button><div className="data-state data-error" role="alert"><span className="eyebrow">Errore</span><p>{error}</p></div></main>
  if (!client) return <main className="app-page dashboard-page"><button className="back-link" onClick={() => go('coach')}><ChevronRight size={16} className="rotate" /> Torna ai clienti</button><div className="data-state"><span className="eyebrow">Scheda cliente</span><h2>Cliente non trovato.</h2><p>Il cliente non esiste o non è accessibile con il tuo ruolo.</p></div></main>

  const upcoming = appointments.filter((item) => new Date(item.starts_at).getTime() >= now)
  const past = appointments.filter((item) => new Date(item.starts_at).getTime() < now).reverse()

  return <main className="app-page dashboard-page">
    <button className="back-link" onClick={() => go('coach')}><ChevronRight size={16} className="rotate" /> Torna ai clienti</button>
    <div className="detail-heading coach-client-heading"><div><span className="eyebrow">Scheda cliente</span>{editingProfile ? <div className="profile-edit-fields"><label>Nome e cognome<input value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label><label>Avatar URL<input type="url" value={profileAvatar} onChange={(event) => setProfileAvatar(event.target.value)} placeholder="https://..." /></label><div className="service-row-actions"><button className="primary-button compact" disabled={profileSaving} onClick={() => void (async () => { setProfileSaving(true); setProfileMessage(null); const saveError = await updateProfile({ full_name: profileName, avatar_url: profileAvatar }); setProfileSaving(false); if (saveError) setProfileMessage(saveError); else { setEditingProfile(false); setProfileMessage('Dati anagrafici salvati.'); } })()}>{profileSaving ? 'Salvataggio...' : 'Salva'}</button><button className="ghost-button" disabled={profileSaving} onClick={() => { setEditingProfile(false); setProfileMessage(null) }}>Annulla</button></div>{profileMessage && <p className="form-message" role="status">{profileMessage}</p>}</div> : <><h1>{client.full_name || 'Nome non indicato'}</h1><p>Iscritto il {formatDate(client.created_at)}</p><button className="ghost-button" onClick={() => { setProfileName(client.full_name); setProfileAvatar(client.avatar_url ?? ''); setProfileMessage(null); setEditingProfile(true) }}><Pencil size={15} /> Modifica dati</button>{profileMessage && <p className="form-message" role="status">{profileMessage}</p>}</>}</div><span className="client-avatar detail-avatar">{initials(client.full_name)}</span></div>
    <div className="detail-grid">
      <section className="panel detail-section"><div className="panel-heading"><div><span className="eyebrow">Percorso</span><h2>Programmi</h2></div><button className="primary-button compact" onClick={() => setProgramModalOpen(true)}><Plus size={16} /> Nuovo programma</button></div>{successMessage && <p className="form-message" role="status">{successMessage}</p>}{programs.length ? programs.map((item) => <DetailProgram item={item} key={item.id} onOpen={() => navigateToPath(`/dashboard/client/${client.id}/program/${item.id}`)} />) : <EmptyState title="Nessun programma" text="Non risultano programmi per questo cliente." />}</section>
      <section className="panel detail-section"><div className="panel-heading"><div><span className="eyebrow">Sessioni</span><h2>Pacchetti</h2></div><button className="primary-button compact" onClick={() => setPackageModal(null)}><Plus size={16} /> Nuovo pacchetto</button></div>{packages.length ? packages.map((item) => <DetailPackage item={item} key={item.id} onEdit={() => setPackageModal(item)} onRefresh={refresh} />) : <EmptyState title="Nessun pacchetto" text="Non risultano pacchetti associati." />}</section>
      <section className="panel detail-section detail-wide"><div className="panel-heading"><div><span className="eyebrow">Agenda</span><h2>Appuntamenti futuri</h2></div></div>{upcoming.length ? upcoming.map((item) => <DetailAppointment item={item} onEdit={() => setAppointmentToEdit(item)} key={item.id} />) : <EmptyState title="Nessun appuntamento" text="Non risultano appuntamenti futuri." />}</section>
      <section className="panel detail-section detail-wide"><div className="panel-heading"><div><span className="eyebrow">Storico</span><h2>Appuntamenti passati</h2></div></div>{past.length ? past.map((item) => <DetailAppointment item={item} onEdit={() => setAppointmentToEdit(item)} key={item.id} />) : <EmptyState title="Nessuno storico" text="Non risultano appuntamenti passati." />}</section>
      <section className="panel detail-section detail-wide"><div className="panel-heading"><div><span className="eyebrow">Note coach</span><h2>Note private</h2></div></div>{notes.length ? notes.map((note) => <div className="note-row" key={note.id}><p>{note.body}</p><span>{formatDate(note.created_at)}</span></div>) : <EmptyState title="Nessuna nota" text="Le note coach per questo cliente non sono ancora disponibili." />}</section>
      <section className="panel detail-section detail-wide"><div className="panel-heading"><div><span className="eyebrow">Onboarding</span><h2>Questionario</h2></div><span className="status-pill">{questionnaireData.questionnaire?.submitted_at ? 'Compilato' : 'Da compilare'}</span></div>{questionnaireData.loading ? <p className="muted">Caricamento questionario...</p> : <><p className="questionnaire-summary">{questionnaireData.questionnaire?.submitted_at ? `Completato il ${formatDate(questionnaireData.questionnaire.submitted_at)}` : 'Il cliente non ha ancora completato il questionario.'}</p><button className="primary-button compact" onClick={() => setQuestionnaireOpen(true)} disabled={!questionnaireData.questionnaire}>Visualizza questionario <ArrowUpRight size={16} /></button></>}</section>
      <section className="panel detail-section detail-wide"><div className="panel-heading"><div><span className="eyebrow">Amministrazione</span><h2>Pagamenti</h2></div><button className="primary-button compact" onClick={() => setPaymentModal(null)}><Plus size={16} /> Nuovo pagamento</button></div>{paymentsData.loading && <p className="muted">Caricamento pagamenti...</p>}{paymentsData.error && <p className="form-error" role="alert">{paymentsData.error}</p>}{!paymentsData.loading && !paymentsData.error && (paymentsData.payments.length ? paymentsData.payments.map((payment) => <PaymentRow payment={payment} showClient={false} onEdit={() => setPaymentModal(payment)} key={payment.id} />) : <EmptyState title="Nessun pagamento" text="Non risultano pagamenti per questo cliente." />)}</section>
    </div>
    {programModalOpen && <CreateProgramModal clientId={client.id} onClose={() => setProgramModalOpen(false)} onCreated={() => { setProgramModalOpen(false); setSuccessMessage('Programma creato correttamente.'); refresh(); window.setTimeout(() => setSuccessMessage(null), 4000) }} />}
    {packageModal !== undefined && <PackageModal clientId={client.id} packageItem={packageModal} onClose={() => setPackageModal(undefined)} onSaved={() => { setPackageModal(undefined); refresh(); setSuccessMessage('Pacchetto salvato correttamente.'); window.setTimeout(() => setSuccessMessage(null), 4000) }} />}
    {questionnaireOpen && <QuestionnaireModal clientId={client.id} questionnaire={questionnaireData.questionnaire} onClose={() => setQuestionnaireOpen(false)} />}
    {paymentModal !== undefined && <PaymentModal payment={paymentModal} clients={[client]} initialClientId={client.id} onClose={() => setPaymentModal(undefined)} onSaved={() => { setPaymentModal(undefined); paymentsData.refresh(); setSuccessMessage('Pagamento salvato correttamente.'); window.setTimeout(() => setSuccessMessage(null), 4000) }} />}
    {appointmentToEdit && <AppointmentEditModal appointment={appointmentToEdit} onClose={() => setAppointmentToEdit(null)} onSaved={() => { setAppointmentToEdit(null); refresh() }} />}
  </main>
}

type ServiceOption = { id: string; name: string }

function CreateProgramModal({ clientId, onClose, onCreated }: { clientId: string; onClose: () => void; onCreated: () => void }) {
  const { coachId } = useAuth()
  const [services, setServices] = useState<ServiceOption[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const loadServices = async () => {
      if (!coachId) {
        setServices([])
        setServicesLoading(false)
        return
      }
      const result = await supabase.from('services').select('id, name').eq('coach_id', coachId).eq('is_active', true).order('name', { ascending: true })
      if (!active) return
      if (result.error) setServicesError('Non è stato possibile caricare i servizi.')
      else setServices(result.data ?? [])
      setServicesLoading(false)
    }
    void loadServices()
    return () => { active = false }
  }, [coachId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const normalizedTitle = title.trim()
    const normalizedGoal = goal.trim()
    if (!normalizedTitle) {
      setError('Inserisci il titolo del programma.')
      return
    }
    if ((startsAt && Number.isNaN(new Date(startsAt).getTime())) || (endsAt && Number.isNaN(new Date(endsAt).getTime()))) {
      setError('Inserisci date valide.')
      return
    }
    if (startsAt && endsAt && endsAt < startsAt) {
      setError('La data fine non può precedere la data di inizio.')
      return
    }
    if (serviceId && !services.some((service) => service.id === serviceId)) {
      setError('Seleziona un servizio valido.')
      return
    }
    if (status !== 'ACTIVE') {
      setError('Seleziona uno stato valido.')
      return
    }

    setBusy(true)
    setError(null)
    if (!coachId) {
      setError('Coach non disponibile. Riprova dopo aver effettuato nuovamente l’accesso.')
      setBusy(false)
      return
    }
    const payload: { coach_id: string; client_id: string; title: string; status: string; service_id?: string; starts_at?: string; ends_at?: string; goal?: string } = {
      coach_id: coachId,
      client_id: clientId,
      title: normalizedTitle,
      status,
    }
    if (serviceId) payload.service_id = serviceId
    if (startsAt) payload.starts_at = startsAt
    if (endsAt) payload.ends_at = endsAt
    if (normalizedGoal) payload.goal = normalizedGoal
    const result = await supabase.from('client_programs').insert(payload)
    setBusy(false)
    if (result.error) {
      setError('Non è stato possibile salvare il programma. Riprova.')
      return
    }
    onCreated()
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="modal-card program-modal" role="dialog" aria-modal="true" aria-labelledby="create-program-title">
      <div className="modal-heading"><div><span className="eyebrow">Nuovo programma</span><h2 id="create-program-title">Costruisci il<br /><em>percorso.</em></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div>
      <form className="booking-form modal-form" onSubmit={(event) => void submit(event)}>
        <label>Titolo<input required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Es. Forza e controllo" /></label>
        <label>Obiettivo<textarea rows={3} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Obiettivo del percorso..." /></label>
        <label>Servizio<select value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={servicesLoading || Boolean(servicesError)}><option value="">{servicesLoading ? 'Caricamento servizi...' : servicesError ? 'Servizi non disponibili' : 'Nessun servizio'}</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
        <label>Stato<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ACTIVE">ACTIVE</option></select></label>
        <label>Data inizio<input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label>Data fine<input type="date" min={startsAt || undefined} value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Annulla</button><button className="primary-button" type="submit" disabled={busy || Boolean(servicesError)}>{busy ? 'Salvataggio...' : 'Crea programma'} <ArrowUpRight size={17} /></button></div>
      </form>
    </section>
  </div>
}

function ProgramDetailPage({ clientId, programId }: { clientId: string | undefined; programId: string | undefined }) {
  const { profile } = useAuth()
  const { program, exercises, loading, error, refresh, updateExercise, deleteExercise, moveExercise } = useProgramDetail(programId, clientId, profile?.role === 'COACH')
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState<ProgramExercise | null>(null)
  const [deletingExercise, setDeletingExercise] = useState<ProgramExercise | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (loading) return <main className="app-page dashboard-page"><button className="back-link" onClick={() => clientId && navigateToPath(`/dashboard/client/${clientId}`)}><ChevronRight size={16} className="rotate" /> Torna al cliente</button><div className="data-state"><span className="eyebrow">Programma</span><p>Caricamento dei dati...</p></div></main>
  if (error) return <main className="app-page dashboard-page"><button className="back-link" onClick={() => clientId && navigateToPath(`/dashboard/client/${clientId}`)}><ChevronRight size={16} className="rotate" /> Torna al cliente</button><div className="data-state data-error" role="alert"><span className="eyebrow">Errore</span><p>{error}</p></div></main>
  if (!program || !clientId) return <main className="app-page dashboard-page"><button className="back-link" onClick={() => clientId && navigateToPath(`/dashboard/client/${clientId}`)}><ChevronRight size={16} className="rotate" /> Torna al cliente</button><div className="data-state"><span className="eyebrow">Programma</span><h2>Programma non trovato.</h2><p>Il programma non esiste o non appartiene al cliente indicato.</p></div></main>

  return <main className="app-page dashboard-page">
    <button className="back-link" onClick={() => navigateToPath(`/dashboard/client/${clientId}`)}><ChevronRight size={16} className="rotate" /> Torna al cliente</button>
    <div className="detail-heading coach-program-heading"><div><span className="eyebrow">Programma del cliente</span><h1>{program.title}</h1><p>{program.service?.name || 'Programma personalizzato'}{program.goal ? ` · ${program.goal}` : ''}</p></div><span className="status-pill">{program.status}</span></div>
    <div className="detail-grid program-detail-grid">
      <section className="panel detail-section"><div className="panel-heading"><div><span className="eyebrow">Riepilogo</span><h2>Programma</h2></div></div><div className="program-meta"><span>Servizio<strong>{program.service?.name || 'Non indicato'}</strong></span><span>Obiettivo<strong>{program.goal || 'Non indicato'}</strong></span><span>Periodo<strong>{program.starts_at ? formatDate(program.starts_at) : 'Non indicato'}{program.ends_at ? ` - ${formatDate(program.ends_at)}` : ''}</strong></span></div></section>
      <section className="panel detail-section detail-wide"><div className="panel-heading"><div><span className="eyebrow">Allenamento</span><h2>Esercizi</h2></div><button className="primary-button compact" onClick={() => setExerciseModalOpen(true)}><Plus size={16} /> Aggiungi esercizio</button></div>{successMessage && <p className="form-message" role="status">{successMessage}</p>}{operation && <p className="form-error" role="alert">{operation}</p>}{exercises.length ? <div className="exercise-list">{exercises.map((exercise, index) => <ExerciseRow exercise={exercise} key={exercise.id} disabled={Boolean(operation)} isFirst={index === 0} isLast={index === exercises.length - 1} onEdit={() => setEditingExercise(exercise)} onDelete={() => setDeletingExercise(exercise)} onMove={async (direction) => { setOperation('Riordinamento...'); const result = await moveExercise(exercise.id, direction); setOperation(result ? 'Non è stato possibile riordinare gli esercizi.' : null) }} />)}</div> : <EmptyState title="Nessun esercizio" text="Aggiungi il primo esercizio a questo programma." />}</section>
    </div>
    {(exerciseModalOpen || editingExercise) && <CreateExerciseModal programId={program.id} exercises={exercises} exercise={editingExercise} onClose={() => { setExerciseModalOpen(false); setEditingExercise(null) }} onCreated={() => { setExerciseModalOpen(false); setEditingExercise(null); setSuccessMessage(editingExercise ? 'Esercizio aggiornato correttamente.' : 'Esercizio aggiunto correttamente.'); refresh(); window.setTimeout(() => setSuccessMessage(null), 4000) }} onUpdate={updateExercise} />}
    {deletingExercise && <DeleteExerciseModal exercise={deletingExercise} onClose={() => setDeletingExercise(null)} onDeleted={async () => { setOperation('Eliminazione...'); const result = await deleteExercise(deletingExercise.id); setOperation(null); if (result) return 'Non è stato possibile eliminare l’esercizio.'; setDeletingExercise(null); setSuccessMessage('Esercizio eliminato correttamente.'); window.setTimeout(() => setSuccessMessage(null), 4000); return null }} />}
  </main>
}

function ExerciseRow({ exercise, disabled, isFirst, isLast, onEdit, onDelete, onMove }: { exercise: ProgramExercise; disabled: boolean; isFirst: boolean; isLast: boolean; onEdit: () => void; onDelete: () => void; onMove: (direction: 'up' | 'down') => void }) {
  const metrics = [
    exercise.sets !== null ? { label: 'Serie', value: exercise.sets } : null,
    exercise.reps ? { label: 'Ripetizioni', value: exercise.reps } : null,
    exercise.duration_seconds !== null ? { label: 'Durata', value: `${exercise.duration_seconds}s` } : null,
    exercise.rest_seconds !== null ? { label: 'Recupero', value: `${exercise.rest_seconds}s` } : null,
    exercise.load ? { label: 'Carico', value: exercise.load } : null,
  ].filter((metric) => metric !== null)
  return <article className="exercise-row coach-exercise-row"><div className="exercise-position">{exercise.position.toString().padStart(2, '0')}</div><div className="exercise-content"><div className="exercise-title-row"><strong>{exercise.exercise_name}</strong>{exercise.video_url && <a className="exercise-video-link" href={exercise.video_url} target="_blank" rel="noreferrer">Video <ArrowUpRight size={14} /></a>}</div>{metrics.length > 0 && <div className="exercise-metrics">{metrics.map((metric) => <span key={metric.label}><small>{metric.label}</small><b>{metric.value}</b></span>)}</div>}{exercise.notes && <p className="exercise-notes">{exercise.notes}</p>}</div><div className="exercise-actions"><button className="icon-button" aria-label={`Sposta ${exercise.exercise_name} in alto`} disabled={disabled || isFirst} onClick={() => onMove('up')}><ChevronUp size={17} /></button><button className="icon-button" aria-label={`Sposta ${exercise.exercise_name} in basso`} disabled={disabled || isLast} onClick={() => onMove('down')}><ChevronDown size={17} /></button><button className="icon-button" aria-label={`Modifica ${exercise.exercise_name}`} disabled={disabled} onClick={onEdit}><Pencil size={15} /></button><button className="icon-button danger-button" aria-label={`Elimina ${exercise.exercise_name}`} disabled={disabled} onClick={onDelete}><Trash2 size={15} /></button></div></article>
}

const questionnaireOptions = {
  goals: ['Aumento massa muscolare', 'Perdita di grasso', 'Forza', 'Calisthenics', 'Skills', 'Ricomposizione corporea', 'Performance', 'Altro'],
  levels: ['Principiante', 'Intermedio', 'Avanzato'],
  durations: ['<30 min', '30–45 min', '45–60 min', '60–90 min', '>90 min'],
  places: ['Casa', 'Palestra', 'Outdoor', 'Altro'],
  equipment: ['Nessuna', 'Sbarra', 'Parallele', 'Anelli', 'Elastici', 'Pesi', 'Palestra', 'Altro'],
}

function QuestionnaireModal({ clientId, questionnaire, editable = false, onClose, onSaved, onSave }: { clientId: string | undefined; questionnaire: Questionnaire | null; editable?: boolean; onClose: () => void; onSaved?: () => void; onSave?: (answers: Record<string, unknown>, injuryNotes: string) => Promise<Error | null> }) {
  const answers = questionnaire?.answers ?? {}
  const [form, setForm] = useState({
    mainGoal: stringAnswer(answers.main_goal),
    specificGoal: stringAnswer(answers.specific_goal),
    experienceLevel: stringAnswer(answers.experience_level),
    calisthenicsExperience: stringAnswer(answers.calisthenics_experience),
    trainingDays: stringAnswer(answers.training_days),
    workoutDuration: stringAnswer(answers.workout_duration),
    equipment: arrayAnswer(answers.equipment),
    trainingPlace: stringAnswer(answers.training_place),
    medicalHistory: stringAnswer(answers.medical_history),
    currentActivity: stringAnswer(answers.current_activity),
    otherSports: stringAnswer(answers.other_sports),
    additionalNotes: stringAnswer(answers.additional_notes),
  })
  const [injuryNotes, setInjuryNotes] = useState(questionnaire?.injury_notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [busy, onClose])
  const update = (key: keyof typeof form, value: string | string[]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editable || !onSave || busy) return
    if (!form.mainGoal || !form.experienceLevel || !form.trainingDays || Number(form.trainingDays) < 0) {
      setError('Compila obiettivo, livello e giorni disponibili.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await onSave({
      main_goal: form.mainGoal,
      specific_goal: form.specificGoal,
      experience_level: form.experienceLevel,
      calisthenics_experience: form.calisthenicsExperience,
      training_days: Number(form.trainingDays),
      workout_duration: form.workoutDuration,
      equipment: form.equipment,
      training_place: form.trainingPlace,
      medical_history: form.medicalHistory,
      current_activity: form.currentActivity,
      other_sports: form.otherSports,
      additional_notes: form.additionalNotes,
    }, injuryNotes)
    setBusy(false)
    if (result) setError('Non è stato possibile salvare il questionario. Riprova.')
    else onSaved?.()
  }
  const fieldDisabled = !editable || busy
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="modal-card questionnaire-modal" role="dialog" aria-modal="true" aria-labelledby="questionnaire-title"><div className="modal-heading"><div><span className="eyebrow">{editable ? 'Onboarding cliente' : 'Questionario cliente'}</span><h2 id="questionnaire-title">Conosci il tuo<br /><em>percorso.</em></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div><form className="booking-form modal-form" onSubmit={(event) => void submit(event)}>
    <label>Obiettivo principale<select required disabled={fieldDisabled} value={form.mainGoal} onChange={(event) => update('mainGoal', event.target.value)}><option value="">Seleziona obiettivo</option>{questionnaireOptions.goals.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
    <label>Obiettivo specifico<textarea disabled={fieldDisabled} rows={3} value={form.specificGoal} onChange={(event) => update('specificGoal', event.target.value)} /></label>
    <label>Livello di esperienza<select required disabled={fieldDisabled} value={form.experienceLevel} onChange={(event) => update('experienceLevel', event.target.value)}><option value="">Seleziona livello</option>{questionnaireOptions.levels.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
    <label>Esperienza con calisthenics<textarea disabled={fieldDisabled} rows={2} value={form.calisthenicsExperience} onChange={(event) => update('calisthenicsExperience', event.target.value)} /></label>
    <div className="exercise-form-grid"><label>Giorni disponibili<input required disabled={fieldDisabled} type="number" min="0" step="1" value={form.trainingDays} onChange={(event) => update('trainingDays', event.target.value)} /></label><label>Durata media<select disabled={fieldDisabled} value={form.workoutDuration} onChange={(event) => update('workoutDuration', event.target.value)}><option value="">Seleziona durata</option>{questionnaireOptions.durations.map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div>
    <fieldset disabled={fieldDisabled}><legend>Attrezzatura disponibile</legend><div className="questionnaire-checkboxes">{questionnaireOptions.equipment.map((value) => <label className={`checkbox-field ${form.equipment.includes(value) ? 'is-selected' : ''}`} key={value}><input type="checkbox" checked={form.equipment.includes(value)} onChange={(event) => update('equipment', event.target.checked ? [...form.equipment, value] : form.equipment.filter((item) => item !== value))} /><span>{value}</span></label>)}</div></fieldset>
    <label>Luogo principale di allenamento<select disabled={fieldDisabled} value={form.trainingPlace} onChange={(event) => update('trainingPlace', event.target.value)}><option value="">Seleziona luogo</option>{questionnaireOptions.places.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
    <label>Infortuni / dolori / limitazioni<textarea disabled={fieldDisabled} rows={3} value={injuryNotes} onChange={(event) => setInjuryNotes(event.target.value)} /></label>
    <label>Esperienze mediche rilevanti<textarea disabled={fieldDisabled} rows={3} value={form.medicalHistory} onChange={(event) => update('medicalHistory', event.target.value)} /></label>
    <label>Attività fisica attuale<textarea disabled={fieldDisabled} rows={2} value={form.currentActivity} onChange={(event) => update('currentActivity', event.target.value)} /></label>
    <label>Altri sport praticati<textarea disabled={fieldDisabled} rows={2} value={form.otherSports} onChange={(event) => update('otherSports', event.target.value)} /></label>
    <label>Note aggiuntive<textarea disabled={fieldDisabled} rows={3} value={form.additionalNotes} onChange={(event) => update('additionalNotes', event.target.value)} /></label>
    {questionnaire?.submitted_at && !editable && <p className="questionnaire-summary">Compilato il {formatDate(questionnaire.submitted_at)} · Aggiornato il {formatDate(questionnaire.updated_at)}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Chiudi</button>{editable && <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Salvataggio...' : questionnaire ? 'Salva modifiche' : 'Invia questionario'} <ArrowUpRight size={17} /></button>}</div>
  </form></section></div>
}

function stringAnswer(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function arrayAnswer(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function CreateExerciseModal({ programId, exercises, exercise, onClose, onCreated, onUpdate }: { programId: string; exercises: ProgramExercise[]; exercise: ProgramExercise | null; onClose: () => void; onCreated: () => void; onUpdate: (exerciseId: string, input: Omit<ProgramExercise, 'id' | 'program_id' | 'position' | 'created_at'>) => Promise<Error | null> }) {
  const [exerciseName, setExerciseName] = useState(exercise?.exercise_name ?? '')
  const [sets, setSets] = useState(exercise?.sets?.toString() ?? '')
  const [reps, setReps] = useState(exercise?.reps ?? '')
  const [duration, setDuration] = useState(exercise?.duration_seconds?.toString() ?? '')
  const [rest, setRest] = useState(exercise?.rest_seconds?.toString() ?? '')
  const [load, setLoad] = useState(exercise?.load ?? '')
  const [notes, setNotes] = useState(exercise?.notes ?? '')
  const [videoUrl, setVideoUrl] = useState(exercise?.video_url ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const normalizedName = exerciseName.trim()
    if (!normalizedName) {
      setError('Inserisci il nome dell’esercizio.')
      return
    }
    const numericFields = [{ value: sets, label: 'serie' }, { value: duration, label: 'durata' }, { value: rest, label: 'recupero' }]
    if (numericFields.some(({ value }) => value && (!Number.isInteger(Number(value)) || Number(value) < 0))) {
      setError('Serie, durata e recupero devono essere numeri interi non negativi.')
      return
    }
    if (videoUrl) {
      try {
        const url = new URL(videoUrl)
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid')
      } catch {
        setError('Inserisci un URL video valido.')
        return
      }
    }
    setBusy(true)
    setError(null)
    const payload: Omit<ProgramExercise, 'id' | 'program_id' | 'position' | 'created_at'> = {
      exercise_name: normalizedName,
      sets: sets ? Number(sets) : null,
      reps: reps.trim() || null,
      duration_seconds: duration ? Number(duration) : null,
      rest_seconds: rest ? Number(rest) : null,
      load: load.trim() || null,
      notes: notes.trim() || null,
      video_url: videoUrl.trim() || null,
    }
    const result = exercise
      ? await onUpdate(exercise.id, payload)
      : await (async () => {
        const position = exercises.reduce((highest, item) => Math.max(highest, item.position), 0) + 1
        const insertResult = await supabase.from('program_exercises').insert({ program_id: programId, position, ...payload })
        return insertResult.error
      })()
    setBusy(false)
    if (result) {
      setError(exercise ? 'Non è stato possibile aggiornare l’esercizio. Riprova.' : 'Non è stato possibile salvare l’esercizio. Riprova.')
      return
    }
    onCreated()
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="modal-card exercise-modal" role="dialog" aria-modal="true" aria-labelledby="create-exercise-title">
      <div className="modal-heading"><div><span className="eyebrow">{exercise ? 'Modifica esercizio' : 'Nuovo esercizio'}</span><h2 id="create-exercise-title">{exercise ? <>Modifica il<br /><em>movimento.</em></> : <>Aggiungi un<br /><em>movimento.</em></>}</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div>
      <form className="booking-form modal-form" onSubmit={(event) => void submit(event)}>
        <label>Nome esercizio<input required autoFocus value={exerciseName} onChange={(event) => setExerciseName(event.target.value)} placeholder="Es. Pull-up" /></label>
        <div className="exercise-form-grid"><label>Serie<input type="number" min="0" step="1" value={sets} onChange={(event) => setSets(event.target.value)} /></label><label>Ripetizioni<input value={reps} onChange={(event) => setReps(event.target.value)} placeholder="8-10 / AMRAP" /></label><label>Durata (secondi)<input type="number" min="0" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></label><label>Recupero (secondi)<input type="number" min="0" step="1" value={rest} onChange={(event) => setRest(event.target.value)} /></label></div>
        <label>Carico<input value={load} onChange={(event) => setLoad(event.target.value)} placeholder="BW / +10 kg" /></label>
        <label>Note<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <label>Video URL<input type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://..." /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Annulla</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Salvataggio...' : exercise ? 'Salva modifiche' : 'Aggiungi esercizio'} <ArrowUpRight size={17} /></button></div>
      </form>
    </section>
  </div>
}

function DeleteExerciseModal({ exercise, onClose, onDeleted }: { exercise: ProgramExercise; onClose: () => void; onDeleted: () => Promise<string | null> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    const result = await onDeleted()
    setBusy(false)
    if (result) setError(result)
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-exercise-title">
      <div className="modal-heading"><div><span className="eyebrow">Conferma eliminazione</span><h2 id="delete-exercise-title">Eliminare<br /><em>l’esercizio?</em></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div>
      <p className="delete-confirmation">Stai per eliminare <strong>{exercise.exercise_name}</strong>. Questa azione non può essere annullata.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Annulla</button><button type="button" className="danger-button danger-action" onClick={() => void confirm()} disabled={busy}>{busy ? 'Eliminazione...' : 'Elimina'} <Trash2 size={16} /></button></div>
    </section>
  </div>
}

function DetailProgram({ item, onOpen }: { item: ClientDetailProgram; onOpen: () => void }) {
  return <button className="detail-row detail-program-row" onClick={onOpen}><div><strong>{item.title}</strong><span>{item.service?.name || 'Servizio non indicato'} · {item.goal || 'Obiettivo non indicato'}</span><span>{item.starts_at ? `Dal ${formatDate(item.starts_at)}` : 'Data inizio non indicata'}{item.ends_at ? ` al ${formatDate(item.ends_at)}` : ''}</span></div><span className="status-dot">{item.status}</span><ChevronRight size={17} /></button>
}

function DetailAppointment({ item, onEdit }: { item: ClientDetailAppointment; onEdit?: () => void }) {
  return <div className="detail-row"><div><strong>{item.service?.name || 'Servizio non indicato'}</strong><span>{formatDate(item.starts_at)} · {formatTime(item.starts_at)} - {formatTime(item.ends_at)}{item.location ? ` · ${item.location}` : ''}</span><span>{item.meeting_url || ''}{item.notes ? ` · ${item.notes}` : ''} · {item.payment_method}</span></div><div className="service-row-actions"><span className="status-dot">{item.status}</span>{onEdit && <button className="ghost-button" onClick={onEdit}>Modifica</button>}</div></div>
}

function DetailPackage({ item, onEdit, onRefresh }: { item: ClientDetailPackage; onEdit: () => void; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false)
  const archive = async () => {
    if (busy || item.status === 'ARCHIVED') return
    if (!window.confirm(`Archiviare il pacchetto ${item.service?.name || 'selezionato'}?`)) return
    setBusy(true)
    const result = await supabase.from('packages').update({ status: 'ARCHIVED' }).eq('id', item.id).eq('client_id', item.client_id)
    setBusy(false)
    if (!result.error) onRefresh()
  }
  return <div className={`detail-row package-management-row ${item.status === 'ARCHIVED' ? 'is-inactive' : ''}`}><div><strong>{item.service?.name || 'Pacchetto coaching'}</strong><span>{item.used_sessions} utilizzate · {Math.max(item.total_sessions - item.used_sessions, 0)} disponibili su {item.total_sessions}</span><span>Acquistato il {formatDate(item.purchased_at)}{item.starts_at ? ` · Dal ${formatDate(item.starts_at)}` : ''}{item.expires_at ? ` · Fino al ${formatDate(item.expires_at)}` : ''}</span></div><div className="service-row-actions"><span className="status-dot">{item.status}</span><button className="ghost-button" onClick={onEdit}>Modifica</button><button className="ghost-button" disabled={busy || item.status === 'ARCHIVED'} onClick={() => void archive()}>Archivia</button></div></div>
}

function PackageModal({ clientId, packageItem, onClose, onSaved }: { clientId: string; packageItem: ClientDetailPackage | null; onClose: () => void; onSaved: () => void }) {
  const { coachId } = useAuth()
  const { services, loading: servicesLoading } = useServices(true, false, true)
  const [serviceId, setServiceId] = useState(packageItem?.service_id ?? '')
  const [total, setTotal] = useState(packageItem?.total_sessions.toString() ?? '')
  const [used, setUsed] = useState(packageItem?.used_sessions.toString() ?? '0')
  const [purchased, setPurchased] = useState(packageItem?.purchased_at ? packageItem.purchased_at.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [starts, setStarts] = useState(packageItem?.starts_at ?? '')
  const [expires, setExpires] = useState(packageItem?.expires_at ?? '')
  const [status, setStatus] = useState(packageItem?.status ?? 'ACTIVE')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [busy, onClose])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const totalValue = Number(total)
    const usedValue = Number(used)
    if (!serviceId || !Number.isInteger(totalValue) || totalValue <= 0 || !Number.isInteger(usedValue) || usedValue < 0 || usedValue > totalValue || !purchased || (starts && expires && expires < starts)) {
      setError('Controlla servizio, sessioni e date.')
      return
    }
    if (!services.some((service) => service.id === serviceId && service.is_active) && !packageItem) {
      setError('Seleziona un servizio attivo.')
      return
    }
    setBusy(true)
    setError(null)
    if (!coachId) {
      setError('Coach non disponibile. Riprova dopo aver effettuato nuovamente l’accesso.')
      setBusy(false)
      return
    }
    const payload = { service_id: serviceId, total_sessions: totalValue, used_sessions: usedValue, purchased_at: new Date(`${purchased}T00:00:00`).toISOString(), starts_at: starts || null, expires_at: expires || null, status }
    const result = packageItem ? await supabase.from('packages').update(payload).eq('id', packageItem.id).eq('client_id', clientId) : await supabase.from('packages').insert({ coach_id: coachId, client_id: clientId, ...payload })
    setBusy(false)
    if (result.error) { setError('Non è stato possibile salvare il pacchetto.'); return }
    onSaved()
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="modal-card exercise-modal" role="dialog" aria-modal="true" aria-labelledby="package-modal-title"><div className="modal-heading"><div><span className="eyebrow">{packageItem ? 'Modifica pacchetto' : 'Nuovo pacchetto'}</span><h2 id="package-modal-title">Gestisci le<br /><em>sessioni.</em></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20} /></button></div><form className="booking-form modal-form" onSubmit={(event) => void submit(event)}><label>Servizio<select required value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={servicesLoading}><option value="">Seleziona servizio</option>{services.filter((service) => service.is_active || service.id === packageItem?.service_id).map((service) => <option value={service.id} key={service.id}>{service.name}{!service.is_active ? ' (inattivo)' : ''}</option>)}</select></label><div className="exercise-form-grid"><label>Sessioni totali<input required type="number" min="1" step="1" value={total} onChange={(event) => setTotal(event.target.value)} /></label><label>Sessioni utilizzate<input required type="number" min="0" step="1" value={used} onChange={(event) => setUsed(event.target.value)} /></label><label>Data acquisto<input required type="date" value={purchased} onChange={(event) => setPurchased(event.target.value)} /></label><label>Stato<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ACTIVE">ACTIVE</option><option value="ARCHIVED">ARCHIVED</option></select></label><label>Inizio<input type="date" value={starts} onChange={(event) => setStarts(event.target.value)} /></label><label>Scadenza<input type="date" value={expires} onChange={(event) => setExpires(event.target.value)} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Annulla</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Salvataggio...' : 'Salva pacchetto'} <ArrowUpRight size={17} /></button></div></form></section></div>
}

export default App
