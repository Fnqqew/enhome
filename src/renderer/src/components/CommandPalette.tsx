import { useEffect, useMemo, useRef, useState } from 'react'
import type { CurriculumTopic } from '@shared/curriculum'
import type { IconName } from '@shared/icons'
import { LANGUAGES } from '@shared/languages'
import { SECTIONS, type Navigate } from '../navigation'
import { useSettings } from '../theme/SettingsProvider'
import Icon from './Icon'

interface Command {
  id: string
  label: string
  hint: string
  icon: IconName
  run: () => void
}

// Sin tildes ni mayúsculas, para buscar «practica» y encontrar «Práctica».
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// Buscador general (Ctrl+K): secciones, tópicos, acciones y ajustes, escribiendo.
export default function CommandPalette({ navigate, onClose }: { navigate: Navigate; onClose: () => void }): React.JSX.Element {
  const { settings, update } = useSettings()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [topics, setTopics] = useState<CurriculumTopic[]>([])
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    window.api
      .getCurriculum()
      .then(setTopics)
      .catch(() => undefined)
  }, [])

  const commands = useMemo<Command[]>(() => {
    const go = (fn: () => void) => () => {
      fn()
      onClose()
    }
    const sections: Command[] = SECTIONS.map((s, i) => ({
      id: `section:${s.id}`,
      label: s.label,
      hint: i < 9 ? `Ctrl+${i + 1}` : 'Sección',
      icon: s.id,
      run: go(() => navigate(s.id))
    }))
    const actions: Command[] = [
      { id: 'practice', label: 'Empezar la práctica del día', hint: 'Acción', icon: 'practica', run: go(() => navigate('practica')) },
      { id: 'review', label: 'Repasar errores y tarjetas', hint: 'Acción', icon: 'repaso', run: go(() => navigate('repaso')) },
      { id: 'reading', label: 'Escribir una lectura nueva', hint: 'Acción', icon: 'lecturas', run: go(() => navigate('lecturas')) },
      { id: 'journal', label: 'Escribir en el diario', hint: 'Acción', icon: 'diario', run: go(() => navigate('diario')) },
      {
        id: 'theme',
        label: settings.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
        hint: 'Ajuste',
        icon: 'ajustes',
        run: go(() => update({ theme: settings.theme === 'dark' ? 'light' : 'dark' }))
      },
      ...LANGUAGES.filter((l) => l.id !== settings.language).map(
        (l): Command => ({
          id: `language:${l.id}`,
          label: `Cambiar al curso de ${l.name}`,
          hint: 'Idioma',
          icon: 'temario',
          run: go(() => update({ language: l.id }))
        })
      )
    ]
    const topicCommands: Command[] = topics.map((t) => ({
      id: `topic:${t.id}`,
      label: `${t.title} · ${t.targetTitle}`,
      hint: `Tópico ${t.level}`,
      icon: 'temario',
      run: go(() => navigate('temario', { topicId: t.id }))
    }))
    return [...sections, ...actions, ...topicCommands]
  }, [topics, settings.theme, settings.language, navigate, onClose, update])

  const results = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean)
    if (words.length === 0) return commands.slice(0, 14)
    return commands.filter((c) => words.every((w) => fold(`${c.label} ${c.hint}`).includes(w))).slice(0, 30)
  }, [commands, query])

  useEffect(() => setSelected(0), [query])
  useEffect(() => {
    listRef.current?.children[selected]?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const onKey = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((i) => Math.min(i + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      results[selected]?.run()
    } else if (event.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={onClose}>
      <div className="palette card" role="dialog" aria-modal="true" aria-label="Buscar" onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="palette-input"
          autoFocus
          value={query}
          placeholder="Buscá una sección, un tópico o una acción…"
          aria-label="Buscar"
          aria-controls="palette-results"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <ul id="palette-results" ref={listRef} className="palette-list" role="listbox">
          {results.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === selected}>
              <button type="button" className="palette-item" onMouseEnter={() => setSelected(i)} onClick={c.run}>
                <Icon name={c.icon} className="glyph" />
                <span className="palette-label">{c.label}</span>
                <span className="muted small">{c.hint}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="muted small palette-empty">No hay resultados para «{query}».</li>}
        </ul>
        <p className="muted small palette-foot">
          <kbd>↑</kbd> <kbd>↓</kbd> elegir · <kbd>Enter</kbd> abrir · <kbd>Esc</kbd> cerrar
        </p>
      </div>
    </div>
  )
}
