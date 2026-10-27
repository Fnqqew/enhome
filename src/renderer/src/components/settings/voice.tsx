// Ajustes → Voz: lectura en voz alta y modelo de pronunciación.

import { useEffect, useState } from 'react'
import { LANGUAGES } from '@shared/languages'
import { VOICE_SETTING } from '@shared/settings'
import { hasVoiceFor, pickVoice, speechTag, type SpeechLang } from '@shared/speech'
import { INSTALL_VOICE_HELP } from '../summaries/SpeechControls'
import { useNeuralVoices, useSpeech, useVoices } from '../../hooks/useSpeech'
import { voiceSizeMb, type VoiceStatus } from '@shared/voice'
import Segmented from '../Segmented'
import { useSettings } from '../../theme/SettingsProvider'
import { Row } from './common'
import { autoModel } from '../../speech/useTranscriber'

const VOICE_SAMPLES: Partial<Record<SpeechLang, string>> & { en: string } = {
  es: 'Hola, así suena la voz en español.',
  en: 'Hello, this is how the English voice sounds.',
  pt: 'Olá, é assim que soa a voz em português.',
  it: 'Ciao, così suona la voce in italiano.',
  fr: 'Bonjour, voici la voix en français.',
  de: 'Hallo, so klingt die Stimme auf Deutsch.',
  ru: 'Привет, так звучит голос на русском.',
  ja: 'こんにちは、これが日本語の声です。',
  zh: '你好，这是中文的声音。',
  ko: '안녕하세요, 한국어 목소리입니다.'
}

const VOICE_LANGS: { lang: SpeechLang; label: string }[] = [
  { lang: 'es', label: 'Español' },
  ...LANGUAGES.map((l) => ({ lang: l.id, label: l.label }))
]

// Las voces incluidas (neuronales, sin conexión): se bajan una vez y suenan igual en cualquier compu.
export function NeuralVoiceSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const statuses = useNeuralVoices()
  const speech = useSpeech()
  const [error, setError] = useState<string | null>(null)
  const course = LANGUAGES.find((l) => l.id === settings.language)!
  const groups: { lang: SpeechLang; title: string; list: VoiceStatus[] }[] = [
    { lang: settings.language, title: `Voces de ${course.name}`, list: statuses.filter((s) => !s.voice.id.startsWith('es_')) },
    { lang: 'es', title: 'Voz de las explicaciones en español', list: statuses.filter((s) => s.voice.id.startsWith('es_')) }
  ]
  const chosen = (lang: string, list: VoiceStatus[]): string => settings.neuralVoices[lang] ?? list[0]?.voice.id ?? ''
  const act = (action: Promise<unknown>): void => {
    setError(null)
    action.catch((err: Error) => setError(err.message))
  }

  return (
    <section className="card stack">
      <h2>Voces incluidas</h2>
      <p className="muted">
        Voces neuronales que funcionan sin conexión y suenan igual en cualquier compu. La del curso se baja sola la primera vez que lo abrís; la
        segunda (de otro género) hace de interlocutor en los diálogos y se baja cuando hace falta.
      </p>
      <Row label="Leer con">
        <Segmented
          label="Leer con"
          value={settings.speechEngine}
          options={[
            { value: 'neural', label: 'Voces incluidas' },
            { value: 'system', label: 'Voces de Windows' }
          ]}
          onChange={(value) => update({ speechEngine: value as 'neural' | 'system' })}
        />
      </Row>
      {settings.speechEngine === 'neural' &&
        groups.map(({ lang, title, list }) => (
          <div key={lang} className="stack-sm">
            <h3 className="small-title">{title}</h3>
            <ul className="voice-list">
              {list.map(({ voice, installed, progress, error: failed }) => {
                const inUse = chosen(lang, list) === voice.id
                return (
                  <li key={voice.id} className={`voice-item${inUse ? ' in-use' : ''}`}>
                    <div className="stack-sm">
                      <strong>
                        {voice.label} {inUse && <span className="badge ok">en uso</span>}
                      </strong>
                      <span className="muted small">
                        {voice.gender} · {voice.accent} · {voiceSizeMb(voice)} MB
                      </span>
                      {progress !== null && (
                        <div
                          className="voice-progress"
                          role="progressbar"
                          aria-valuenow={Math.round(progress * 100)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span style={{ width: `${Math.round(progress * 100)}%` }} />
                        </div>
                      )}
                      {failed && <span className="error small">{failed}</span>}
                    </div>
                    <div className="row">
                      {!installed && progress === null && (
                        <button type="button" className="btn secondary" onClick={() => act(window.api.installVoice(voice.id))}>
                          Bajar
                        </button>
                      )}
                      {progress !== null && <span className="muted small">{Math.round(progress * 100)} %</span>}
                      {installed && !inUse && (
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => update({ neuralVoices: { ...settings.neuralVoices, [lang]: voice.id } })}
                        >
                          Usar
                        </button>
                      )}
                      {installed && inUse && (
                        <button type="button" className="chip" onClick={() => speech.speakAs(VOICE_SAMPLES[lang] ?? VOICE_SAMPLES.en, lang)}>
                          Probar
                        </button>
                      )}
                      {installed && !inUse && (
                        <button type="button" className="chip" onClick={() => act(window.api.removeVoice(voice.id))}>
                          Borrar
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      {error && <p className="error small">{error}</p>}
    </section>
  )
}

export function VoiceSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const voices = useVoices()
  const missing = VOICE_LANGS.filter(({ lang }) => !hasVoiceFor(voices, lang))

  const test = (lang: SpeechLang): void => {
    const voice = pickVoice(voices, lang, settings[VOICE_SETTING[lang]])
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(VOICE_SAMPLES[lang] ?? VOICE_SAMPLES.en)
    utterance.lang = voice?.lang ?? speechTag(lang)
    if (voice) utterance.voice = voice
    speechSynthesis.speak(utterance)
  }

  return (
    <section className="card stack">
      <h2>Voces de Windows</h2>
      <p className="muted">
        Se usan cuando elegís «Voces de Windows» o mientras la voz incluida del idioma todavía se está bajando. Al escuchar un resumen, las partes en
        español se leen con una voz y las del idioma que estudiás con otra.
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

// El reconocimiento de voz (pronunciación, shadowing y respuestas habladas): qué modelo y cuánto ocupa.
export function SpeechModelSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const [size, setSize] = useState<number | null>(null)
  useEffect(() => {
    window.api
      .getModelsSize()
      .then(setSize)
      .catch(() => setSize(0))
  }, [])
  const automatic = autoModel()
  return (
    <section className="card stack">
      <h2>Reconocimiento de voz</h2>
      <p className="muted">
        Corre en tu compu, sin conexión. El modelo se baja la primera vez que hacés un ejercicio de habla. El chico (unos 80 MB) anda bien en inglés;
        el grande (unos 250 MB) entiende mucho mejor los demás idiomas, pero tarda más.
      </p>
      <Row label="Modelo">
        <Segmented
          label="Modelo de reconocimiento"
          value={settings.asrModel}
          options={[
            { value: 'auto', label: `Según la compu (${automatic === 'small' ? 'grande' : 'chico'})` },
            { value: 'base', label: 'Chico' },
            { value: 'small', label: 'Grande' }
          ]}
          onChange={(value) => update({ asrModel: value as 'auto' | 'base' | 'small' })}
        />
      </Row>
      {!!size && (
        <Row label={`Descargado · ${Math.round(size / 1_000_000)} MB`}>
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
      )}
    </section>
  )
}
