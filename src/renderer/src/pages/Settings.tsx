import { useState } from 'react'
import type { ClaudeStatus, SampleSentence } from '@shared/ipc'
import { FONTS, PALETTES, type AppSettings } from '@shared/settings'
import Segmented from '../components/Segmented'
import { useSettings } from '../theme/SettingsProvider'

const FONT_FAMILIES: Record<string, string> = {
  moderna: 'var(--font-moderna)',
  clasica: 'var(--font-clasica)',
  amigable: 'var(--font-amigable)'
}

export default function Settings({ status }: { status: Extract<ClaudeStatus, { state: 'ready' }> }): React.JSX.Element {
  const { settings, update } = useSettings()
  const isDark = document.documentElement.dataset.theme === 'dark'

  return (
    <>
      <h1>Ajustes</h1>

      <section className="card stack">
        <h2>Apariencia</h2>

        <Row label="Tema">
          <Segmented
            label="Tema"
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'system', label: 'Sistema' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Oscuro' }
            ]}
          />
        </Row>

        <Row label="Color">
          <div className="swatches" role="group" aria-label="Color">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                className="swatch"
                title={p.label}
                aria-label={p.label}
                aria-pressed={p.id === settings.palette}
                style={{ background: isDark ? p.dark : p.light }}
                onClick={() => update({ palette: p.id })}
              />
            ))}
          </div>
        </Row>

        <Row label="Tipografía">
          <Segmented
            label="Tipografía"
            value={settings.font}
            onChange={(font) => update({ font })}
            options={FONTS.map((f) => ({ value: f.id, label: f.label, style: { fontFamily: FONT_FAMILIES[f.id] } }))}
          />
        </Row>

        <Row label="Tamaño de letra">
          <Segmented<AppSettings['fontSize']>
            label="Tamaño de letra"
            value={settings.fontSize}
            onChange={(fontSize) => update({ fontSize })}
            options={[
              { value: 'sm', label: 'Chica' },
              { value: 'md', label: 'Mediana' },
              { value: 'lg', label: 'Grande' }
            ]}
          />
        </Row>

        <Row label="Espaciado">
          <Segmented<AppSettings['density']>
            label="Espaciado"
            value={settings.density}
            onChange={(density) => update({ density })}
            options={[
              { value: 'compact', label: 'Compacto' },
              { value: 'comfortable', label: 'Cómodo' }
            ]}
          />
        </Row>
      </section>

      <ClaudeConnection status={status} />
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="setting-row">
      <span>{label}</span>
      {children}
    </div>
  )
}

function ClaudeConnection({ status }: { status: Extract<ClaudeStatus, { state: 'ready' }> }): React.JSX.Element {
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
