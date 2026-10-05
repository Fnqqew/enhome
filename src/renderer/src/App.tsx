import { useCallback, useEffect, useState } from 'react'
import type { ClaudeStatus } from '@shared/ipc'
import { SECTIONS, type Navigate, type SectionId } from './navigation'
import Icon from './components/Icon'
import About from './pages/About'
import Comments from './pages/Comments'
import Logo from './components/Logo'
import Splash from './components/Splash'
import TitleBar from './components/TitleBar'
import { useSettings } from './theme/SettingsProvider'
import Curriculum from './pages/Curriculum'
import Home from './pages/Home'
import RewardToasts from './components/RewardToasts'
import Progress from './pages/Progress'
import Practice from './pages/Practice'
import Settings from './pages/Settings'
import Summaries from './pages/Summaries'
import Tests from './pages/Tests'

type ReadyStatus = Extract<ClaudeStatus, { state: 'ready' }>

// Las secciones de abajo quedan separadas: no son parte del recorrido de estudio.
const EXTRA_SECTIONS: SectionId[] = ['ajustes', 'comentarios', 'acerca']

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState<ClaudeStatus | null>(null)
  // La pantalla de carga se muestra una sola vez, al abrir la app.
  const [splashDone, setSplashDone] = useState(false)
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
    screen = <Shell status={status} />
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

  const navigate: Navigate = (target) => {
    if (!examLocked || target === 'pruebas') setSection(target)
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
          <Page section={section} status={status} navigate={navigate} onExamLock={setExamLocked} />
        </div>
      </main>
    </div>
  )
}

function Page({
  section,
  status,
  navigate,
  onExamLock
}: {
  section: SectionId
  status: ReadyStatus
  navigate: Navigate
  onExamLock: (locked: boolean) => void
}): React.JSX.Element {
  if (section === 'inicio') return <Home navigate={navigate} />
  if (section === 'temario') return <Curriculum />
  if (section === 'practica') return <Practice navigate={navigate} />
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
