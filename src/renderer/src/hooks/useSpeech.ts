import { useCallback, useEffect, useRef, useState } from 'react'
import { hasVoiceFor, pickVoice, splitForSpeech, type SpeechLang } from '@shared/speech'
import { useSettings } from '../theme/SettingsProvider'

export type SpeechState = 'idle' | 'playing' | 'paused'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (supported ? speechSynthesis.getVoices() : []))
  useEffect(() => {
    if (!supported) return
    const update = (): void => setVoices(speechSynthesis.getVoices())
    update()
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

// Lectura en voz alta con las voces del sistema: cada parte en español o en inglés con su voz.
export function useSpeech() {
  const voices = useVoices()
  const { settings } = useSettings()
  const [state, setState] = useState<SpeechState>('idle')
  const [rate, setRate] = useState(1)
  const generation = useRef(0)

  const voiceFor = useCallback(
    (lang: SpeechLang) => pickVoice(voices, lang, lang === 'es' ? settings.voiceEs : settings.voiceEn),
    [voices, settings.voiceEs, settings.voiceEn]
  )

  const stop = useCallback(() => {
    generation.current++
    if (supported) speechSynthesis.cancel()
    setState('idle')
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!supported) return
      speechSynthesis.cancel()
      const run = ++generation.current
      const segments = splitForSpeech(text)
      if (segments.length === 0) return

      segments.forEach((segment, i) => {
        const utterance = new SpeechSynthesisUtterance(segment.text)
        const voice = voiceFor(segment.lang)
        utterance.lang = voice?.lang ?? (segment.lang === 'es' ? 'es-AR' : 'en-US')
        if (voice) utterance.voice = voice
        utterance.rate = rate
        const finish = (): void => {
          if (generation.current === run) setState('idle')
        }
        if (i === segments.length - 1) utterance.onend = finish
        utterance.onerror = finish
        speechSynthesis.speak(utterance)
      })
      setState('playing')
    },
    [voiceFor, rate]
  )

  const pause = useCallback(() => {
    speechSynthesis.pause()
    setState('paused')
  }, [])

  const resume = useCallback(() => {
    speechSynthesis.resume()
    setState('playing')
  }, [])

  useEffect(() => stop, [stop])

  return {
    supported: supported && voices.length > 0,
    hasSpanish: hasVoiceFor(voices, 'es'),
    hasEnglish: hasVoiceFor(voices, 'en'),
    state,
    rate,
    setRate,
    speak,
    pause,
    resume,
    stop
  }
}
