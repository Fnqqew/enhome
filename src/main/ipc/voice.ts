// La voz: qué voces neuronales hay para el idioma del curso, bajarlas y generar el audio de un texto.

import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { z } from 'zod'
import { loadSettings } from '../db/settings-repo'
import { VoiceEngine, VoiceError } from '../voice/engine'
import { VoiceStore } from '../voice/store'
import { IPC } from '../../shared/ipc'
import { languageInfo, LANGUAGE_IDS, type LanguageId } from '../../shared/languages'
import { SPANISH_VOICE, type Voice, type VoiceRole, type VoiceStatus } from '../../shared/voice'
import { handle, type IpcContext } from './context'

export interface VoiceService {
  // Baja en segundo plano la voz principal del curso si todavía no está (al abrir la app o cambiar de idioma).
  ensure: (language: LanguageId) => void
  stop: () => void
}

export function registerVoice(ctx: IpcContext): VoiceService {
  const notify = (): void => BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.voiceChanged)
  const store = new VoiceStore(join(app.getPath('userData'), 'voces'), notify)
  const engine = new VoiceEngine(store, join(app.getPath('userData'), 'audio'), join(__dirname, 'voiceWorker.js'))

  const voicesOf = (lang: string): Voice[] => (lang === 'es' ? [SPANISH_VOICE] : languageInfo(lang as LanguageId).voices)
  const allVoices = (): Voice[] => [...LANGUAGE_IDS.flatMap((id) => languageInfo(id).voices), SPANISH_VOICE]
  const byId = (id: string): Voice => {
    const voice = allVoices().find((v) => v.id === id)
    if (!voice) throw new Error('Esa voz no existe.')
    return voice
  }

  // La voz para un idioma y un papel: la elegida (o la primera) y, para el otro personaje, la de otro género.
  const pick = (lang: string, role: VoiceRole): Voice | null => {
    const voices = voicesOf(lang)
    const chosen = voices.find((v) => v.id === loadSettings(ctx.db).neuralVoices[lang]) ?? voices[0]
    if (role === 'main') return chosen
    return voices.find((v) => v.gender !== chosen.gender && store.installed(v)) ?? voices.find((v) => v.gender !== chosen.gender) ?? chosen
  }

  handle(IPC.voiceList, (): VoiceStatus[] => {
    const lang = ctx.activeLanguage()
    return [...voicesOf(lang), SPANISH_VOICE].map((voice) => ({ voice, ...store.status(voice) }))
  })
  handle(IPC.voiceInstall, (voiceId) => {
    void store.install(byId(z.string().parse(voiceId))).catch((err) => console.error('[voz]', err))
  })
  handle(IPC.voiceRemove, (voiceId) => store.remove(byId(z.string().parse(voiceId))))
  handle(IPC.voiceSpeak, async (text, lang, speed, role) => {
    if (loadSettings(ctx.db).speechEngine !== 'neural') return null
    let voice = pick(z.string().parse(lang), z.enum(['main', 'other']).parse(role))
    if (voice && !store.installed(voice)) {
      // La segunda voz se baja la primera vez que hace falta; mientras tanto habla la principal.
      void store.install(voice).catch(() => undefined)
      voice = pick(String(lang), 'main')
    }
    if (!voice || !store.installed(voice)) return null
    try {
      return new Uint8Array(await engine.speak(voice, z.string().max(4000).parse(text), z.number().min(0.5).max(2).parse(speed)))
    } catch (err) {
      // Sin la voz neural, la interfaz lee con la de Windows.
      if (err instanceof VoiceError) {
        console.error('[voz]', err.message)
        return null
      }
      throw err
    }
  })
  handle(IPC.voicePrefetch, (texts, lang, role) => {
    const voice = pick(z.string().parse(lang), z.enum(['main', 'other']).parse(role))
    if (voice) engine.prefetch(voice, z.array(z.string().max(4000)).max(200).parse(texts))
  })

  return {
    ensure: (language) => {
      // Las pruebas de interfaz (con datos aparte) no bajan voces.
      if (process.env.ENHOME_DATA_DIR || loadSettings(ctx.db).speechEngine !== 'neural') return
      const voice = pick(language, 'main')
      if (!voice) return
      if (store.installed(voice)) engine.warm(voice)
      else
        void store
          .install(voice)
          .then(() => engine.warm(voice))
          .catch((err) => console.error('[voz] No se pudo bajar la voz', err))
    },
    stop: () => engine.stop()
  }
}
