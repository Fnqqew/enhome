import { WEEKDAY_NAMES } from '@shared/dates'
import type { DayStatus, WeekDayView } from '@shared/progress'

const INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const STATUS_LABEL: Record<Exclude<DayStatus, 'weekend'>, string> = {
  upcoming: 'Próximo',
  today: 'Hoy',
  done: 'Hecho',
  missed: 'Falta',
  recovered: 'Recuperada',
  skipped: '—',
  paused: 'Pausa'
}

export default function WeekCalendar({ days, today }: { days: WeekDayView[]; today: string }): React.JSX.Element {
  return (
    <div className="week-calendar" role="list" aria-label="Días de la semana">
      {days.map((d) => {
        const label = d.status === 'weekend' ? (d.weekday === 6 ? 'Examen' : 'Libre') : STATUS_LABEL[d.status]
        return (
          <div
            key={d.date}
            role="listitem"
            className={`day ${d.status}${d.date === today ? ' is-today' : ''}`}
            title={`${WEEKDAY_NAMES[d.weekday - 1]} ${d.date}`}
            aria-label={`${WEEKDAY_NAMES[d.weekday - 1]} ${Number(d.date.slice(8))}: ${label}`}
            aria-current={d.date === today ? 'date' : undefined}
          >
            <span className="dow" aria-hidden="true">{INITIALS[d.weekday - 1]}</span>
            <span className="num">{Number(d.date.slice(8))}</span>
            <span className="state">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
