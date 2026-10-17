import { useCallback, useEffect, useState } from 'react'
import type { BackupInfo } from '@shared/data'
import { formatDayMonth } from '@shared/dates'
import { readLocal, writeLocal } from '../shell'
import type { ClaudeStatus, SampleSentence } from '@shared/ipc'
import { LANGUAGES, languageInfo, type CourseSummary, type LanguageId } from '@shared/languages'
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPES, type ExerciseType } from '@shared/exercises'
import {
  contrast,
  contrastText,
  CUSTOM_RADII,
  FONTS,
  isDarkColor,
  PALETTES,
  PRACTICE_LENGTHS,
  STYLES,
  VOICE_SETTING,
  type AppSettings,
  type CustomRadius,
  type CustomStyle,
  type StylePreview
} from '@shared/settings'
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

const TABS = [
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'estudio', label: 'Estudio' },
  { id: 'voz', label: 'Voz' },
  { id: 'avisos', label: 'Notificaciones' },
  { id: 'datos', label: 'Datos' },
  { id: 'claude', label: 'Claude' },
  { id: 'avanzado', label: 'Avanzado' }
] as const

type TabId = (typeof TABS)[number]['id']

// Ajustes por pestañas; la última que se abrió se recuerda.
export default function Settings({ status }: { status: Extract<ClaudeStatus, { state: 'ready' }> }): React.JSX.Element {
  const [tab, setTab] = useState<TabId>(() => {
    const saved = readLocal('settings-tab')
    return TABS.some((t) => t.id === saved) ? (saved as TabId) : 'apariencia'
  })
  useEffect(() => writeLocal('settings-tab', tab), [tab])

  return (
    <>
      <h1>Ajustes</h1>
      <div className="tabs" role="tablist" aria-label="Ajustes">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" key={tab} className="tab-panel">
        {tab === 'apariencia' && <AppearanceSettings />}
        {tab === 'estudio' && (
          <>
            <PracticeSettings />
            <GoalSettings />
            <CourseSettings />
          </>
        )}
        {tab === 'voz' && (
          <>
            <VoiceSettings />
            <SpeechModelSettings />
          </>
        )}
        {tab === 'avisos' && <NotificationSettings />}
        {tab === 'datos' && <DataSettings />}
        {tab === 'claude' && (
          <>
            <ClaudeConnection status={status} />
            <ClaudeModeSettings />
          </>
        )}
        {tab === 'avanzado' && <AdvancedSettings />}
      </div>
    </>
  )
}

function AppearanceSettings(): React.JSX.Element {
  const { settings, update, dark: isDark } = useSettings()
  const styleColors = (STYLES.find((s) => s.id === settings.style) ?? STYLES[0]).colors

  return (
    <>
      <section className="card stack">
        <h2>Apariencia</h2>

        <div className="stack-sm">
          <span>Estilo</span>
          <div className="style-grid" role="group" aria-label="Estilo">
            {STYLES.map((s) => (
              <button key={s.id} type="button" className="style-card" aria-pressed={s.id === settings.style} onClick={() => update({ style: s.id })}>
                <StyleThumb preview={s.id === 'personal' ? customPreview(settings.customStyle) : isDark ? s.preview.dark : s.preview.light} />
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
        {settings.style === 'personal' && <CustomStyleEditor />}

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

        <Row label="Sonidos">
          <Segmented<'on' | 'off'>
            label="Sonidos"
            value={settings.sounds ? 'on' : 'off'}
            onChange={(v) => update({ sounds: v === 'on' })}
            options={[
              { value: 'off', label: 'Apagados' },
              { value: 'on', label: 'Prendidos' }
            ]}
          />
        </Row>

        <Row label="Pantalla de carga">
          <Segmented<AppSettings['splash']>
            label="Pantalla de carga"
            value={settings.splash}
            onChange={(splash) => update({ splash })}
            options={[
              { value: 'full', label: 'Completa' },
              { value: 'short', label: 'Breve' },
              { value: 'none', label: 'Ninguna' }
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
    </>
  )
}

// Meta diaria: minutos de estudio o actividades, y la variante del español de las explicaciones.
function GoalSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const goal = settings.dailyGoal
  const amounts = goal.kind === 'minutes' ? [5, 10, 15, 20, 30, 45, 60] : [1, 2, 3, 4, 5]
  return (
    <section className="card stack">
      <h2>Meta diaria</h2>
      <Row label="Medir por">
        <Segmented<AppSettings['dailyGoal']['kind']>
          label="Meta diaria"
          value={goal.kind}
          onChange={(kind) => update({ dailyGoal: { kind, amount: kind === 'minutes' ? 15 : 2 } })}
          options={[
            { value: 'minutes', label: 'Minutos' },
            { value: 'activities', label: 'Actividades' },
            { value: 'off', label: 'Sin meta' }
          ]}
        />
      </Row>
      {goal.kind !== 'off' && (
        <Row label="Cuánto">
          <select
            value={goal.amount}
            aria-label="Cantidad de la meta"
            onChange={(e) => update({ dailyGoal: { ...goal, amount: Number(e.target.value) } })}
          >
            {amounts.map((n) => (
              <option key={n} value={n}>
                {n} {goal.kind === 'minutes' ? 'minutos' : n === 1 ? 'actividad' : 'actividades'}
              </option>
            ))}
          </select>
        </Row>
      )}
      <p className="muted small">
        {goal.kind === 'minutes'
          ? 'Cuenta el tiempo con la ventana activa en las secciones de estudio (si dejás de usarla un par de minutos, se pausa).'
          : 'Cuenta la práctica, las partidas, las lecturas, el diario corregido y las charlas del día.'}{' '}
        Se ve en el Inicio, y si se acerca la medianoche sin cumplirla te avisa.
      </p>
      <h2>Explicaciones de Claude</h2>
      <Row label="Español">
        <Segmented<AppSettings['spanishVariant']>
          label="Variante del español"
          value={settings.spanishVariant}
          onChange={(spanishVariant) => update({ spanishVariant })}
          options={[
            { value: 'rioplatense', label: 'Rioplatense (vos)' },
            { value: 'neutro', label: 'Neutro (tú)' }
          ]}
        />
      </Row>
      <p className="muted small">
        Cambia cómo te habla Claude en las correcciones, los resúmenes y las respuestas nuevas. El temario base sigue en rioplatense.
      </p>
    </section>
  )
}

// Recordatorio diario, bandeja del sistema y arranque con Windows.
function NotificationSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  return (
    <section className="card stack">
      <h2>Notificaciones</h2>
      <Row label="Recordatorio diario">
        <Segmented<'on' | 'off'>
          label="Recordatorio diario"
          value={settings.reminderEnabled ? 'on' : 'off'}
          onChange={(v) => update({ reminderEnabled: v === 'on' })}
          options={[
            { value: 'off', label: 'Apagado' },
            { value: 'on', label: 'Prendido' }
          ]}
        />
      </Row>
      {settings.reminderEnabled && (
        <Row label="A las">
          <input
            type="time"
            className="time-input"
            value={settings.reminderTime}
            onChange={(e) => e.target.value && update({ reminderTime: e.target.value })}
          />
        </Row>
      )}
      <p className="muted small">
        Una notificación de Windows a esa hora si todavía no hiciste la práctica del día o no llegaste a tu meta, y otra a las 23 si la meta sigue
        pendiente. Para que lleguen, la app tiene que estar abierta (o en la bandeja).
      </p>
      <Row label="Al cerrar la ventana">
        <Segmented<'tray' | 'quit'>
          label="Al cerrar la ventana"
          value={settings.tray ? 'tray' : 'quit'}
          onChange={(v) => update({ tray: v === 'tray' })}
          options={[
            { value: 'quit', label: 'Cerrar la app' },
            { value: 'tray', label: 'Quedar en la bandeja' }
          ]}
        />
      </Row>
      <Row label="Arrancar con Windows">
        <Segmented<'on' | 'off'>
          label="Arrancar con Windows"
          value={settings.startWithWindows ? 'on' : 'off'}
          onChange={(v) => update({ startWithWindows: v === 'on' })}
          options={[
            { value: 'off', label: 'No' },
            { value: 'on', label: 'Sí' }
          ]}
        />
      </Row>
      <p className="muted small">Al arrancar con Windows la app abre escondida en la bandeja (si está activa), lista para el recordatorio.</p>
    </section>
  )
}

// Velocidad o precisión de Claude.
function ClaudeModeSettings(): React.JSX.Element {
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

// Copias de seguridad, exportar e importar, y borrar todo con la explicación de qué se pierde.
function DataSettings(): React.JSX.Element {
  const [backups, setBackups] = useState<BackupInfo[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'delete' | `restore:${string}` | null>(null)

  const load = useCallback(() => {
    window.api
      .getBackups()
      .then(setBackups)
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  const act = (action: () => Promise<unknown>, done?: string): void => {
    setError(null)
    setMessage(null)
    action()
      .then((result) => {
        if (done) setMessage(typeof result === 'string' ? `${done} ${result}` : done)
        load()
      })
      .catch((err: Error) => setError(err.message))
  }

  return (
    <>
      <section className="card stack">
        <h2>Copias de seguridad</h2>
        <p className="muted small">
          Todos los días, al abrir la app, se guarda una copia de cada curso. Quedan las últimas siete. Restaurar una vuelve todo (progreso, ajustes,
          vocabulario, diario) a ese día y reinicia la app.
        </p>
        {backups && backups.length === 0 && (
          <p className="muted small">Todavía no hay copias: la primera se hace unos segundos después de abrir la app.</p>
        )}
        {backups && backups.length > 0 && (
          <ul className="backup-list">
            {backups.map((b) => (
              <li key={b.date} className="row spread">
                <span>
                  <strong>{formatDayMonth(b.date)}</strong>{' '}
                  <span className="muted small">
                    · {b.courses} {b.courses === 1 ? 'curso' : 'cursos'} ·{' '}
                    {(b.size / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB
                  </span>
                </span>
                {confirm === `restore:${b.date}` ? (
                  <span className="row">
                    <button className="btn" onClick={() => act(() => window.api.restoreBackup(b.date))}>
                      Sí, restaurar
                    </button>
                    <button className="btn secondary" onClick={() => setConfirm(null)}>
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button className="btn secondary" onClick={() => setConfirm(`restore:${b.date}`)}>
                    Restaurar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div>
          <button className="btn secondary" onClick={() => act(() => window.api.backupNow(), 'Copia guardada.')}>
            Hacer una copia ahora
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>Pasar el progreso a otra computadora</h2>
        <p className="muted small">
          Exportar guarda todo en un solo archivo .enhome. En la otra computadora, «Importar» lo trae (antes guarda una copia de lo que había) y
          reinicia la app.
        </p>
        <div className="row">
          <button className="btn" onClick={() => act(() => window.api.exportData(), 'Exportado en')}>
            Exportar
          </button>
          <button className="btn secondary" onClick={() => act(() => window.api.importData())}>
            Importar…
          </button>
        </div>
      </section>

      <section className="card stack danger-zone">
        <h2>Borrar todo</h2>
        <div className="delete-explain">
          <div>
            <strong>Se borra</strong>
            <ul>
              <li>El progreso de los cuatro cursos: semanas, prácticas, exámenes, racha, experiencia y logros.</li>
              <li>Repaso, vocabulario, lecturas, diario, charlas, resaltados y partidas.</li>
              <li>Tus ajustes y tus comentarios.</li>
            </ul>
          </div>
          <div>
            <strong>Queda</strong>
            <ul>
              <li>Las copias de seguridad (antes de borrar se guarda una más, por si te arrepentís).</li>
              <li>El modelo de reconocimiento de voz descargado.</li>
              <li>El temario, que viene con la app.</li>
            </ul>
          </div>
        </div>
        <p className="muted small">Para empezar de cero un solo idioma, usá «Reiniciar» en Estudio → Cursos.</p>
        {confirm === 'delete' ? (
          <div className="row">
            <button className="btn danger" onClick={() => act(() => window.api.deleteAllData())}>
              Sí, borrar todo y reiniciar
            </button>
            <button className="btn secondary" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
          </div>
        ) : (
          <div>
            <button className="btn secondary" onClick={() => setConfirm('delete')}>
              Borrar todo…
            </button>
          </div>
        )}
      </section>
      {message && <p className="muted small">{message}</p>}
      {error && <p className="error">{error}</p>}
    </>
  )
}

// Avanzado: registro de errores, carpeta de datos y volver a ver la bienvenida.
function AdvancedSettings(): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const open = (action: () => Promise<void>): void => {
    setMessage(null)
    action().catch((err: Error) => setMessage(err.message))
  }
  return (
    <section className="card stack">
      <h2>Avanzado</h2>
      <div className="row">
        <button className="btn secondary" onClick={() => open(window.api.openLogFile)}>
          Abrir registro de errores
        </button>
        <button className="btn secondary" onClick={() => open(window.api.openDataFolder)}>
          Abrir carpeta de datos
        </button>
        <button
          className="btn secondary"
          onClick={() => {
            for (const id of ['en', 'pt', 'it', 'fr']) writeLocal(`tour:${id}`, '')
            writeLocal('version', '')
            setMessage('Listo: la bienvenida y las novedades vuelven a aparecer la próxima vez que abras la app.')
          }}
        >
          Volver a ver la bienvenida
        </button>
      </div>
      {message && <p className="muted small">{message}</p>}
      <p className="muted small">Los tiempos de cada tarea de Claude y los datos técnicos están en Acerca de.</p>
    </section>
  )
}

// Cuántos ejercicios tiene la práctica y qué formatos no aparecen nunca.
const MAX_EXCLUDED = EXERCISE_TYPES.length - 4

function PracticeSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const excluded = settings.excludedTypes
  const toggle = (type: ExerciseType): void => {
    update({ excludedTypes: excluded.includes(type) ? excluded.filter((t) => t !== type) : [...excluded, type] })
  }

  return (
    <section className="card stack">
      <h2>Práctica</h2>
      <Row label="Duración">
        <Segmented<AppSettings['practiceLength']>
          label="Duración de la práctica"
          value={settings.practiceLength}
          onChange={(practiceLength) => update({ practiceLength })}
          options={(Object.keys(PRACTICE_LENGTHS) as AppSettings['practiceLength'][]).map((id) => ({
            value: id,
            label: `${PRACTICE_LENGTHS[id].label} · ${PRACTICE_LENGTHS[id].size}`
          }))}
        />
      </Row>
      <p className="muted small">Cambia desde la próxima práctica: la que ya empezaste sigue igual.</p>
      <div className="stack-sm">
        <span>Formatos</span>
        <div className="chip-grid" role="group" aria-label="Formatos de ejercicio">
          {EXERCISE_TYPES.map((type) => {
            const on = !excluded.includes(type)
            return (
              <button
                key={type}
                type="button"
                className="chip"
                aria-pressed={on}
                disabled={on && excluded.length >= MAX_EXCLUDED}
                onClick={() => toggle(type)}
              >
                {EXERCISE_TYPE_LABELS[type]}
              </button>
            )
          })}
        </div>
        <p className="muted small">
          Tocá un formato para sacarlo de tus prácticas (hasta {MAX_EXCLUDED}). Si sacás la conversación o la escritura, la práctica se completa con
          los otros formatos.
        </p>
      </div>
    </section>
  )
}

// Miniatura de la app con los colores de un estilo: barra lateral, título, una tarjeta y un botón.
// Miniatura del estilo propio con sus colores (los mismos tonos que calcula styles.css).
function customPreview(custom: CustomStyle): StylePreview {
  const dark = isDarkColor(custom.bg)
  const mix = (amount: number, other: string): string => `color-mix(in srgb, ${custom.bg} ${amount}%, ${other})`
  return {
    bg: custom.bg,
    sidebar: dark ? mix(88, '#ffffff') : mix(35, '#ffffff'),
    surface: dark ? mix(88, '#ffffff') : mix(35, '#ffffff'),
    accent: custom.accent,
    text: dark ? '#ececf0' : '#1d1d1f',
    border: dark ? mix(70, '#ffffff') : mix(80, '#000000')
  }
}

// Editor del estilo propio: fondo, acento y bordes, con la app entera como vista previa.
function CustomStyleEditor(): React.JSX.Element {
  const { settings, update } = useSettings()
  const custom = settings.customStyle
  const set = (patch: Partial<CustomStyle>): void => update({ customStyle: { ...custom, ...patch } })
  const dark = isDarkColor(custom.bg)
  const accentContrast = contrast(custom.accent, custom.bg)

  return (
    <div className="custom-style stack-sm">
      <div className="row custom-colors">
        <label className="color-field">
          <input type="color" value={custom.bg} onChange={(e) => set({ bg: e.target.value })} />
          <span>Fondo</span>
        </label>
        <label className="color-field">
          <input type="color" value={custom.accent} onChange={(e) => set({ accent: e.target.value })} />
          <span>Acento</span>
        </label>
        <Segmented<CustomRadius>
          label="Bordes"
          value={custom.radius}
          onChange={(radius) => set({ radius })}
          options={(Object.keys(CUSTOM_RADII) as CustomRadius[]).map((r) => ({
            value: r,
            label: r === 'square' ? 'Rectos' : r === 'soft' ? 'Suaves' : 'Redondeados'
          }))}
        />
      </div>
      <div
        className="custom-sample"
        style={{ background: custom.bg, color: dark ? '#ececf0' : '#1d1d1f', borderRadius: CUSTOM_RADII[custom.radius] }}
      >
        <span>Así se ve el texto</span>
        <span
          className="custom-sample-btn"
          style={{ background: custom.accent, color: contrastText(custom.accent), borderRadius: CUSTOM_RADII[custom.radius] }}
        >
          Botón
        </span>
      </div>
      <p className="muted small">
        Con un fondo {dark ? 'oscuro' : 'claro'} la app usa letras {dark ? 'claras' : 'oscuras'}. La tipografía se elige más abajo.
        {accentContrast < 3 && ' Ojo: el acento se distingue poco del fondo; probá uno más oscuro o más claro.'}
      </p>
    </div>
  )
}

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

// El reconocimiento de voz de Pronunciación: cuánto ocupa el modelo descargado y la opción de borrarlo.
function SpeechModelSettings(): React.JSX.Element | null {
  const [size, setSize] = useState<number | null>(null)
  useEffect(() => {
    window.api
      .getModelsSize()
      .then(setSize)
      .catch(() => setSize(0))
  }, [])
  if (!size) return null
  return (
    <section className="card stack">
      <h2>Reconocimiento de voz</h2>
      <Row label={`Modelo descargado · ${Math.round(size / 1_000_000)} MB`}>
        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            window.api
              .removeModels()
              .then(() => setSize(0))
              .catch(() => undefined)
          }
        >
          Borrar
        </button>
      </Row>
      <p className="muted small">Lo usa el juego Pronunciación. Si lo borrás, se vuelve a bajar la próxima vez que juegues.</p>
    </section>
  )
}

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
        Al escuchar un resumen, las partes en español se leen con una voz y las del idioma que estudiás con otra, para que cada una tenga la
        pronunciación correcta.
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
    window.api
      .getCourses()
      .then(setCourses)
      .catch((err: Error) => setError(err.message))
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
      <Row label="Tu nombre">
        <input
          className="text-answer name-input"
          value={settings.studentName}
          maxLength={60}
          placeholder="Para los certificados (opcional)"
          onChange={(e) => update({ studentName: e.target.value })}
        />
      </Row>
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
                    Se borra el progreso de {info.name}: semanas, prácticas, exámenes, racha, experiencia y logros. Los resúmenes guardados y los
                    ajustes se mantienen.
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
