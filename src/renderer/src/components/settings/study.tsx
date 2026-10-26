// Ajustes → Estudio: duración de la práctica, formatos, meta diaria y cursos.

import { useCallback, useEffect, useState } from 'react'
import { languageInfo, type CourseSummary, type LanguageId } from '@shared/languages'
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPES, type ExerciseType } from '@shared/exercises'
import { PRACTICE_LENGTHS, type AppSettings } from '@shared/settings'
import { courseLine } from '../../courseText'
import Segmented from '../Segmented'
import { useSettings } from '../../theme/SettingsProvider'
import { Row } from './common'

// Cuántos ejercicios tiene la práctica y qué formatos no aparecen nunca.
const MAX_EXCLUDED = EXERCISE_TYPES.length - 4

export function PracticeSettings(): React.JSX.Element {
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

// Meta diaria: minutos de estudio o actividades, y la variante del español de las explicaciones.
export function GoalSettings(): React.JSX.Element {
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

// Los cursos: el que está activo se puede pausar o reanudar, y cualquiera se puede reiniciar.
export function CourseSettings(): React.JSX.Element {
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
