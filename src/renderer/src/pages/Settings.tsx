import { useState } from 'react'
import type { ClaudeStatus, SampleSentence } from '@shared/ipc'
import { FONTS, PALETTES, STYLES, type AppSettings } from '@shared/settings'
import { hasVoiceFor, pickVoice, type SpeechLang } from '@shared/speech'
import Logo from '../components/Logo'
import Segmented from '../components/Segmented'
import { INSTALL_VOICE_HELP } from '../components/summaries/SpeechControls'
import { useVoices } from '../hooks/useSpeech'
import { useSettings } from '../theme/SettingsProvider'

const VOICE_SAMPLES: Record<SpeechLang, string> = {
  es: 'Hola, así suena la voz en español.',
  en: 'Hello, this is how the English voice sounds.'
}

const FONT_FAMILIES: Record<string, string> = {
  estilo: 'var(--style-font)',
  moderna: 'var(--font-moderna)',
  clasica: 'var(--font-clasica)',
  amigable: 'var(--font-amigable)'
}

export default function Settings({ status }: { status: Extract<ClaudeStatus, { state: 'ready' }> }): React.JSX.Element {
  const { settings, update } = useSettings()
  const isDark = document.documentElement.dataset.theme === 'dark'
  const styleColors = (STYLES.find((s) => s.id === settings.style) ?? STYLES[0]).colors

  return (
    <>
      <h1>Ajustes</h1>

      <section className="card stack">
        <h2>Apariencia</h2>

        <div className="stack-sm">
          <span>Estilo</span>
          <div className="style-grid" role="group" aria-label="Estilo">
            {STYLES.map((s) => (
              <button key={s.id} type="button" className="style-card" aria-pressed={s.id === settings.style} onClick={() => update({ style: s.id })}>
                <Logo style={s.id} />
                <span className="style-name">{s.label}</span>
                <span className="muted small">{s.description}</span>
                <span className="style-dots" aria-hidden="true">
                  {s.colors.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>

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
                style={{
                  background: p.id === 'estilo' ? `linear-gradient(135deg, ${styleColors[0]} 50%, ${styleColors[1]} 50%)` : isDark ? p.dark : p.light
                }}
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

        <Row label="Animaciones">
          <Segmented<'full' | 'reduce'>
            label="Animaciones"
            value={settings.reduceMotion ? 'reduce' : 'full'}
            onChange={(motion) => update({ reduceMotion: motion === 'reduce' })}
            options={[
              { value: 'full', label: 'Normales' },
              { value: 'reduce', label: 'Reducidas' }
            ]}
          />
        </Row>

        <div className="preview" aria-label="Vista previa">
          <span className="level">VISTA PREVIA</span>
          <p>
            <strong>She is my sister.</strong> <span className="muted">— Ella es mi hermana.</span>
          </p>
          <div className="row">
            <button type="button" className="btn">
              Practicar
            </button>
            <button type="button" className="btn secondary">
              Leer el resumen
            </button>
            <span className="badge ok">Aprobado</span>
          </div>
        </div>
      </section>

      <VoiceSettings />
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

function VoiceSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const voices = useVoices()

  const test = (lang: SpeechLang): void => {
    const voice = pickVoice(voices, lang, lang === 'es' ? settings.voiceEs : settings.voiceEn)
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(VOICE_SAMPLES[lang])
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }
    speechSynthesis.speak(utterance)
  }

  const selector = (lang: SpeechLang, value: string | null, onChange: (name: string | null) => void): React.JSX.Element => {
    const automatic = pickVoice(voices, lang)
    return (
      <div className="row">
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Automática{automatic ? ` (${automatic.name})` : ' (no hay)'}</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} · {v.lang}
            </option>
          ))}
        </select>
        <button type="button" className="chip" onClick={() => test(lang)}>
          Probar
        </button>
      </div>
    )
  }

  return (
    <section className="card stack">
      <h2>Lectura en voz alta</h2>
      <p className="muted">
        Al escuchar un resumen, las partes en español se leen con una voz y las partes en inglés con otra, para que cada una tenga la
        pronunciación correcta.
      </p>
      {voices.length === 0 ? (
        <p className="warn-text">Windows no tiene voces instaladas. {INSTALL_VOICE_HELP}</p>
      ) : (
        <>
          <Row label="Voz en español">{selector('es', settings.voiceEs, (name) => update({ voiceEs: name }))}</Row>
          <Row label="Voz en inglés">{selector('en', settings.voiceEn, (name) => update({ voiceEn: name }))}</Row>
          {!hasVoiceFor(voices, 'es') && (
            <p className="warn-text small">
              No hay ninguna voz en español instalada, así que el español se lee con pronunciación inglesa. {INSTALL_VOICE_HELP} Conviene
              «Español (México)».
            </p>
          )}
          {!hasVoiceFor(voices, 'en') && <p className="warn-text small">No hay ninguna voz en inglés instalada. {INSTALL_VOICE_HELP}</p>}
        </>
      )}
    </section>
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
