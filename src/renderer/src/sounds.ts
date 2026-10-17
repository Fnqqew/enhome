// Sonidos opcionales (apagados por defecto): se sintetizan con Web Audio, sin archivos.

export type Sound = 'correct' | 'wrong' | 'achievement' | 'celebrate'

let enabled = false
let context: AudioContext | null = null

export function setSoundsEnabled(value: boolean): void {
  enabled = value
}

// Notas: [frecuencia en Hz, inicio en segundos, duración en segundos].
const MELODIES: Record<Sound, [number, number, number][]> = {
  correct: [
    [660, 0, 0.12],
    [880, 0.09, 0.18]
  ],
  wrong: [[220, 0, 0.22]],
  achievement: [
    [523, 0, 0.12],
    [659, 0.1, 0.12],
    [784, 0.2, 0.26]
  ],
  celebrate: [
    [523, 0, 0.1],
    [659, 0.08, 0.1],
    [784, 0.16, 0.1],
    [1047, 0.24, 0.32]
  ]
}

export function play(sound: Sound): void {
  if (!enabled) return
  try {
    context ??= new AudioContext()
    const now = context.currentTime
    for (const [frequency, start, duration] of MELODIES[sound]) {
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = sound === 'wrong' ? 'triangle' : 'sine'
      osc.frequency.value = frequency
      // Entrada y salida suaves para que no haga clic.
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.12, now + start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration)
      osc.connect(gain).connect(context.destination)
      osc.start(now + start)
      osc.stop(now + start + duration + 0.02)
    }
  } catch {
    // Sin audio disponible, la app sigue igual.
  }
}
