import { useEffect, useState } from 'react'
import { useSettings } from '../theme/SettingsProvider'

// Pantalla de carga: una casa que se dibuja de un trazo y, adentro, alguien que escribe «Hola»,
// lo borra y escribe «Hello». Es lo que hace la app: pasar del español al inglés, en casa.

const WORDMARK = ['E', 'n', 'h', 'o', 'm', 'e']

// Cuánto dura como mínimo, para que la animación se vea entera aunque todo cargue antes.
const MIN_MS = 2600
const MIN_MS_REDUCED = 350
const EXIT_MS = 450

// Línea de tiempo de lo que se escribe adentro de la casa (en milisegundos desde que aparece).
const TIMELINE: { at: number; text: string; english: boolean }[] = [
  ...['H', 'Ho', 'Hol', 'Hola'].map((text, i) => ({ at: 750 + i * 115, text, english: false })),
  ...['Hol', 'Ho', 'H', ''].map((text, i) => ({ at: 1500 + i * 65, text, english: false })),
  ...['H', 'He', 'Hel', 'Hell', 'Hello'].map((text, i) => ({ at: 1820 + i * 105, text, english: true }))
]

export default function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }): React.JSX.Element {
  const { settings } = useSettings()
  const [reduced] = useState(() => settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [word, setWord] = useState(reduced ? { text: 'Hello', english: true } : { text: '', english: false })
  const [minElapsed, setMinElapsed] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const timers = reduced ? [] : TIMELINE.map((step) => setTimeout(() => setWord(step), step.at))
    timers.push(setTimeout(() => setMinElapsed(true), reduced ? MIN_MS_REDUCED : MIN_MS))
    return () => timers.forEach(clearTimeout)
  }, [reduced])

  useEffect(() => {
    if (ready && minElapsed) setLeaving(true)
  }, [ready, minElapsed])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(onDone, reduced ? 0 : EXIT_MS)
    return () => clearTimeout(timer)
  }, [leaving, onDone, reduced])

  return (
    <div className={`splash${leaving ? ' leaving' : ''}`} role="status" aria-label="Cargando Enhome">
      <div className="splash-mark">
        <svg className="splash-house" viewBox="0 0 160 140" aria-hidden="true">
          <path className="house-line" pathLength={1} d="M20 70 L80 18 L140 70 V124 H20 Z" />
          <path className="house-chimney" pathLength={1} d="M108 42 V26 H122 V54" />
        </svg>
        <span className={`splash-word${word.english ? ' english' : ''}`} aria-hidden="true">
          {word.text}
          <i className="caret" />
        </span>
      </div>

      <p className="splash-name" aria-hidden="true">
        {WORDMARK.map((letter, i) => (
          <span key={i} className={i < 2 ? 'accent' : undefined} style={{ animationDelay: `${0.45 + i * 0.06}s` }}>
            {letter}
          </span>
        ))}
      </p>
      <p className="splash-tagline">Inglés en casa, de a un tema por semana</p>

      <div className="splash-progress" aria-hidden="true">
        <span />
      </div>
      <p className="splash-status">{ready ? 'Todo listo' : 'Preparando tu clase…'}</p>
    </div>
  )
}
