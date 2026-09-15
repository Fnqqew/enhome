import { useSpeech } from '../../hooks/useSpeech'

const RATES = [0.8, 1, 1.2]

export default function SpeechControls({ getText }: { getText: () => string }): React.JSX.Element {
  const speech = useSpeech()

  if (!speech.supported) {
    return <p className="muted small">La lectura en voz alta no está disponible: Windows no tiene voces instaladas.</p>
  }

  return (
    <div className="row speech">
      {speech.state === 'idle' && (
        <button type="button" className="chip" onClick={() => speech.speak(getText())}>
          ▶ Escuchar
        </button>
      )}
      {speech.state === 'playing' && (
        <button type="button" className="chip" onClick={speech.pause}>
          ❚❚ Pausar
        </button>
      )}
      {speech.state === 'paused' && (
        <button type="button" className="chip" onClick={speech.resume}>
          ▶ Seguir
        </button>
      )}
      {speech.state !== 'idle' && (
        <button type="button" className="chip" onClick={speech.stop}>
          ■ Detener
        </button>
      )}
      <select className="rate-select" value={speech.rate} aria-label="Velocidad de lectura" onChange={(e) => speech.setRate(Number(e.target.value))}>
        {RATES.map((r) => (
          <option key={r} value={r}>
            {r}×
          </option>
        ))}
      </select>
      {!speech.hasEnglish && <span className="muted small">No hay una voz en inglés instalada: los ejemplos se leen con otra voz.</span>}
      {!speech.hasSpanish && <span className="muted small">No hay una voz en español instalada.</span>}
    </div>
  )
}
