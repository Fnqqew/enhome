// Compara Haiku con Sonnet al corregir traducciones con veredicto conocido (gasta uso de la suscripción).
// Solo corre con LIVE_CLAUDE=1. Sirve para decidir qué modelo usa cada tipo en GRADING_MODEL.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { gradeOpenAnswer } from '../../src/main/practice/ai-grading'
import type { LanguageId } from '../../src/shared/languages'

const CONTENT = join(__dirname, '..', '..', 'content')

interface Case {
  language: LanguageId
  spanish: string
  reference: string
  answer: string
  ok: boolean
}

const CASES: Case[] = [
  { language: 'en', spanish: 'Soy docente.', reference: 'I am a teacher.', answer: 'I am teacher.', ok: false },
  { language: 'en', spanish: 'Soy docente.', reference: 'I am a teacher.', answer: "I'm a teacher", ok: true },
  { language: 'en', spanish: 'Soy docente.', reference: 'I am a teacher.', answer: 'I am a doctor.', ok: false },
  { language: 'en', spanish: 'Ella no está en casa.', reference: "She isn't at home.", answer: "She's not home.", ok: true },
  { language: 'en', spanish: 'Ella no está en casa.', reference: "She isn't at home.", answer: 'She not is at home.', ok: false },
  { language: 'en', spanish: '¿Dónde están tus padres?', reference: 'Where are your parents?', answer: 'Where is your parents?', ok: false },
  { language: 'en', spanish: 'Mis hermanos son altos.', reference: 'My brothers are tall.', answer: 'My siblings are tall', ok: true },
  { language: 'pt', spanish: 'Ella es médica.', reference: 'Ela é médica.', answer: 'Ela está médica.', ok: false },
  { language: 'pt', spanish: 'Ella es médica.', reference: 'Ela é médica.', answer: 'Ela é medica', ok: true },
  { language: 'it', spanish: 'Ayer fui al cine.', reference: 'Ieri sono andato al cinema.', answer: 'Ieri ho andato al cinema.', ok: false },
  { language: 'it', spanish: 'Ayer fui al cine.', reference: 'Ieri sono andato al cinema.', answer: 'Sono andata al cinema ieri', ok: true },
  { language: 'fr', spanish: 'Tengo 20 años.', reference: "J'ai 20 ans.", answer: 'Je suis 20 ans.', ok: false },
  { language: 'fr', spanish: 'Tengo 20 años.', reference: "J'ai 20 ans.", answer: "J'ai vingt ans", ok: true }
]

function request(c: Case) {
  const topic = loadCurriculum(CONTENT, c.language)[0]
  return {
    topic,
    subtopic: topic.subtopics[1],
    exercise: { type: 'translation' as const, instruction: 'Traducí.', spanish: c.spanish, answers: [c.reference], explanation: '—' },
    answers: [c.answer]
  }
}

describe.skipIf(!process.env.LIVE_CLAUDE)('corrección: Haiku contra Sonnet', () => {
  it('compara aciertos y tiempos', async () => {
    const summary: Record<string, { right: number; ms: number }> = { haiku: { right: 0, ms: 0 }, sonnet: { right: 0, ms: 0 } }
    const lines: string[] = []
    for (const model of ['haiku', 'sonnet']) {
      for (const c of CASES) {
        const started = Date.now()
        const feedback = await gradeOpenAnswer(request(c), model)
        const ms = Date.now() - started
        summary[model].ms += ms
        if (feedback.correct === c.ok) summary[model].right++
        else lines.push(`[${model}] falló: «${c.answer}» (esperado ${c.ok ? 'bien' : 'mal'}) → ${feedback.explanation}`)
        lines.push(`[${model}] ${(ms / 1000).toFixed(1)} s «${c.answer}» → ${feedback.correct ? 'bien' : 'mal'}`)
      }
    }
    for (const [model, s] of Object.entries(summary)) {
      lines.push(`${model}: ${s.right}/${CASES.length} aciertos, ${(s.ms / CASES.length / 1000).toFixed(1)} s promedio`)
    }
    // Vitest no siempre muestra la salida de las pruebas que pasan: el informe queda en un archivo.
    const report = process.env.GRADING_REPORT ?? join(__dirname, 'grading-models.txt')
    writeFileSync(report, lines.join('\n'))
    console.log(lines.join('\n'))
    expect(summary.sonnet.right).toBeGreaterThan(0)
  }, 1_200_000)
})
