// Ajustes → Claude: la conexión y cómo trabaja.

import { useState } from 'react'
import { type ClaudeStatus, type SampleSentence } from '@shared/ipc'
import { type AppSettings } from '@shared/settings'
import Segmented from '../Segmented'
import { useSettings } from '../../theme/SettingsProvider'
import { Row } from './common'

export function ClaudeConnection({ status }: { status: Extract<ClaudeStatus, { state: 'ready' }> }): React.JSX.Element {
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
    <section className="card stack">
      <h2>Conexión con Claude</h2>
      <p className="muted">
        Conectado{status.email ? ` como ${status.email}` : ''}
        {status.subscription ? ` · plan ${status.subscription}` : ''}
      </p>
      <div>
        <button className="btn" onClick={tryClaude} disabled={loading}>
          {loading ? 'Pensando…' : 'Probar conexión'}
        </button>
      </div>
      {sample && (
        <div className="sample">
          <p className="en">{sample.english}</p>
          <p className="muted">{sample.spanish}</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

// Velocidad o precisión de Claude.
export function ClaudeModeSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const notes: Record<AppSettings['claudeMode'], string> = {
    rapido:
      'Claude piensa menos antes de responder: las correcciones y los ejercicios llegan alrededor de un 30 % antes, con algo menos de cuidado en los detalles.',
    equilibrado: 'Lo de siempre: cada tarea usa el esfuerzo que mejor le queda.',
    preciso: 'Claude piensa más antes de responder: tarda alrededor de un 50 % más, pero revisa con más cuidado ejercicios, correcciones y exámenes.'
  }
  return (
    <section className="card stack">
      <h2>Velocidad o precisión</h2>
      <Row label="Claude">
        <Segmented<AppSettings['claudeMode']>
          label="Velocidad o precisión"
          value={settings.claudeMode}
          onChange={(claudeMode) => update({ claudeMode })}
          options={[
            { value: 'rapido', label: 'Rápido' },
            { value: 'equilibrado', label: 'Equilibrado' },
            { value: 'preciso', label: 'Preciso' }
          ]}
        />
      </Row>
      <p className="muted small">{notes[settings.claudeMode]} En Acerca de ves cuánto tarda cada tarea.</p>
    </section>
  )
}
