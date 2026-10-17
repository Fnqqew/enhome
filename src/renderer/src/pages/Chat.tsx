import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_CHAT_MESSAGE, type ChatMessage, type ChatSuggestion, type ChatSummary, type ChatView } from '@shared/chat'
import { formatDayMonth } from '@shared/dates'
import ClaudeWait from '../components/ClaudeWait'
import Icon from '../components/Icon'
import SelectionAsk from '../components/summaries/SelectionAsk'
import { useCourse } from '../hooks/useCourse'
import { useSpeech } from '../hooks/useSpeech'

// Charla con Claude: conversación libre en el idioma del curso, con la corrección de cada mensaje al costado.
export default function Chat(): React.JSX.Element {
  const course = useCourse()
  const [chats, setChats] = useState<ChatSummary[] | null>(null)
  const [suggestions, setSuggestions] = useState<ChatSuggestion[]>([])
  const [chat, setChat] = useState<ChatView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    window.api
      .getChats()
      .then(({ chats, suggestions }) => {
        setChats(chats)
        setSuggestions(suggestions)
      })
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  const run = (action: () => Promise<ChatView>): void => {
    setBusy(true)
    setError(null)
    action()
      .then(setChat)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false))
  }

  if (chat) {
    return (
      <Conversation
        chat={chat}
        busy={busy}
        error={error}
        onSend={(text) => run(() => window.api.sendChat(chat.id, text))}
        onBack={() => {
          setChat(null)
          load()
        }}
      />
    )
  }

  return (
    <>
      <h1>Charla</h1>
      <section className="card stack fade-in">
        <div>
          <span className="level">CHARLA NUEVA</span>
          <h2>Practicá {course.name} conversando</h2>
        </div>
        <p className="muted">
          Elegí una situación y charlá con Claude como con una persona. Cada mensaje tuyo aparece corregido al costado, con la explicación,
          sin cortar la conversación.
        </p>
        <div className="suggestions">
          {suggestions.map((s) => (
            <button key={s.title} type="button" className="suggestion" disabled={busy} title={s.scenario} onClick={() => run(() => window.api.startChat(s))}>
              <strong>{s.title}</strong>
              <span className="muted small">{s.scenario}</span>
            </button>
          ))}
        </div>
        {busy && <p className="muted small">Claude está empezando la charla…</p>}
        <ClaudeWait active={busy} />
        {error && <p className="error multiline">{error}</p>}
      </section>

      {chats && chats.length > 0 && (
        <section className="card stack fade-in">
          <h2>Tus charlas</h2>
          <ul className="reading-list">
            {chats.map((c) => (
              <li key={c.id} className="row">
                <button
                  type="button"
                  className="reading-item"
                  onClick={() =>
                    window.api
                      .getChat(c.id)
                      .then(setChat)
                      .catch((err: Error) => setError(err.message))
                  }
                >
                  <span className="reading-title">{c.title}</span>
                  <span className="muted small">
                    {formatDayMonth(c.createdOn)} · {c.messages} mensajes
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Borrar la charla «${c.title}»`}
                  onClick={() =>
                    window.api
                      .removeChat(c.id)
                      .then(setChats)
                      .catch((err: Error) => setError(err.message))
                  }
                >
                  <Icon name="cross" className="glyph" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function Conversation({
  chat,
  busy,
  error,
  onSend,
  onBack
}: {
  chat: ChatView
  busy: boolean
  error: string | null
  onSend: (text: string) => void
  onBack: () => void
}): React.JSX.Element {
  const speech = useSpeech()
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const pending = useRef('')

  // Cada mensaje nuevo baja al final; al terminar, se limpia lo que se mandó.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    if (!busy && pending.current) {
      if (chat.messages.some((m) => m.role === 'user' && m.text === pending.current)) setText('')
      pending.current = ''
    }
  }, [chat.messages.length, busy, chat.messages])

  const send = (): void => {
    const value = text.trim()
    if (!value || busy) return
    pending.current = value
    onSend(value)
  }

  return (
    <>
      <div className="row spread">
        <h1>{chat.title}</h1>
        <button className="btn secondary" onClick={onBack}>
          Volver
        </button>
      </div>
      <section className="card stack chat-card">
        <p className="muted small">{chat.scenario}</p>
        <div ref={listRef} className="chat-list" aria-live="polite">
          {chat.messages.map((m) => (
            <Bubble key={m.id} message={m} onListen={() => speech.speakAs(m.text)} />
          ))}
          {busy && <div className="bubble assistant typing" aria-label="Claude está escribiendo"><span /><span /><span /></div>}
        </div>
        <SelectionAsk containerRef={listRef} topicId="" />
        {error && <p className="error multiline">{error}</p>}
        <ClaudeWait active={busy} />
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <textarea
            className="text-answer en"
            rows={2}
            value={text}
            maxLength={MAX_CHAT_MESSAGE}
            placeholder="Escribí tu respuesta (Enter manda, Shift+Enter baja de línea)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button className="btn" type="submit" disabled={busy || !text.trim()}>
            Mandar
          </button>
        </form>
      </section>
    </>
  )
}

function Bubble({ message, onListen }: { message: ChatMessage; onListen: () => void }): React.JSX.Element {
  if (message.role === 'assistant') {
    return (
      <div className="chat-row assistant">
        <div className="bubble assistant en">
          {message.text}
          <button type="button" className="icon-button listen" aria-label="Escuchar" onClick={onListen}>
            <Icon name="play" className="glyph" />
          </button>
        </div>
      </div>
    )
  }
  const correction = message.correction
  return (
    <div className="chat-row user">
      <div className="bubble user en">{message.text}</div>
      {correction && (
        <aside className={`chat-correction${correction.ok ? ' ok' : ''}`}>
          {correction.ok ? (
            <span>
              <Icon name="check" className="glyph" /> Bien dicho
            </span>
          ) : (
            <>
              <span className="en">{correction.corrected}</span>
              {correction.notes.length > 0 && (
                <ul>
                  {correction.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  )
}
