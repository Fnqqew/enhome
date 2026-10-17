import { useState } from 'react'
import { CHANGELOG } from '@shared/changelog'
import type { Navigate } from '../navigation'

interface Question {
  q: string
  a: React.ReactNode
}

const SECTIONS: { title: string; questions: Question[] }[] = [
  {
    title: 'La semana',
    questions: [
      {
        q: '¿Cómo funciona una semana?',
        a: 'Cada semana es un tópico. De lunes a viernes hay una práctica por día, cada una sobre un subtema. Con las cinco hechas, el examen se habilita el viernes y la fecha sugerida es el sábado. El domingo es libre: repaso, simulacros o recuperar una falta.'
      },
      {
        q: '¿Qué es una falta y cómo se recupera?',
        a: 'Un día de lunes a viernes que termina sin terminar la práctica. La práctica no se pierde: queda pendiente para hacerla después. El domingo, una práctica de repaso recupera una falta.'
      },
      {
        q: '¿Por qué está bloqueado el examen?',
        a: 'Con 3 faltas o más el examen de esa semana se bloquea y la semana siguiente seguís con el mismo tópico, empezando por lo pendiente. Si tenés justo 3 y recuperás una el domingo, se vuelve a habilitar.'
      },
      {
        q: '¿Puedo frenar un curso?',
        a: 'Sí: en Ajustes → Cursos podés pausar el curso del idioma que estás viendo. Mientras está en pausa no se cuentan faltas ni se corta la racha; lo reanudás cuando quieras.'
      }
    ]
  },
  {
    title: 'Práctica y repaso',
    questions: [
      {
        q: '¿Por qué a veces aparecen primero los ejercicios cortos?',
        a: 'Claude arma los ejercicios en dos tandas: la corta llega antes y empezás con esa; los largos (la conversación, la tanda de traducción y la escritura) se suman al final cuando terminan.'
      },
      {
        q: '¿Puedo cambiar un ejercicio o pedir una pista?',
        a: 'Sí. «Cambiar ejercicio» lo reemplaza por otro equivalente. Las pistas se ganan con la racha: una cada 3 días seguidos, hasta 2 por práctica.'
      },
      {
        q: '¿Qué es el cuaderno de errores?',
        a: 'Todo lo que respondés mal en la práctica o en un examen se anota en Repaso y vuelve a los 1, 3, 7 y 15 días. Cuando lo acertás cuatro veces seguidas queda aprendido; si lo fallás, vuelve a empezar.'
      },
      {
        q: '¿Cómo guardo una palabra?',
        a: 'Seleccioná (o tocá dos veces) una palabra en un resumen, una lectura o un ejercicio ya corregido y elegí «Traducir». Desde ahí la guardás: vuelve en tarjetas y aparece en el memotest.'
      }
    ]
  },
  {
    title: 'Exámenes',
    questions: [
      {
        q: '¿Qué pasa si se cierra la app en medio del examen?',
        a: 'Las respuestas se guardan solas. El examen queda en pausa hasta 30 minutos, una sola vez por examen. Si pasa más tiempo se anula sin contar como reprobado y se arma uno nuevo con otras preguntas.'
      },
      {
        q: '¿Con cuánto se aprueba?',
        a: 'Con 8 sobre 10. Si no llegás, la semana siguiente se enfoca en lo que fallaste y el examen trae preguntas nuevas. Desde el resultado podés repasar exactamente las preguntas que fallaste.'
      },
      {
        q: '¿Para qué sirven los simulacros?',
        a: 'Para medir cómo vas sin que cuente para aprobar: del tópico actual, de todo lo visto o de un solo subtema (6 preguntas). Igual alimentan la detección de puntos débiles.'
      }
    ]
  },
  {
    title: 'Claude',
    questions: [
      {
        q: '¿Por qué tarda a veces?',
        a: 'Claude arma y revisa cada tanda de ejercicios y cada examen para que no tengan errores. Si tarda más de un minuto aparece «Cancelar»; en Acerca de ves cuánto tarda cada tarea.'
      },
      {
        q: '¿Qué hago si dice que la sesión venció o que llegué al límite?',
        a: 'Si venció la sesión, abrí una terminal, ejecutá «claude» y volvé a iniciar sesión. Si llegaste al límite de tu plan, esperá a que se renueve (Claude Code avisa a qué hora). Los juegos y el repaso de tarjetas funcionan igual sin Claude.'
      }
    ]
  },
  {
    title: 'Atajos de teclado',
    questions: [
      {
        q: '¿Qué atajos hay?',
        a: (
          <ul className="shortcut-list">
            <li>
              <kbd>Ctrl</kbd>+<kbd>K</kbd> buscar una sección, un tópico o una acción
            </li>
            <li>
              <kbd>Ctrl</kbd>+<kbd>1</kbd> a <kbd>9</kbd> ir a las secciones · <kbd>Ctrl</kbd>+<kbd>B</kbd> plegar la barra lateral
            </li>
            <li>
              En la práctica: <kbd>Enter</kbd> comprobar y seguir (<kbd>Ctrl</kbd>+<kbd>Enter</kbd> en textos largos), <kbd>Ctrl</kbd>+<kbd>H</kbd>{' '}
              pista, <kbd>Ctrl</kbd>+<kbd>→</kbd> cambiar ejercicio
            </li>
            <li>
              <kbd>Esc</kbd> salir del modo enfoque o cerrar una ventana
            </li>
          </ul>
        )
      }
    ]
  },
  {
    title: 'Tus datos',
    questions: [
      {
        q: '¿Dónde se guarda mi progreso?',
        a: 'En esta computadora, en una base por idioma dentro de la carpeta de datos de la app (Acerca de → «Abrir carpeta de datos»). No hay cuentas ni servidores propios; a Claude solo le llega lo que se le pide.'
      },
      {
        q: 'Algo anda mal, ¿cómo lo aviso?',
        a: 'Anotalo en Comentarios. Si es un error, en Acerca de está «Abrir registro de errores» con lo técnico de lo que pasó.'
      }
    ]
  }
]

// Ayuda: preguntas frecuentes y novedades de cada versión.
export default function Help({ navigate }: { navigate: Navigate }): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const releases = showAll ? CHANGELOG : CHANGELOG.slice(0, 1)
  return (
    <>
      <h1>Ayuda</h1>
      {SECTIONS.map((section) => (
        <section key={section.title} className="card stack fade-in">
          <h2>{section.title}</h2>
          {section.questions.map((item) => (
            <details key={item.q} className="faq">
              <summary>{item.q}</summary>
              <div className="faq-answer">{item.a}</div>
            </details>
          ))}
        </section>
      ))}
      <section className="card stack fade-in">
        <h2>Novedades</h2>
        {releases.map((release) => (
          <div key={release.version} className="stack-sm">
            <strong>
              {release.version} · {release.title}
            </strong>
            <ul>
              {release.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="row">
          {CHANGELOG.length > 1 && (
            <button className="btn secondary" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Ver solo la última' : 'Ver versiones anteriores'}
            </button>
          )}
          <button className="btn secondary" onClick={() => navigate('comentarios')}>
            Dejar un comentario
          </button>
        </div>
      </section>
    </>
  )
}
