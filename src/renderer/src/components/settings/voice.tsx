// Ajustes → Voz: lectura en voz alta y modelo de pronunciación.

import { useEffect, useState } from 'react'
import { LANGUAGES } from '@shared/languages'
import { VOICE_SETTING } from '@shared/settings'
import { hasVoiceFor, pickVoice, speechTag, type SpeechLang } from '@shared/speech'
import { INSTALL_VOICE_HELP } from '../summaries/SpeechControls'
import { useVoices } from '../../hooks/useSpeech'
import { useSettings } from '../../theme/SettingsProvider'
import { Row } from './common'

const VOICE_SAMPLES: Record<SpeechLang, string> = {
  es: 'Hola, así suena la voz en español.',
  en: 'Hello, this is how the English voice sounds.',
  pt: 'Olá, é assim que soa a voz em português.',
  it: 'Ciao, così suona la voce in italiano.',
  fr: 'Bonjour, voici la voix en français.'
}

const VOICE_LANGS: { lang: SpeechLang; label: string }[] = [
  { lang: 'es', label: 'Español' },
  ...LANGUAGES.map((l) => ({ lang: l.id, label: l.label }))
]

export function VoiceSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const voices = useVoices()
  const missing = VOICE_LANGS.filter(({ lang }) => !hasVoiceFor(voices, lang))

  const test = (lang: SpeechLang): void => {
    const voice = pickVoice(voices, lang, settings[VOICE_SETTING[lang]])
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(VOICE_SAMPLES[lang])
    utterance.lang = voice?.lang ?? speechTag(lang)
    if (voice) utterance.voice = voice
    speechSynthesis.speak(utterance)
  }

  return (
    <section className="card stack">
      <h2>Lectura en voz alta</h2>
      <p className="muted">
        Al escuchar un resumen, las partes en español se leen con una voz y las del idioma que estudiás con otra, para que cada una tenga la
        pronunciación correcta.
      </p>
      {voices.length === 0 ? (
        <p className="warn-text">Windows no tiene voces instaladas. {INSTALL_VOICE_HELP}</p>
      ) : (
        <>
          {VOICE_LANGS.map(({ lang, label }) => {
            const automatic = pickVoice(voices, lang)
            const key = VOICE_SETTING[lang]
            return (
              <Row key={lang} label={`Voz en ${label.toLowerCase()}`}>
                <div className="row">
                  <select id={`voice-${lang}`} value={settings[key] ?? ''} onChange={(e) => update({ [key]: e.target.value || null })}>
                    <option value="">Automática{automatic ? ` (${automatic.name})` : ' (no hay)'}</option>
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} · {v.lang}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="chip" onClick={() => test(lang)}>
                    Probar
                  </button>
                </div>
              </Row>
            )
          })}
          {missing.length > 0 && (
            <p className="warn-text small">
              No hay voz instalada para {missing.map((m) => m.label.toLowerCase()).join(', ')}: esas partes se leen con otra pronunciación.{' '}
              {INSTALL_VOICE_HELP}
            </p>
          )}
        </>
      )}
    </section>
  )
}

// El reconocimiento de voz de Pronunciación: cuánto ocupa el modelo descargado y la opción de borrarlo.
export function SpeechModelSettings(): React.JSX.Element | null {
  const [size, setSize] = useState<number | null>(null)
  useEffect(() => {
    window.api
      .getModelsSize()
      .then(setSize)
      .catch(() => setSize(0))
  }, [])
  if (!size) return null
  return (
    <section className="card stack">
      <h2>Reconocimiento de voz</h2>
      <Row label={`Modelo descargado · ${Math.round(size / 1_000_000)} MB`}>
        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            window.api
              .removeModels()
              .then(() => setSize(0))
              .catch(() => undefined)
          }
        >
          Borrar
        </button>
      </Row>
      <p className="muted small">Lo usa el juego Pronunciación. Si lo borrás, se vuelve a bajar la próxima vez que juegues.</p>
    </section>
  )
}
