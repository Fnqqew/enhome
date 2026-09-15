import { useCallback, useEffect, useState } from 'react'
import type { ClaudeStatus } from '@shared/ipc'
import type { Navigate, SectionId } from './navigation'
import Home from './pages/Home'
import Placeholder from './pages/Placeholder'
import Practice from './pages/Practice'
import Settings from './pages/Settings'

type ReadyStatus = Extract<ClaudeStatus, { state: 'ready' }>

const SECTIONS: { id: SectionId; label: string; phase?: number }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'practica', label: 'Práctica' },
  { id: 'resumenes', label: 'Resúmenes', phase: 5 },
  { id: 'pruebas', label: 'Pruebas', phase: 6 },
  { id: 'progreso', label: 'Progreso', phase: 7 },
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
      <main className="centered">
        <p className="muted">Verificando tu sesión de Claude…</p>
      </main>
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

  return (
    <main className="centered">
      <div className="card lock stack">
        <h1>Proyecto Inglés</h1>
        <p>{message}</p>
        <div>
          <button className="btn" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      </div>
    </main>
  )
}

function Shell({ status }: { status: ReadyStatus }): React.JSX.Element {
  const [section, setSection] = useState<SectionId>('inicio')

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">Proyecto Inglés</div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className="nav-item"
            aria-current={s.id === section ? 'page' : undefined}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
        <div className="sidebar-foot muted">Claude conectado</div>
      </nav>
      <main className="content">
        <Page section={section} status={status} navigate={setSection} />
      </main>
    </div>
  )
}

function Page({ section, status, navigate }: { section: SectionId; status: ReadyStatus; navigate: Navigate }): React.JSX.Element {
  if (section === 'inicio') return <Home navigate={navigate} />
  if (section === 'practica') return <Practice navigate={navigate} />
  if (section === 'ajustes') return <Settings status={status} />
  const current = SECTIONS.find((s) => s.id === section)!
  return <Placeholder title={current.label} phase={current.phase ?? 0} />
}
