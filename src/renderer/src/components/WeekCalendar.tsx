import { WEEKDAY_NAMES } from '@shared/dates'
import type { DayStatus, WeekDayView } from '@shared/progress'

const INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const STATUS_LABEL: Record<Exclude<DayStatus, 'weekend'>, string> = {
  upcoming: 'Próximo',
  today: 'Hoy',
  done: 'Hecho',
  missed: 'Falta',
  recovered: 'Recuperada',
  skipped: '—'
}

export default function WeekCalendar({ days, today }: { days: WeekDayView[]; today: string }): React.JSX.Element {
  return (
    <div className="week-calendar">
      {days.map((d) => {
        const label = d.status === 'weekend' ? (d.weekday === 6 ? 'Examen' : 'Libre') : STATUS_LABEL[d.status]
        return (
          <div
            key={d.date}
            className={`day ${d.status}${d.date === today ? ' is-today' : ''}`}
            title={`${WEEKDAY_NAMES[d.weekday - 1]} ${d.date}`}
          >
            <span className="dow">{INITIALS[d.weekday - 1]}</span>
            <span className="num">{Number(d.date.slice(8))}</span>
            <span className="state">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
