import { useEffect, useRef, useState } from 'react'
import { formatDayMonth } from '@shared/dates'
import { LIBRARY_KINDS, type LibraryKind, type LibraryResult } from '@shared/library'
import Markdown from '../components/Markdown'

const SEARCH_DELAY_MS = 200

// Biblioteca: todo lo generado del curso (resúmenes, lecturas, vocabulario y diario), con buscador.
export default function Library(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<LibraryKind | null>(null)
  const [results, setResults] = useState<LibraryResult[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      window.api
        .searchLibrary(query)
        .then(setResults)
        .catch((err: Error) => setError(err.message))
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer.current)
  }, [query])

  const visible = (results ?? []).filter((r) => !kind || r.kind === kind)
  const counts = (results ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {})

  return (
    <>
      <h1>Biblioteca</h1>
      <section className="card stack fade-in">
        <input
          className="text-answer"
          autoFocus
          value={query}
          placeholder="Buscá en tus resúmenes, lecturas, palabras y diario…"
          aria-label="Buscar en la biblioteca"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chip-grid" role="group" aria-label="Qué mostrar">
          <button type="button" className="chip" aria-pressed={kind === null} onClick={() => setKind(null)}>
            Todo {results ? `(${results.length})` : ''}
          </button>
          {(Object.keys(LIBRARY_KINDS) as LibraryKind[]).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>
              {LIBRARY_KINDS[k]} {counts[k] ? `(${counts[k]})` : ''}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {results && visible.length === 0 && (
        <section className="card empty-state fade-in">
          <p>{query ? `No hay nada con «${query}».` : 'Todavía no hay nada guardado.'}</p>
          <p className="muted">Acá van a aparecer los resúmenes que genere Claude, tus lecturas, las palabras que guardes y tu diario.</p>
        </section>
      )}
      {visible.length > 0 && (
        <section className="card stack fade-in">
          <ul className="library-list">
            {visible.map((item) => (
              <li key={item.id} className={open === item.id ? 'open' : undefined}>
                <button type="button" className="library-item" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
                  <span className="badge">{LIBRARY_KINDS[item.kind]}</span>
                  <span className="library-title">{item.title}</span>
                  <span className="muted small">{formatDayMonth(item.date)}</span>
                </button>
                {open === item.id ? (
                  <div className="library-body">
                    {item.markdown ? <Markdown markdown={item.text} /> : <p className="multiline">{item.text}</p>}
                  </div>
                ) : (
                  item.snippet && <p className="muted small library-snippet">{item.snippet}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
