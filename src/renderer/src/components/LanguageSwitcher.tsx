import { useEffect, useRef, useState } from 'react'
import { LANGUAGES, languageInfo, type CourseSummary } from '@shared/languages'
import { courseLine } from '../courseText'
import { useSettings } from '../theme/SettingsProvider'

// Selector de idioma de la barra lateral: muestra el curso abierto y en qué va cada uno.
export default function LanguageSwitcher({ locked }: { locked: boolean }): React.JSX.Element {
  const { settings, update } = useSettings()
  const [open, setOpen] = useState(false)
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const box = useRef<HTMLDivElement>(null)
  const current = languageInfo(settings.language)

  useEffect(() => {
    if (!open) return
    window.api
      .getCourses()
      .then(setCourses)
      .catch(() => undefined)
    // Se cierra al tocar afuera o con Escape.
    const onClick = (e: MouseEvent): void => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="lang-switch" ref={box}>
      <button
        type="button"
        className="lang-current"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={locked}
        title={locked ? 'Entregá el examen para cambiar de idioma' : 'Cambiar de idioma'}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="lang-badge" style={{ background: current.color }}>
          {current.code}
        </span>
        <span className="lang-name">{current.label}</span>
        <svg className="lang-chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <ul className="lang-menu" role="listbox" aria-label="Idioma">
          {LANGUAGES.map((language) => {
            const course = courses.find((c) => c.language === language.id)
            const selected = language.id === settings.language
            return (
              <li key={language.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={course ? !course.available : false}
                  onClick={() => {
                    setOpen(false)
                    if (!selected) update({ language: language.id })
                  }}
                >
                  <span className="lang-badge" style={{ background: language.color }}>
                    {language.code}
                  </span>
                  <span className="lang-option">
                    <strong>{language.label}</strong>
                    <span className="muted small">{courseLine(course) || language.endonym}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
