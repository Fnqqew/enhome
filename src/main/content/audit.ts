// Revisión de todo el contenido de un idioma (npm run content:check): lo que el esquema no ve,
// como textos del idioma escritos con signos del español o ejemplos sin traducir, y un resumen
// de cuánto contenido hay en cada nivel.

import { DIFFICULTIES } from '../../shared/difficulty'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CEFR_LEVELS, type CurriculumTopic } from '../../shared/curriculum'
import { languageInfo, type LanguageId } from '../../shared/languages'
import { bankPath, readBank } from './bank'
import { loadCurriculum } from './curriculum'
import { loadPlacementBank } from './placement-bank'

export interface LevelStats {
  level: string
  topics: number
  // Ejemplos y errores típicos por subtema (mínimo y promedio).
  examplesMin: number
  examplesAvg: number
  mistakesAvg: number
  // Preguntas del banco del examen inicial para los tópicos de ese nivel.
  placement: number
  // Ejercicios en los bancos de práctica (banco.json) y tópicos que todavía no tienen banco.
  bank: number
  withoutBank: number
}

export interface AuditReport {
  language: LanguageId
  errors: string[]
  warnings: string[]
  levels: LevelStats[]
}

// Signos y letras que existen en español pero en ningún otro idioma del curso: si aparecen en un
// texto del idioma, se escribió en español (o se mezcló).
const SPANISH_ONLY = /[¿¡ñÑ]/

const round1 = (n: number): number => Math.round(n * 10) / 10

function targetTexts(topic: CurriculumTopic): { where: string; text: string }[] {
  return topic.subtopics.flatMap((s) => [
    ...s.examples.map((e, i) => ({ where: `${topic.id}/${s.id} ejemplo ${i + 1}`, text: e.target })),
    ...s.commonMistakes.flatMap((m, i) => [
      { where: `${topic.id}/${s.id} error ${i + 1} (mal)`, text: m.wrong },
      { where: `${topic.id}/${s.id} error ${i + 1} (bien)`, text: m.right }
    ])
  ])
}

export function auditContent(contentDir: string, language: LanguageId): AuditReport {
  const errors: string[] = []
  const warnings: string[] = []
  let curriculum: CurriculumTopic[] = []
  try {
    curriculum = loadCurriculum(contentDir, language)
  } catch (err) {
    return { language, errors: [err instanceof Error ? err.message : String(err)], warnings, levels: [] }
  }

  for (const topic of curriculum) {
    for (const { where, text } of targetTexts(topic)) {
      if (SPANISH_ONLY.test(text)) errors.push(`${where}: el texto en ${languageInfo(language).name} tiene signos del español: «${text}»`)
    }
    for (const sub of topic.subtopics) {
      for (const example of sub.examples) {
        if (example.target.trim().toLowerCase() === example.es.trim().toLowerCase()) {
          errors.push(`${topic.id}/${sub.id}: el ejemplo «${example.target}» no está traducido`)
        }
      }
      const seen = new Set<string>()
      for (const example of sub.examples) {
        const key = example.target.trim().toLowerCase()
        if (seen.has(key)) warnings.push(`${topic.id}/${sub.id}: el ejemplo «${example.target}» está repetido`)
        seen.add(key)
      }
      if (sub.commonMistakes.length === 0) warnings.push(`${topic.id}/${sub.id}: no tiene errores típicos`)
    }
  }

  // Bancos de práctica: lo que no pasa el formato o los controles es un error del contenido.
  const bankSizes = new Map<string, number>()
  for (const topic of curriculum) {
    let size = 0
    for (const difficulty of DIFFICULTIES) {
      const bank = readBank(bankPath(contentDir, language, topic, difficulty), topic)
      errors.push(...bank.problems)
      size += [...bank.subtopics.values()].reduce((sum, list) => sum + list.length, 0)
    }
    bankSizes.set(topic.id, size)
  }

  let placement = new Map<string, unknown[]>()
  if (existsSync(join(contentDir, language, 'placement.json'))) {
    try {
      placement = loadPlacementBank(contentDir, language, curriculum)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  } else {
    warnings.push('No hay banco del examen inicial (placement.json).')
  }

  const levels: LevelStats[] = CEFR_LEVELS.map((level) => {
    const topics = curriculum.filter((t) => t.level === level)
    const subtopics = topics.flatMap((t) => t.subtopics)
    const examples = subtopics.map((s) => s.examples.length)
    return {
      level,
      topics: topics.length,
      examplesMin: examples.length ? Math.min(...examples) : 0,
      examplesAvg: examples.length ? round1(examples.reduce((a, b) => a + b, 0) / examples.length) : 0,
      mistakesAvg: subtopics.length ? round1(subtopics.reduce((a, s) => a + s.commonMistakes.length, 0) / subtopics.length) : 0,
      placement: topics.reduce((sum, t) => sum + (placement.get(t.id)?.length ?? 0), 0),
      bank: topics.reduce((sum, t) => sum + (bankSizes.get(t.id) ?? 0), 0),
      withoutBank: topics.filter((t) => !bankSizes.get(t.id)).length
    }
  }).filter((l) => l.topics > 0)

  return { language, errors, warnings, levels }
}
