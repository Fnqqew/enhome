import { useCallback, useEffect, useState } from 'react'
import type { ClaudeStatus, SampleSentence } from '@shared/ipc'

const SECTIONS = [
  { id: 'inicio', label: 'Inicio', phase: 0 },
  { id: 'practica', label: 'Práctica', phase: 4 },
  { id: 'resumenes', label: 'Resúmenes', phase: 5 },
  { id: 'pruebas', label: 'Pruebas', phase: 6 },
  { id: 'progreso', label: 'Progreso', phase: 7 },
  { id: 'ajustes', label: 'Ajustes', phase: 8 }
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState<ClaudeStatus | null>(null)

  const checkStatus = useCallback(() => {
    setStatus(null)
    window.api.getClaudeStatus().then(setStatus)
  }, [])

  useEffect(checkStatus, [checkStatus])

  if (!status) return <Centered><p className="muted">Verificando tu sesión de Claude…</p></Centered>
  if (status.state !== 'ready') return <LockScreen status={status} onRetry={checkStatus} />
  return <Shell status={status} />
}

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <main className="centered">{children}</main>
}

function LockScreen({ status, onRetry }: { status: Exclude<ClaudeStatus, { state: 'ready' }>; onRetry: () => void }): React.JSX.Element {
  const message = {
    'not-installed': 'No se encontró Claude Code en esta computadora. Instalalo desde claude.com/claude-code y volvé a intentar.',
    'logged-out': 'Claude Code está instalado pero no tiene sesión iniciada. Abrí una terminal, ejecutá "claude" e iniciá sesión con tu cuenta.',
    'no-subscription': 'Claude Code está usando otro método de acceso. Esta app requiere iniciar sesión con una suscripción de claude.ai (Pro o superior).',
    error: `No se pudo verificar la sesión de Claude: ${status.state === 'error' ? status.message : ''}`
  }[status.state]

  return (
    <Centered>
      <div className="card lock">
        <h1>Proyecto Inglés</h1>
        <p>{message}</p>
        <button className="btn" onClick={onRetry}>Reintentar</button>
      </div>
    </Centered>
  )
}

function Shell({ status }: { status: Extract<ClaudeStatus, { state: 'ready' }> }): React.JSX.Element {
  const [section, setSection] = useState<SectionId>('inicio')
  const current = SECTIONS.find((s) => s.id === section)!

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">Proyecto Inglés</div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`nav-item${s.id === section ? ' active' : ''}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
        <div className="sidebar-foot muted">Claude {status.subscription ?? ''} conectado</div>
      </nav>
      <main className="content">
        <h1>{current.label}</h1>
        {section === 'inicio' ? <Home /> : <p className="muted">Esta sección se construye en la fase {current.phase}.</p>}
      </main>
    </div>
  )
}

function Home(): React.JSX.Element {
  const [sample, setSample] = useState<SampleSentence | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tryClaude = (): void => {
    setLoading(true)
    setError(null)
    window.api
      .sampleSentence()
      .then(setSample)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  return (
    <div className="card">
      <p>La base de la app está lista. Probá la conexión con Claude:</p>
      <button className="btn" onClick={tryClaude} disabled={loading}>
        {loading ? 'Pensando…' : 'Generar una oración A1'}
      </button>
      {sample && (
        <div className="sample">
          <p className="en">{sample.english}</p>
          <p className="muted">{sample.spanish}</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
