import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { ClaudeStatus } from '@shared/ipc'
import { SECTIONS, type Navigate, type NavParams, type SectionId } from './navigation'
import Icon from './components/Icon'
import Logo from './components/Logo'
import LanguageSwitcher from './components/LanguageSwitcher'
import Splash from './components/Splash'
import TitleBar from './components/TitleBar'
import { useSettings } from './theme/SettingsProvider'
import Home from './pages/Home'
import RewardToasts from './components/RewardToasts'

// Inicio va en el paquete principal; el resto de las secciones se carga cuando se abre
// (y en segundo plano apenas la app queda tranquila, para que el primer clic sea instantáneo).
const PAGES = {
  temario: () => import('./pages/Curriculum'),
  practica: () => import('./pages/Practice'),
  repaso: () => import('./pages/Review'),
  juegos: () => import('./pages/Games'),
  resumenes: () => import('./pages/Summaries'),
  pruebas: () => import('./pages/Tests'),
  progreso: () => import('./pages/Progress'),
  ajustes: () => import('./pages/Settings'),
  comentarios: () => import('./pages/Comments'),
  acerca: () => import('./pages/About')
}
const Curriculum = lazy(PAGES.temario)
const Practice = lazy(PAGES.practica)
const Review = lazy(PAGES.repaso)
const Games = lazy(PAGES.juegos)
const Summaries = lazy(PAGES.resumenes)
const Tests = lazy(PAGES.pruebas)
const Progress = lazy(PAGES.progreso)
const Settings = lazy(PAGES.ajustes)
const Comments = lazy(PAGES.comentarios)
const About = lazy(PAGES.acerca)

function preloadPages(): void {
  const run = (): void => Object.values(PAGES).forEach((load) => void load().catch(() => undefined))
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2000)
}

type ReadyStatus = Extract<ClaudeStatus, { state: 'ready' }>

// Las secciones de abajo quedan separadas: no son parte del recorrido de estudio.
const EXTRA_SECTIONS: SectionId[] = ['ajustes', 'comentarios', 'acerca']

export default function App(): React.JSX.Element {
  const { settings } = useSettings()
  const [status, setStatus] = useState<ClaudeStatus | null>(null)
  // La pantalla de carga se muestra una sola vez, al abrir la app (si no está apagada en Ajustes).
  const [splashDone, setSplashDone] = useState(() => settings.splash === 'none')
  const finishSplash = useCallback(() => setSplashDone(true), [])

  const checkStatus = useCallback(() => {
    setStatus(null)
    window.api
      .getClaudeStatus()
      .then(setStatus)
      .catch((err: Error) => setStatus({ state: 'error', message: err.message }))
  }, [])

  useEffect(checkStatus, [checkStatus])

  let screen: React.JSX.Element
  if (!status) {
    screen = (
      <>
        <TitleBar title="Enhome" />
        <main className="centered">{splashDone && <p className="muted">Verificando tu sesión de Claude…</p>}</main>
      </>
    )
  } else if (status.state !== 'ready') {
    screen = <LockScreen status={status} onRetry={checkStatus} />
  } else {
    // Cambiar de idioma rearma todas las secciones con los datos del otro curso.
    screen = <Shell key={settings.language} status={status} />
  }

  return (
    <>
      {screen}
      {!splashDone && <Splash ready={status !== null} onDone={finishSplash} />}
    </>
  )
}

function LockScreen({ status, onRetry }: { status: Exclude<ClaudeStatus, ReadyStatus>; onRetry: () => void }): React.JSX.Element {
  const message = {
    'not-installed': 'No se encontró Claude Code en esta computadora. Instalalo desde claude.com/claude-code y volvé a intentar.',
    'logged-out': 'Claude Code está instalado pero no tiene sesión iniciada. Abrí una terminal, ejecutá "claude" e iniciá sesión con tu cuenta.',
    'no-subscription': 'Claude Code está usando otro método de acceso. Esta app requiere iniciar sesión con una suscripción de claude.ai (Pro o superior).',
    error: `No se pudo verificar la sesión de Claude: ${status.state === 'error' ? status.message : ''}`
  }[status.state]
  const { settings } = useSettings()

  return (
    <>
      <TitleBar title="Enhome" />
      <main className="centered">
        <div className="card lock stack">
          <Logo style={settings.style} className="logo lock-logo" />
          <h1>Enhome</h1>
          <p>{message}</p>
          <div>
            <button className="btn" onClick={onRetry}>
              Reintentar
            </button>
          </div>
        </div>
      </main>
    </>
  )
}

function Shell({ status }: { status: ReadyStatus }): React.JSX.Element {
  const { settings } = useSettings()
  const [section, setSection] = useState<SectionId>('inicio')
  const [params, setParams] = useState<NavParams>({})
  // Durante un examen semanal no se puede salir de Pruebas.
  const [examLocked, setExamLocked] = useState(false)

  useEffect(() => {
    window.api
      .getExamLock()
      .then((locked) => {
        if (!locked) return
        setExamLocked(true)
        setSection('pruebas')
      })
      .catch(() => undefined)
  }, [])

  useEffect(preloadPages, [])

  const navigate: Navigate = (target, extra = {}) => {
    if (examLocked && target !== 'pruebas') return
    setSection(target)
    setParams(extra)
  }

  const title = SECTIONS.find((s) => s.id === section)?.label ?? 'Enhome'

  return (
    <div className="shell">
      <TitleBar title={title} />
      <nav className="sidebar">
        <div className="brand">
          <Logo style={settings.style} />
          Enhome
        </div>
        <LanguageSwitcher locked={examLocked} />
        {SECTIONS.filter((s) => !EXTRA_SECTIONS.includes(s.id)).map((s) => (
          <NavItem key={s.id} section={s} current={section} examLocked={examLocked} onNavigate={navigate} />
        ))}
        <div className="nav-divider" />
        {SECTIONS.filter((s) => EXTRA_SECTIONS.includes(s.id)).map((s) => (
          <NavItem key={s.id} section={s} current={section} examLocked={examLocked} onNavigate={navigate} />
        ))}
        <div className="sidebar-foot">
          <span className={`status-dot${examLocked ? ' busy' : ''}`} aria-hidden="true" />
          {examLocked ? 'Examen en curso' : 'Claude conectado'}
        </div>
      </nav>
      <RewardToasts trigger={section} />
      <main className="content">
        <div key={section} className="page">
          <Suspense fallback={<p className="muted">Cargando…</p>}>
            <Page section={section} params={params} status={status} navigate={navigate} onExamLock={setExamLocked} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

function Page({
  section,
  params,
  status,
  navigate,
  onExamLock
}: {
  section: SectionId
  params: NavParams
  status: ReadyStatus
  navigate: Navigate
  onExamLock: (locked: boolean) => void
}): React.JSX.Element {
  if (section === 'inicio') return <Home navigate={navigate} />
  if (section === 'temario') return <Curriculum />
  if (section === 'practica') return <Practice navigate={navigate} />
  if (section === 'repaso') return <Review examId={params.examId ?? null} navigate={navigate} />
  if (section === 'juegos') return <Games />
  if (section === 'resumenes') return <Summaries />
  if (section === 'pruebas') return <Tests navigate={navigate} onLockChange={onExamLock} />
  if (section === 'progreso') return <Progress navigate={navigate} />
  if (section === 'comentarios') return <Comments />
  if (section === 'acerca') return <About status={status} navigate={navigate} />
  return <Settings status={status} />
}

function NavItem({
  section,
  current,
  examLocked,
  onNavigate
}: {
  section: (typeof SECTIONS)[number]
  current: SectionId
  examLocked: boolean
  onNavigate: Navigate
}): React.JSX.Element {
  const blocked = examLocked && section.id !== 'pruebas'
  return (
    <button
      className="nav-item"
      aria-current={section.id === current ? 'page' : undefined}
      disabled={blocked}
      title={blocked ? 'Entregá el examen para salir de Pruebas' : undefined}
      onClick={() => onNavigate(section.id)}
    >
      <Icon name={section.id} className="nav-icon" />
      {section.label}
    </button>
  )
}
