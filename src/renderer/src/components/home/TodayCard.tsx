import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { daysBetween, weekdayName } from '@shared/dates'
import type { ProgressState } from '@shared/progress'
import type { ProgressView } from '@shared/rewards'
import { useCourse } from '../../hooks/useCourse'
import type { Navigate } from '../../navigation'
import Icon from '../Icon'
import { goalUnit, type GoalView } from '@shared/goal'
import { useMinutesToMidnight } from '../../hooks/useDay'

interface Extras {
  goal: GoalView | null
  player: ProgressView['player'] | null
  mistakesDue: number
  cardsDue: number
  journalDone: boolean
}

interface Action {
  label: string
  detail: string
  go: () => void
}

// «¿Qué hago hoy?»: una sola acción principal según lo que toca, con la racha, el nivel y la cuenta
// regresiva al examen arriba de todo, y atajos a lo demás.
export default function TodayCard({ progress, navigate }: { progress: ProgressState; navigate: Navigate }): React.JSX.Element {
  const course = useCourse()
  const [extras, setExtras] = useState<Extras>({ goal: null, player: null, mistakesDue: 0, cardsDue: 0, journalDone: false })
  const minutesLeft = useMinutesToMidnight()

  useEffect(() => {
    Promise.allSettled([
      window.api.getProgressView(),
      window.api.getReviewOverview(),
      window.api.getVocab(),
      window.api.getJournal(),
      window.api.getGoal()
    ]).then(
      ([view, review, vocab, journal, goal]) =>
        setExtras({
          goal: goal.status === 'fulfilled' ? goal.value : null,
          player: view.status === 'fulfilled' ? view.value.player : null,
          mistakesDue: review.status === 'fulfilled' ? review.value.dueToday : 0,
          cardsDue: vocab.status === 'fulfilled' ? vocab.value.dueToday : 0,
          journalDone: journal.status === 'fulfilled' && journal.value.today?.review != null
        })
    )
  }, [progress])

  const week = progress.week
  const action = mainAction(progress, extras, navigate)
  const examDay = week?.days.find((d) => d.weekday === 6)
  const daysToExam = examDay ? daysBetween(progress.today, examDay.date) : null

  return (
    <section className="card stack today-card fade-in">
      <div className="today-head">
        <div>
          <span className="level">HOY</span>
          <h2>
            <span className="greeting">{course.greeting}!</span> {action.label}
          </h2>
          <p className="muted">{action.detail}</p>
        </div>
        <div className="today-stats">
          {extras.player && (
            <>
              <span className="today-stat" title="Días seguidos practicando">
                <Icon name="flame" className="glyph" /> <strong>{extras.player.streak}</strong> {extras.player.streak === 1 ? 'día' : 'días'}
              </span>
              <span className="today-stat" title={extras.player.title}>
                <Icon name="trophy" className="glyph" /> Nivel <strong>{extras.player.level}</strong>
              </span>
            </>
          )}
          {week && week.examStatus !== 'closed' && daysToExam !== null && daysToExam >= 0 && (
            <span className="today-stat" title={week.examMessage}>
              <Icon name="pruebas" className="glyph" />{' '}
              {week.examStatus === 'available' ? <strong>Examen abierto</strong> : daysToExam === 0 ? <strong>Examen hoy</strong> : <>Examen el {weekdayName(examDay!.date)}</>}
            </span>
          )}
        </div>
      </div>
      <div className="row today-actions">
        <button className="btn today-go" onClick={action.go}>
          {action.label}
        </button>
        {extras.goal && extras.goal.kind !== 'off' && <GoalMeter goal={extras.goal} />}
      </div>
      {extras.goal && !extras.goal.met && extras.goal.kind !== 'off' && minutesLeft <= 90 && (
        <div className="notice warn">
          Quedan {minutesLeft} minutos del día y te {extras.goal.target - extras.goal.done === 1 ? 'falta' : 'faltan'}{' '}
          {extras.goal.target - extras.goal.done} {goalUnit(extras.goal, extras.goal.target - extras.goal.done)} para tu meta.
        </div>
      )}
      <div className="today-shortcuts">
        <Shortcut icon="repaso" label="Repaso" count={extras.mistakesDue + extras.cardsDue} onClick={() => navigate('repaso')} />
        <Shortcut icon="diario" label={extras.journalDone ? 'Diario hecho' : 'Diario de hoy'} done={extras.journalDone} onClick={() => navigate('diario')} />
        <Shortcut icon="juegos" label="Juegos" onClick={() => navigate('juegos')} />
        <Shortcut icon="lecturas" label="Lecturas" onClick={() => navigate('lecturas')} />
        <Shortcut icon="resumenes" label="Resumen" onClick={() => navigate('resumenes')} />
      </div>
    </section>
  )
}

// La tarjeta del día se transforma en la de la práctica (View Transitions). Sin soporte o con
// animaciones reducidas, se cambia de sección directamente.
function morphTo(go: () => void): void {
  const reduced = document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || !document.startViewTransition) {
    go()
    return
  }
  document.startViewTransition(() => flushSync(go))
}

function mainAction(progress: ProgressState, extras: Extras, navigate: Navigate): Action {
  const week = progress.week
  if (week?.examStatus === 'available') {
    return { label: 'Rendir el examen', detail: week.examMessage, go: () => navigate('pruebas') }
  }
  if (week?.canPracticeNow && week.nextUnit) {
    return {
      label: 'Practicar',
      detail: `Día ${week.nextUnit.index}: ${week.nextUnit.subtopicTitle}.`,
      go: () => morphTo(() => navigate('practica'))
    }
  }
  if (week?.canRecover && !week.nextUnit) {
    return { label: 'Recuperar una falta', detail: 'Es domingo: una práctica de repaso recupera un día que faltaste.', go: () => navigate('practica') }
  }
  if (extras.mistakesDue > 0) {
    return {
      label: 'Repasar errores',
      detail: `Tenés ${extras.mistakesDue} ${extras.mistakesDue === 1 ? 'ejercicio' : 'ejercicios'} del cuaderno de errores para hoy.`,
      go: () => navigate('repaso')
    }
  }
  if (extras.cardsDue > 0) {
    return {
      label: 'Repasar tarjetas',
      detail: `${extras.cardsDue} ${extras.cardsDue === 1 ? 'palabra' : 'palabras'} de tu vocabulario para hoy.`,
      go: () => navigate('repaso')
    }
  }
  const done = week?.practiceBlockedReason ?? 'Lo de hoy ya está.'
  return { label: 'Jugar un rato', detail: `${done} Si querés seguir, los juegos y las lecturas suman.`, go: () => navigate('juegos') }
}

function GoalMeter({ goal }: { goal: GoalView }): React.JSX.Element {
  const ratio = Math.min(1, goal.done / Math.max(goal.target, 1))
  return (
    <div className={`goal-meter${goal.met ? ' met' : ''}`} title="Meta de hoy (se cambia en Ajustes → Estudio)">
      <span className="small">
        {goal.met ? <Icon name="check" className="glyph" /> : null} Meta de hoy: <strong>{Math.min(goal.done, goal.target)}</strong>/{goal.target}{' '}
        {goal.kind === 'minutes' ? 'min' : goalUnit(goal, goal.target)}
      </span>
      <span className="goal-bar">
        <span style={{ width: `${ratio * 100}%` }} />
      </span>
    </div>
  )
}

function Shortcut({
  icon,
  label,
  count,
  done,
  onClick
}: {
  icon: 'repaso' | 'diario' | 'juegos' | 'lecturas' | 'resumenes'
  label: string
  count?: number
  done?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button type="button" className={`today-shortcut${done ? ' done' : ''}`} onClick={onClick}>
      <Icon name={done ? 'check' : icon} className="glyph" />
      <span>{label}</span>
      {count !== undefined && count > 0 && <span className="count">{count}</span>}
    </button>
  )
}
