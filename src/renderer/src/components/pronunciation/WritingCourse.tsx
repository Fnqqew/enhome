// El curso de escritura: los caracteres por grupos, para escuchar, y un juego para reconocerlos.

import { useState } from 'react'
import type { WritingCourse as Course } from '@shared/writing'
import { useCourse } from '../../hooks/useCourse'
import { useSpeech } from '../../hooks/useSpeech'
import { shuffled } from '@shared/shuffle'
import Icon from '../Icon'

export default function WritingCourse({ course }: { course: Course }): React.JSX.Element {
  const lang = useCourse()
  const speech = useSpeech()
  const [open, setOpen] = useState(0)
  const say = (text: string): void => speech.speakAs(text, lang.id, true)
  const group = course.groups[open]

  return (
    <>
      <section className="card stack fade-in">
        <span className="level">ESCRITURA · {lang.name.toUpperCase()}</span>
        <p>{course.intro}</p>
        <p className="muted small">{course.romanization}</p>
      </section>

      <section className="card stack fade-in">
        <div className="chip-grid" role="tablist" aria-label="Grupos de caracteres">
          {course.groups.map((g, i) => (
            <button
              key={g.title}
              type="button"
              role="tab"
              className="chip"
              aria-selected={i === open}
              aria-pressed={i === open}
              onClick={() => setOpen(i)}
            >
              {g.title}
            </button>
          ))}
        </div>
        <h2>{group.title}</h2>
        <p>{group.description}</p>
        <div className="char-grid">
          {group.characters.map((c) => (
            <button
              key={c.char}
              type="button"
              className="char-card"
              onClick={() => say(c.example.word)}
              title={`${c.example.word} — ${c.example.es}`}
            >
              <span className="char-glyph" lang={lang.code.toLowerCase()}>
                {c.char}
              </span>
              <span className="char-roman">{c.roman}</span>
              <span className="muted small">
                {c.example.word} · {c.example.es}
              </span>
            </button>
          ))}
        </div>
        <p className="muted small">Tocá un carácter para escuchar su palabra de ejemplo.</p>
      </section>

      <CharQuiz characters={group.characters} title={group.title} />

      <section className="card stack fade-in">
        <h2>Escribir con el teclado</h2>
        <p className="multiline">{course.keyboard}</p>
      </section>
    </>
  )
}

// Aparece un carácter y hay que elegir cómo se lee.
function CharQuiz({ characters, title }: { characters: Course['groups'][number]['characters']; title: string }): React.JSX.Element | null {
  const [index, setIndex] = useState<number | null>(null)
  const [options, setOptions] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })
  if (characters.length < 4) return null

  const next = (): void => {
    const i = Math.floor(Math.random() * characters.length)
    const others = shuffled(
      characters.filter((_, k) => k !== i).map((c) => c.roman),
      Math.random
    ).slice(0, 3)
    setIndex(i)
    setOptions(shuffled([characters[i].roman, ...others], Math.random))
    setPicked(null)
  }

  const current = index !== null ? characters[index] : null
  return (
    <section className="card stack fade-in">
      <div className="row spread">
        <h2>¿Cómo se lee? · {title}</h2>
        {score.total > 0 && (
          <span className="badge">
            {score.right} de {score.total}
          </span>
        )}
      </div>
      {!current ? (
        <div>
          <button className="btn" onClick={next}>
            <Icon name="play" className="glyph" /> Probarme con este grupo
          </button>
        </div>
      ) : (
        <>
          <p className="char-glyph big-glyph">{current.char}</p>
          <div className="options">
            {options.map((option) => {
              const state = picked === null ? '' : option === current.roman ? ' correct' : option === picked ? ' wrong' : ''
              return (
                <button
                  key={option}
                  type="button"
                  className={`option${state}`}
                  disabled={picked !== null}
                  onClick={() => {
                    setPicked(option)
                    setScore({ right: score.right + (option === current.roman ? 1 : 0), total: score.total + 1 })
                  }}
                >
                  {option}
                </button>
              )
            })}
          </div>
          {picked !== null && (
            <div className="row">
              <span className={picked === current.roman ? 'ok-text' : 'warn-text'}>
                {picked === current.roman ? '¡Bien!' : `Era «${current.roman}».`} {current.example.word} = {current.example.es}
              </span>
              <button className="btn" onClick={next}>
                Otro
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
