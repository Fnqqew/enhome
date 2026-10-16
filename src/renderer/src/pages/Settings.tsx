import { useCallback, useEffect, useState } from 'react'
import type { ClaudeStatus, SampleSentence } from '@shared/ipc'
import { LANGUAGES, languageInfo, type CourseSummary, type LanguageId } from '@shared/languages'
import { FONTS, PALETTES, STYLES, VOICE_SETTING, type AppSettings, type StylePreview } from '@shared/settings'
import { hasVoiceFor, pickVoice, speechTag, type SpeechLang } from '@shared/speech'
import Logo from '../components/Logo'
import { courseLine } from '../courseText'
import Segmented from '../components/Segmented'
import { INSTALL_VOICE_HELP } from '../components/summaries/SpeechControls'
import { useVoices } from '../hooks/useSpeech'
import { useSettings } from '../theme/SettingsProvider'

const FONT_FAMILIES: Record<string, string> = {
  estilo: 'var(--style-font)',
  moderna: 'var(--font-moderna)',
  clasica: 'var(--font-clasica)',
  amigable: 'var(--font-amigable)'
}

export default function Settings({ status }: { status: Extract<ClaudeStatus, { state: 'ready' }> }): React.JSX.Element {
  const { settings, update, dark: isDark } = useSettings()
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
                <StyleThumb preview={isDark ? s.preview.dark : s.preview.light} />
                <span className="style-head">
                  <Logo style={s.id} />
                  <span className="style-name">{s.label}</span>
                  {s.id === settings.style && <span className="badge ok">En uso</span>}
                </span>
                <span className="muted small">{s.description}</span>
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

      <CourseSettings />
      <VoiceSettings />
      <ClaudeConnection status={status} />
    </>
  )
}

// Miniatura de la app con los colores de un estilo: barra lateral, título, una tarjeta y un botón.
function StyleThumb({ preview }: { preview: StylePreview }): React.JSX.Element {
  return (
    <span className="style-thumb" style={{ background: preview.bg, borderColor: preview.border }} aria-hidden="true">
      <span className="thumb-side" style={{ background: preview.sidebar }}>
        <i style={{ background: preview.accent }} />
        <i />
        <i />
        <i />
      </span>
      <span className="thumb-main">
        <span className="thumb-title" style={{ background: preview.text }} />
        <span className="thumb-card" style={{ background: preview.surface, borderColor: preview.border }}>
          <span className="thumb-line" style={{ background: preview.text }} />
          <span className="thumb-line short" style={{ background: preview.text }} />
          <span className="thumb-btn" style={{ background: preview.accent }} />
        </span>
      </span>
    </span>
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

const VOICE_SAMPLES: Record<SpeechLang, string> = {
  es: 'Hola, así suena la voz en español.',
  en: 'Hello, this is how the English voice sounds.',
  pt: 'Olá, é assim que soa a voz em português.',
  it: 'Ciao, così suona la voce in italiano.',
  fr: 'Bonjour, voici la voix en français.'
}

const VOICE_LANGS: { lang: SpeechLang; label: string }[] = [
  { lang: 'es', label: 'Español' },
  ...LANGUAGES.map((l) => ({ lang: l.id, label: l.label }))
]

function VoiceSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const voices = useVoices()
  const missing = VOICE_LANGS.filter(({ lang }) => !hasVoiceFor(voices, lang))

  const test = (lang: SpeechLang): void => {
    const voice = pickVoice(voices, lang, settings[VOICE_SETTING[lang]])
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(VOICE_SAMPLES[lang])
    utterance.lang = voice?.lang ?? speechTag(lang)
    if (voice) utterance.voice = voice
    speechSynthesis.speak(utterance)
  }

  return (
    <section className="card stack">
      <h2>Lectura en voz alta</h2>
      <p className="muted">
        Al escuchar un resumen, las partes en español se leen con una voz y las del idioma que estudiás con otra, para que cada una tenga
        la pronunciación correcta.
      </p>
      {voices.length === 0 ? (
        <p className="warn-text">Windows no tiene voces instaladas. {INSTALL_VOICE_HELP}</p>
      ) : (
        <>
          {VOICE_LANGS.map(({ lang, label }) => {
            const automatic = pickVoice(voices, lang)
            const key = VOICE_SETTING[lang]
            return (
              <Row key={lang} label={`Voz en ${label.toLowerCase()}`}>
                <div className="row">
                  <select id={`voice-${lang}`} value={settings[key] ?? ''} onChange={(e) => update({ [key]: e.target.value || null })}>
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
              </Row>
            )
          })}
          {missing.length > 0 && (
            <p className="warn-text small">
              No hay voz instalada para {missing.map((m) => m.label.toLowerCase()).join(', ')}: esas partes se leen con otra pronunciación.{' '}
              {INSTALL_VOICE_HELP}
            </p>
          )}
        </>
      )}
    </section>
  )
}

// Los cursos: el que está activo se puede pausar o reanudar, y cualquiera se puede reiniciar.
function CourseSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const [courses, setCourses] = useState<CourseSummary[] | null>(null)
  const [paused, setPaused] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<LanguageId | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    window.api.getCourses().then(setCourses).catch((err: Error) => setError(err.message))
    window.api
      .getProgress()
      .then((p) => setPaused(p.pausedSince))
      .catch(() => undefined)
  }, [])

  useEffect(load, [load, settings.language])

  const run = (action: () => Promise<unknown>): void => {
    setBusy(true)
    setError(null)
    action()
      .then(load)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false))
  }

  const active = courses?.find((c) => c.language === settings.language)

  return (
    <section className="card stack">
      <h2>Cursos</h2>
      <p className="muted">
        Cada idioma es un curso aparte, con sus semanas, faltas, exámenes, racha y logros. El idioma se cambia desde la barra lateral.
      </p>
      {!courses ? (
        <p className="muted">Cargando…</p>
      ) : (
        <ul className="course-list">
          {courses.map((course) => {
            const info = languageInfo(course.language)
            const isActive = course.language === settings.language
            return (
              <li key={course.language} className={`course-row${isActive ? ' active' : ''}`}>
                <span className="lang-badge" style={{ background: info.color }}>
                  {info.code}
                </span>
                <div className="course-text">
                  <strong>{info.label}</strong>
                  <span className="muted small">{courseLine(course)}</span>
                </div>
                <div className="row">
                  {!isActive && course.available && (
                    <button type="button" className="chip" disabled={busy} onClick={() => update({ language: course.language })}>
                      Abrir
                    </button>
                  )}
                  {course.started &&
                    (confirming === course.language ? (
                      <>
                        <button
                          type="button"
                          className="chip danger"
                          disabled={busy}
                          onClick={() => {
                            setConfirming(null)
                            run(() => window.api.resetCourse(course.language))
                          }}
                        >
                          Sí, borrar
                        </button>
                        <button type="button" className="chip" onClick={() => setConfirming(null)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button type="button" className="chip" disabled={busy} onClick={() => setConfirming(course.language)}>
                        Reiniciar
                      </button>
                    ))}
                </div>
                {confirming === course.language && (
                  <p className="warn-text small course-warning">
                    Se borra el progreso de {info.name}: semanas, prácticas, exámenes, racha, experiencia y logros. Los resúmenes guardados y
                    los ajustes se mantienen.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {active?.started && (
        <div className="notice row spread">
          <span>
            {paused
              ? `El curso de ${languageInfo(settings.language).name} está en pausa desde el ${paused.split('-').reverse().slice(0, 2).join('/')}: no cuenta faltas ni corta la racha.`
              : `Si vas a dejar ${languageInfo(settings.language).name} por un tiempo, pausalo: así no junta faltas ni pierde la racha.`}
          </span>
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={() => run(() => (paused ? window.api.resumeCourse() : window.api.pauseCourse()))}
          >
            {paused ? 'Reanudar curso' : 'Pausar curso'}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
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
