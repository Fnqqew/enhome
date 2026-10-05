import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/progress'
import type { ClaudeStatus } from '@shared/ipc'
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPES } from '@shared/exercises'
import { SUMMARY_TYPE_IDS } from '@shared/summaries'
import { STYLES } from '@shared/settings'
import Logo from '../components/Logo'
import { useSettings } from '../theme/SettingsProvider'
import type { Navigate } from '../navigation'

// Qué es Enhome, cómo funciona por dentro y de qué está hecha.
export default function About({ status, navigate }: { status: Extract<ClaudeStatus, { state: 'ready' }>; navigate: Navigate }): React.JSX.Element {
  const { settings } = useSettings()
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.api
      .getAppInfo()
      .then(setInfo)
      .catch(() => undefined)
  }, [])

  return (
    <>
      <h1>Acerca de</h1>

      <section className="card stack about-hero fade-in">
        <Logo style={settings.style} className="logo about-logo" />
        <div className="stack-sm">
          <h2>Enhome</h2>
          <p className="muted">Aprender inglés en casa, de a un tópico por semana, con Claude de profesor particular.</p>
          {info && <span className="badge ok">versión {info.version}</span>}
        </div>
      </section>

      <section className="card stack fade-in">
        <h2>Cómo funciona</h2>
        <ul className="feature-list">
          <li>
            <strong>Una semana, un tópico.</strong> De lunes a viernes trabajás un subtema por día; el examen se abre el viernes. Si faltás,
            el día queda pendiente y el domingo podés recuperar una falta.
          </li>
          <li>
            <strong>La práctica es larga y realista.</strong> Cada día son {EXERCISE_TYPES.length} formatos posibles, con conversaciones,
            situaciones para resolver y tandas de traducción que solo salen bien si estudiaste el tema.
          </li>
          <li>
            <strong>Todo lo revisa Claude dos veces.</strong> Un docente genera el material, un revisor lo corrige y la app aplica sus
            propios controles antes de mostrarte nada.
          </li>
          <li>
            <strong>{SUMMARY_TYPE_IDS.length} tipos de resumen</strong> del mismo tema, para que lo leas como más te entre: explicación
            completa, tabla, mini historia, tarjetas y más.
          </li>
          <li>
            <strong>La constancia se premia.</strong> Racha, experiencia, logros y comodines que te salvan un día o te dan una segunda
            oportunidad en un examen.
          </li>
        </ul>
      </section>

      <section className="card stack fade-in">
        <h2>Lo que practicás cada día</h2>
        <div className="chip-grid">
          {EXERCISE_TYPES.map((type) => (
            <span key={type} className="badge">
              {EXERCISE_TYPE_LABELS[type]}
            </span>
          ))}
        </div>
        <p className="muted small">
          Los ejercicios cambian según el día: la gramática, la lectura y la escritura se reparten en la semana, y siempre entra una
          conversación o una situación para resolver.
        </p>
        <div className="row">
          <button className="btn secondary" onClick={() => navigate('practica')}>
            Ir a la práctica
          </button>
        </div>
      </section>

      <section className="card stack fade-in">
        <h2>Tu sesión de Claude</h2>
        <p className="muted">
          Conectado{status.email ? ` como ${status.email}` : ''}
          {status.subscription ? ` · plan ${status.subscription}` : ''}. La app usa Claude Code instalado en esta computadora con tu
          suscripción: no hay servidores propios ni API paga, y nada de lo que escribís sale de acá salvo lo que se le consulta a Claude.
        </p>
      </section>

      <section className="card stack fade-in">
        <h2>Datos técnicos</h2>
        <dl className="spec-list">
          <Spec label="Versión" value={info?.version} />
          <Spec label="Estilos visuales" value={`${STYLES.length} (${STYLES.map((s) => s.label).join(', ')})`} />
          <Spec label="Electron" value={info?.electron} />
          <Spec label="Chromium" value={info?.chrome} />
          <Spec label="Node" value={info?.node} />
          <Spec label="Tus datos" value={info?.dataDir} />
        </dl>
        {info && (
          <p className="muted small">
            El progreso se guarda en una base SQLite dentro de esa carpeta. Código y documentación:{' '}
            <a href={info.repoUrl} target="_blank" rel="noreferrer">
              {info.repoUrl.replace('https://', '')}
            </a>
            .
          </p>
        )}
        <div className="row">
          <button className="btn secondary" onClick={() => navigate('comentarios')}>
            Dejar un comentario
          </button>
        </div>
      </section>
    </>
  )
}

function Spec({ label, value }: { label: string; value?: string }): React.JSX.Element {
  return (
    <div className="spec">
      <dt>{label}</dt>
      <dd className="mono">{value ?? '—'}</dd>
    </div>
  )
}
