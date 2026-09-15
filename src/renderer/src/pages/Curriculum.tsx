import { useEffect, useMemo, useState } from 'react'
import {
  SKILL_LABELS,
  type CurriculumMap,
  type CurriculumMapLevel,
  type CurriculumMapTopic,
  type Subtopic,
  type TopicMapStatus
} from '@shared/curriculum'

const STATUS_LABEL: Record<TopicMapStatus, string> = {
  'not-started': 'Sin empezar',
  locked: 'Bloqueado',
  current: 'En curso',
  passed: 'Aprobado',
  review: 'Para repasar'
}

// Minúsculas y sin tildes, para que la búsqueda no dependa de cómo se escriba.
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const subtopicText = (s: Subtopic): string =>
  fold(
    [s.title, s.goal, ...s.keyPoints, ...s.examples.flatMap((e) => [e.en, e.es]), ...s.commonMistakes.flatMap((m) => [m.wrong, m.right, m.why])].join(
      ' '
    )
  )

const topicText = (t: CurriculumMapTopic): string => fold([t.title, t.titleEn, t.description, ...t.objectives].join(' '))

type Toggle = (key: string) => void

function useToggleSet(): [Set<string>, Toggle, (keys: string[]) => void] {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle: Toggle = (key) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  return [open, toggle, (keys) => setOpen(new Set(keys))]
}

function Chevron({ open }: { open: boolean }): React.JSX.Element {
  return (
    <span className={`chevron${open ? ' open' : ''}`} aria-hidden>
      ›
    </span>
  )
}

export default function Curriculum(): React.JSX.Element {
  const [map, setMap] = useState<CurriculumMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [openLevels, toggleLevel, setLevels] = useToggleSet()
  const [openTopics, toggleTopic, setTopics] = useToggleSet()
  const [openSubtopics, toggleSubtopic, setSubtopics] = useToggleSet()

  useEffect(() => {
    window.api
      .getCurriculumMap()
      .then((result) => {
        setMap(result)
        // Se abre el nivel y el tópico en curso (o el primer nivel disponible).
        const current = result.levels.flatMap((l) => l.topics).find((t) => t.id === result.currentTopicId)
        const firstLevel = current?.level ?? result.levels.find((l) => l.available)?.level
        setLevels(firstLevel ? [firstLevel] : [])
        setTopics(current ? [current.id] : [])
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  const q = fold(query.trim())
  const matches = useMemo(() => {
    if (!map || !q) return null
    const topics = new Set<string>()
    const subtopics = new Set<string>()
    for (const topic of map.levels.flatMap((l) => l.topics)) {
      for (const s of topic.subtopics) {
        if (subtopicText(s).includes(q)) {
          subtopics.add(`${topic.id}/${s.id}`)
          topics.add(topic.id)
        }
      }
      if (topicText(topic).includes(q)) topics.add(topic.id)
    }
    return { topics, subtopics }
  }, [map, q])

  if (error) {
    return (
      <>
        <h1>Temario</h1>
        <section className="card">
          <p className="error multiline">{error}</p>
        </section>
      </>
    )
  }
  if (!map) return <h1>Temario</h1>

  const allTopics = map.levels.flatMap((l) => l.topics)
  const titles = new Map(allTopics.map((t) => [t.id, t.title]))
  const availableLevels = map.levels.filter((l) => l.available).map((l) => l.level)

  return (
    <>
      <h1>Temario</h1>
      <section className="card wide stack">
        <p className="muted">
          {map.totalTopics} tópicos disponibles ({availableLevels.join(' y ')}) · {map.reviewedCount} revisados. Cada tópico dura una
          semana, con un subtema por día de lunes a viernes.
        </p>
        <div className="row">
          <input
            type="search"
            className="text-answer search"
            placeholder="Buscar un tema, una regla o un ejemplo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="btn secondary"
            onClick={() => {
              setLevels(map.levels.map((l) => l.level))
              setTopics(allTopics.map((t) => t.id))
            }}
          >
            Expandir todo
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              setLevels([])
              setTopics([])
              setSubtopics([])
            }}
          >
            Contraer todo
          </button>
        </div>
      </section>

      {map.levels.map((level) => {
        const visibleTopics = matches ? level.topics.filter((t) => matches.topics.has(t.id)) : level.topics
        if (matches && visibleTopics.length === 0) return null
        return (
          <LevelSection
            key={level.level}
            level={level}
            topics={visibleTopics}
            searching={matches !== null}
            open={matches !== null || openLevels.has(level.level)}
            onToggle={() => toggleLevel(level.level)}
            currentTopicId={map.currentTopicId}
            titles={titles}
            isTopicOpen={(id) => (matches ? matches.topics.has(id) : openTopics.has(id))}
            onToggleTopic={toggleTopic}
            isSubtopicOpen={(key) => (matches ? matches.subtopics.has(key) : openSubtopics.has(key))}
            onToggleSubtopic={toggleSubtopic}
          />
        )
      })}

      {matches && matches.topics.size === 0 && (
        <section className="card wide">
          <p className="muted">No hay resultados para «{query}».</p>
        </section>
      )}
    </>
  )
}

interface LevelSectionProps {
  level: CurriculumMapLevel
  topics: CurriculumMapTopic[]
  searching: boolean
  open: boolean
  onToggle: () => void
  currentTopicId: string | null
  titles: Map<string, string>
  isTopicOpen: (id: string) => boolean
  onToggleTopic: Toggle
  isSubtopicOpen: (key: string) => boolean
  onToggleSubtopic: Toggle
}

function LevelSection({ level, topics, searching, open, onToggle, ...rest }: LevelSectionProps): React.JSX.Element {
  const passed = level.topics.filter((t) => t.status === 'passed' || t.status === 'review').length
  const total = level.topics.length

  return (
    <section className="card wide">
      <button className="accordion-header" aria-expanded={open} onClick={onToggle}>
        <span className="level-code">{level.level}</span>
        <span className="level-heading">
          <strong>{level.name}</strong>
          <span className="muted">
            {level.available ? `${passed} de ${total} tópicos aprobados` : level.planned.length > 0 ? 'Planificado · próximamente' : 'Más adelante'}
          </span>
        </span>
        {level.available && (
          <span className="progress-bar small" aria-hidden>
            <span style={{ width: `${(passed / total) * 100}%` }} />
          </span>
        )}
        <Chevron open={open} />
      </button>

      {open && (
        <div className="accordion-body">
          {topics.map((topic) => (
            <TopicItem key={topic.id} topic={topic} open={rest.isTopicOpen(topic.id)} {...rest} />
          ))}
          {!searching && level.planned.length > 0 && (
            <div className="planned">
              <h3 className="level">TÓPICOS PLANIFICADOS</h3>
              <ol>
                {level.planned.map((p, i) => (
                  <li key={i}>
                    <strong>{p.title}</strong> <span className="muted">— {p.description}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {!searching && !level.available && level.planned.length === 0 && (
            <p className="muted">Los tópicos de este nivel se definen más adelante.</p>
          )}
        </div>
      )}
    </section>
  )
}

function TopicItem({
  topic,
  open,
  currentTopicId,
  titles,
  onToggleTopic,
  isSubtopicOpen,
  onToggleSubtopic
}: { topic: CurriculumMapTopic; open: boolean } & Omit<LevelSectionProps, 'level' | 'topics' | 'searching' | 'open' | 'onToggle'>): React.JSX.Element {
  const prerequisites = topic.prerequisites.map((id) => titles.get(id) ?? id)

  return (
    <div className={`topic-item${topic.id === currentTopicId ? ' is-current' : ''}`}>
      <button className="accordion-header" aria-expanded={open} onClick={() => onToggleTopic(topic.id)}>
        <span className="topic-number">{topic.order}</span>
        <span className="topic-heading">
          <span className="topic-title">{topic.title}</span>
          <span className="muted topic-sub">
            {topic.titleEn} · {topic.subtopics.length} subtemas
          </span>
        </span>
        <span className={`status-chip ${topic.status}`}>{STATUS_LABEL[topic.status]}</span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="topic-body stack-sm">
          <p>{topic.description}</p>
          <div>
            <h4 className="level">OBJETIVOS</h4>
            <ul>
              {topic.objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
          {prerequisites.length > 0 && <p className="muted">Conviene saber antes: {prerequisites.join(', ')}.</p>}
          {topic.attempts > 0 && (
            <p className="muted">
              Mejor nota: {topic.bestGrade} · {topic.attempts} {topic.attempts === 1 ? 'intento' : 'intentos'} de examen
            </p>
          )}
          {!topic.reviewed && <p className="muted small">Contenido todavía sin revisar.</p>}

          <div className="subtopic-list">
            {[...topic.subtopics]
              .sort((a, b) => a.day - b.day)
              .map((s) => {
                const key = `${topic.id}/${s.id}`
                return <SubtopicItem key={key} subtopic={s} open={isSubtopicOpen(key)} onToggle={() => onToggleSubtopic(key)} />
              })}
          </div>
        </div>
      )}
    </div>
  )
}

function SubtopicItem({ subtopic, open, onToggle }: { subtopic: Subtopic; open: boolean; onToggle: () => void }): React.JSX.Element {
  return (
    <div className="subtopic-item">
      <button className="accordion-header" aria-expanded={open} onClick={onToggle}>
        <span className="day-label">Día {subtopic.day}</span>
        <span className="subtopic-title">{subtopic.title}</span>
        <span className="skill-chips">
          {subtopic.focus.map((skill) => (
            <span key={skill} className="skill-chip">
              {SKILL_LABELS[skill]}
            </span>
          ))}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="subtopic-body stack-sm">
          <p>
            <strong>Objetivo:</strong> {subtopic.goal}
          </p>
          <div>
            <h5 className="level">PUNTOS CLAVE</h5>
            <ul>
              {subtopic.keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="level">EJEMPLOS</h5>
            <ul className="examples">
              {subtopic.examples.map((example, i) => (
                <li key={i}>
                  <span className="en">{example.en}</span> <span className="muted">— {example.es}</span>
                </li>
              ))}
            </ul>
          </div>
          {subtopic.commonMistakes.length > 0 && (
            <div>
              <h5 className="level">ERRORES COMUNES</h5>
              <ul className="mistakes">
                {subtopic.commonMistakes.map((m, i) => (
                  <li key={i}>
                    <s>{m.wrong}</s> → <strong>{m.right}</strong>: {m.why}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
