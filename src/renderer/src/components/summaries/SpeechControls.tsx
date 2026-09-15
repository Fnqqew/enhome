import { useSpeech } from '../../hooks/useSpeech'

const RATES = [0.8, 1, 1.2]

export const INSTALL_VOICE_HELP =
  'Para agregar una: Configuración de Windows → Hora e idioma → Voz → Administrar voces → Agregar voces. Después reiniciá la app.'

export default function SpeechControls({ getText }: { getText: () => string }): React.JSX.Element {
  const speech = useSpeech()

  if (!speech.supported) {
    return <p className="muted small">La lectura en voz alta no está disponible: Windows no tiene voces instaladas. {INSTALL_VOICE_HELP}</p>
  }

  return (
    <div className="stack-sm">
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
      </div>
      {!speech.hasSpanish && (
        <p className="warn-text small">Windows no tiene una voz en español: el texto en español se va a leer con pronunciación inglesa. {INSTALL_VOICE_HELP}</p>
      )}
      {!speech.hasEnglish && <p className="warn-text small">Windows no tiene una voz en inglés: los ejemplos se van a leer con otra voz. {INSTALL_VOICE_HELP}</p>}
    </div>
  )
}
