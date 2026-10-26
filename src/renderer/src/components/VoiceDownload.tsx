import { useNeuralVoices } from '../hooks/useSpeech'

// Mientras se baja una voz (la primera vez que se abre un curso), un aviso chico con el avance.
export default function VoiceDownload(): React.JSX.Element | null {
  const downloading = useNeuralVoices().find((s) => s.progress !== null)
  if (!downloading) return null
  const percent = Math.round((downloading.progress ?? 0) * 100)
  return (
    <div className="voice-download" role="status" title={`Bajando la voz ${downloading.voice.label}: ${percent} %`}>
      <span className="nav-label">
        Bajando la voz {downloading.voice.label} · {percent} %
      </span>
      <span className="voice-progress" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
    </div>
  )
}
