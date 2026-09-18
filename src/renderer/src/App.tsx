import { useCallback, useEffect, useState } from 'react'
import type { ClaudeStatus } from '@shared/ipc'
import type { Navigate, SectionId } from './navigation'
import Logo from './components/Logo'
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

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'temario', label: 'Temario' },
  { id: 'practica', label: 'Práctica' },
  { id: 'resumenes', label: 'Resúmenes' },
  { id: 'pruebas', label: 'Pruebas' },
  { id: 'progreso', label: 'Progreso' },
  { id: 'ajustes', label: 'Ajustes' }
]

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState<ClaudeStatus | null>(null)

  const checkStatus = useCallback(() => {
    setStatus(null)
    window.api
      .getClaudeStatus()
      .then(setStatus)
      .catch((err: Error) => setStatus({ state: 'error', message: err.message }))
  }, [])

  useEffect(checkStatus, [checkStatus])

  if (!status) {
    return (
      <>
        <TitleBar title="Proyecto Inglés" />
        <main className="centered">
          <p className="muted">Verificando tu sesión de Claude…</p>
        </main>
      </>
    )
  }
  if (status.state !== 'ready') return <LockScreen status={status} onRetry={checkStatus} />
  return <Shell status={status} />
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
      <TitleBar title="Proyecto Inglés" />
      <main className="centered">
        <div className="card lock stack">
          <Logo style={settings.style} className="logo lock-logo" />
          <h1>Proyecto Inglés</h1>
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

  const title = SECTIONS.find((s) => s.id === section)?.label ?? 'Proyecto Inglés'

  return (
    <div className="shell">
      <TitleBar title={title} />
      <nav className="sidebar">
        <div className="brand">
          <Logo style={settings.style} />
          Proyecto Inglés
        </div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className="nav-item"
            aria-current={s.id === section ? 'page' : undefined}
            disabled={examLocked && s.id !== 'pruebas'}
            title={examLocked && s.id !== 'pruebas' ? 'Entregá el examen para salir de Pruebas' : undefined}
            onClick={() => navigate(s.id)}
          >
            {s.label}
          </button>
        ))}
        <div className="sidebar-foot muted">{examLocked ? 'Examen en curso' : 'Claude conectado'}</div>
      </nav>
      <RewardToasts trigger={section} />
      <main className="content">
        <Page section={section} status={status} navigate={navigate} onExamLock={setExamLocked} />
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
  return <Settings status={status} />
}
