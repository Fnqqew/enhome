import { useEffect, useState } from 'react'
import { CHANGELOG } from '@shared/changelog'
import type { IconName } from '@shared/icons'
import { useCourse } from '../hooks/useCourse'
import { readLocal, writeLocal } from '../shell'
import Icon from './Icon'

interface Step {
  icon: IconName
  title: string
  text: string
}

// Recorrido de bienvenida: tres pasos la primera vez que se abre cada idioma.
function steps(name: string): Step[] {
  return [
    {
      icon: 'calendar',
      title: `Una semana, un tópico de ${name}`,
      text: 'De lunes a viernes hacés una práctica por día, cada una sobre un subtema. Si un día no podés, queda pendiente y el domingo recuperás una falta.'
    },
    {
      icon: 'practica',
      title: 'La práctica, con Claude de profesor',
      text: 'Ejercicios cortos para calentar y después conversaciones, situaciones y traducciones. Lo que fallás vuelve en Repaso hasta que lo aprendés.'
    },
    {
      icon: 'pruebas',
      title: 'El examen del fin de semana',
      text: 'Con las cinco prácticas hechas, el examen se habilita el viernes. Se aprueba con 8 y pasás al tópico siguiente. Mientras tanto, los juegos y las lecturas suman.'
    }
  ]
}

export function WelcomeTour(): React.JSX.Element | null {
  const course = useCourse()
  const key = `tour:${course.id}`
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  // Solo para un curso sin empezar: quien ya lo venía usando no necesita la bienvenida.
  useEffect(() => {
    setIndex(0)
    if (readLocal(key) === 'done') {
      setOpen(false)
      return
    }
    window.api
      .getCourses()
      .then((courses) => {
        const started = courses.find((c) => c.language === course.id)?.started ?? false
        if (started) writeLocal(key, 'done')
        setOpen(!started)
      })
      .catch(() => setOpen(false))
  }, [key, course.id])

  if (!open) return null
  const all = steps(course.name)
  const step = all[index]
  const close = (): void => {
    writeLocal(key, 'done')
    setOpen(false)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal card stack tour" role="dialog" aria-modal="true" aria-label="Bienvenida">
        <span className="level">
          BIENVENIDA · {index + 1} DE {all.length}
        </span>
        <Icon name={step.icon} className="tour-icon" />
        <h2>{step.title}</h2>
        <p>{step.text}</p>
        <div className="tour-dots" aria-hidden="true">
          {all.map((_, i) => (
            <span key={i} className={i === index ? 'on' : undefined} />
          ))}
        </div>
        <div className="row spread">
          <button className="btn secondary" onClick={close}>
            Saltear
          </button>
          <button className="btn" autoFocus onClick={() => (index + 1 < all.length ? setIndex(index + 1) : close())}>
            {index + 1 < all.length ? 'Siguiente' : `¡${course.greeting}! Empezar`}
          </button>
        </div>
      </div>
    </div>
  )
}

// Novedades: una vez al abrir una versión nueva (no en la primera instalación, que tiene la bienvenida).
export function WhatsNew({ version }: { version: string }): React.JSX.Element | null {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const seen = readLocal('version')
    if (seen === version || !CHANGELOG.some((r) => r.version === version)) return
    if (seen) {
      setOpen(true)
      return
    }
    // Sin registro de versión: si ya había un curso empezado es una actualización; si no, una instalación nueva.
    window.api
      .getCourses()
      .then((courses) => {
        if (courses.some((c) => c.started)) setOpen(true)
        else writeLocal('version', version)
      })
      .catch(() => undefined)
  }, [version])

  if (!open) return null
  const release = CHANGELOG.find((r) => r.version === version)!
  const close = (): void => {
    writeLocal('version', version)
    setOpen(false)
  }
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal card stack" role="dialog" aria-modal="true" aria-label="Novedades" onMouseDown={(e) => e.stopPropagation()}>
        <span className="level">NOVEDADES · VERSIÓN {release.version}</span>
        <h2>{release.title}</h2>
        <ul className="whats-new">
          {release.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div>
          <button className="btn" autoFocus onClick={close}>
            Genial
          </button>
        </div>
      </div>
    </div>
  )
}
