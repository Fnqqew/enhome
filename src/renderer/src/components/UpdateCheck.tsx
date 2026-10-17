import { useState } from 'react'
import type { UpdateInfo } from '@shared/updates'

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'done'; info: UpdateInfo }
  | { kind: 'installing'; info: UpdateInfo }
  | { kind: 'error'; message: string }

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err))

// Busca en GitHub si hay una versión nueva y, si se puede, la baja e instala.
export default function UpdateCheck(): React.JSX.Element {
  const [state, setState] = useState<State>({ kind: 'idle' })

  const check = (): void => {
    setState({ kind: 'checking' })
    window.api
      .checkUpdates()
      .then((info) => setState({ kind: 'done', info }))
      .catch((err: unknown) => setState({ kind: 'error', message: message(err) }))
  }

  const install = (info: UpdateInfo): void => {
    setState({ kind: 'installing', info })
    window.api.installUpdate().catch((err: unknown) => setState({ kind: 'error', message: message(err) }))
  }

  return (
    <section className="card stack fade-in">
      <h2>Actualizaciones</h2>
      {state.kind === 'done' && !state.info.newer && <p>Tenés la última versión ({state.info.current}).</p>}
      {state.kind === 'done' && state.info.newer && (
        <>
          <p>
            <span className="badge ok">nueva</span> Salió la versión <strong>{state.info.latest}</strong>; tenés la {state.info.current}.
          </p>
          {state.info.notes && <p className="muted small multiline update-notes">{state.info.notes}</p>}
          {!state.info.canInstall && (
            <p className="muted small">
              Para instalarla desde acá hace falta la CLI de GitHub con sesión iniciada; si no, bajá el instalador desde la página de la versión.
            </p>
          )}
        </>
      )}
      {state.kind === 'installing' && <p>Bajando la versión {state.info.latest}… La app se va a cerrar y abrir sola cuando termine.</p>}
      {state.kind === 'error' && <p className="error small">{state.message}</p>}
      {(state.kind === 'idle' || state.kind === 'checking') && (
        <p className="muted">Las versiones nuevas se publican en GitHub. Tu progreso se mantiene al actualizar.</p>
      )}
      <div className="row">
        {state.kind === 'done' && state.info.newer && state.info.canInstall ? (
          <button className="btn" onClick={() => install(state.info)}>
            Instalar y reiniciar
          </button>
        ) : (
          <button className="btn secondary" disabled={state.kind === 'checking' || state.kind === 'installing'} onClick={check}>
            {state.kind === 'checking' ? 'Buscando…' : 'Buscar actualizaciones'}
          </button>
        )}
        {state.kind === 'done' && state.info.newer && (
          <a className="btn secondary" href={state.info.url} target="_blank" rel="noreferrer">
            Ver en GitHub
          </a>
        )}
      </div>
    </section>
  )
}
