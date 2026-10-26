// La práctica con bancos: los ejercicios cortos salen del banco del subtema (al instante y ya revisados)
// y solo los largos se le piden a Claude, de a uno y en paralelo. Cuando a un subtema le quedan pocos
// ejercicios sin usar, se generan más en segundo plano.

import { BANK_LOW_WATER, bankWants, isBankType, splitBankCounts } from '../../shared/bank'
import type { CurriculumTopic } from '../../shared/curriculum'
import { mainText, prepareExercise } from '../../shared/exercise-types'
import type { ExerciseType, GeneratedExercise, StoredExercise } from '../../shared/exercises'
import { shuffled } from '../../shared/shuffle'
import type { Ask } from '../claude/bridge'
import type { CourseBanks } from '../content/bank'
import type { Db } from '../db/database'
import { isLongType } from './composition'
import { generateBankSet, generateLongOnce, generateShortOnce, type PoolGenerator, type PoolRequest } from './generation'

const key = (exercise: GeneratedExercise | StoredExercise): string =>
  mainText(exercise as StoredExercise)
    .trim()
    .toLowerCase()

export class ExerciseBank {
  // Recargas en curso, para no pedir dos veces lo mismo.
  private readonly filling = new Set<string>()

  constructor(
    private readonly db: Db,
    private readonly banks: CourseBanks
  ) {}

  // Todo lo que hay para un subtema: lo del temario más lo que generó la app.
  all(topic: CurriculumTopic, subtopicId: string): GeneratedExercise[] {
    const shipped = this.banks.forTopic(topic).subtopics.get(subtopicId) ?? []
    const extra = (
      this.db
        .prepare('SELECT payload FROM bank_exercises WHERE topic_id = ? AND subtopic_id = ? ORDER BY id')
        .all(topic.id, subtopicId) as unknown as {
        payload: string
      }[]
    ).map((r) => JSON.parse(r.payload) as GeneratedExercise)
    return [...shipped, ...extra]
  }

  // Los que el alumno ya vio en este subtema (en cualquier práctica).
  seen(topicId: string, subtopicId: string): Set<string> {
    const rows = this.db.prepare('SELECT payload FROM exercises WHERE topic_id = ? AND subtopic_id = ?').all(topicId, subtopicId) as unknown as {
      payload: string
    }[]
    return new Set(rows.map((r) => key(JSON.parse(r.payload) as StoredExercise)))
  }

  unused(topic: CurriculumTopic, subtopicId: string): number {
    const seen = this.seen(topic.id, subtopicId)
    return this.all(topic, subtopicId).filter((e) => !seen.has(key(e))).length
  }

  // Elige del banco lo pedido: primero lo que no vio y, si no alcanza, repite lo más viejo (repasar
  // también sirve). Devuelve lo que no hubo de ningún modo.
  take(
    topic: CurriculumTopic,
    subtopicId: string,
    counts: Partial<Record<ExerciseType, number>>,
    avoid: string[],
    random: () => number = Math.random
  ): { taken: GeneratedExercise[]; missing: Partial<Record<ExerciseType, number>> } {
    const seen = this.seen(topic.id, subtopicId)
    const recent = new Set(avoid.map((a) => a.trim().toLowerCase()))
    const pool = this.all(topic, subtopicId)
    const taken: GeneratedExercise[] = []
    const missing: Partial<Record<ExerciseType, number>> = {}
    for (const [type, count] of Object.entries(counts) as [ExerciseType, number][]) {
      const ofType = pool.filter((e) => e.type === type)
      const fresh = shuffled(
        ofType.filter((e) => !seen.has(key(e))),
        random
      )
      const repeat = shuffled(
        ofType.filter((e) => seen.has(key(e)) && !recent.has(key(e))),
        random
      )
      const chosen = [...fresh, ...repeat].slice(0, count)
      taken.push(...chosen)
      if (chosen.length < count) missing[type] = count - chosen.length
    }
    return { taken, missing }
  }

  // Un ejercicio de alguno de estos formatos (el primero que haya, en orden al azar), preferentemente
  // uno que el alumno no vio.
  pick(topic: CurriculumTopic, subtopicId: string, types: ExerciseType[], random: () => number = Math.random): GeneratedExercise | null {
    for (const type of shuffled(types, random)) {
      const { taken } = this.take(topic, subtopicId, { [type]: 1 }, [], random)
      if (taken[0]) return taken[0]
    }
    return null
  }

  add(topicId: string, subtopicId: string, exercises: GeneratedExercise[], today: string): void {
    const insert = this.db.prepare('INSERT INTO bank_exercises (topic_id, subtopic_id, type, payload, created_on) VALUES (?, ?, ?, ?, ?)')
    for (const e of exercises) insert.run(topicId, subtopicId, e.type, JSON.stringify(e), today)
  }

  // Si al subtema le quedan pocos ejercicios sin usar, pide más en segundo plano (generados y revisados).
  topUp(request: Omit<PoolRequest, 'counts' | 'avoid'>, today: string, ask?: Ask): Promise<void> | null {
    const { topic, subtopic } = request
    const id = `${topic.id}/${subtopic.id}`
    if (this.filling.has(id) || this.unused(topic, subtopic.id) >= BANK_LOW_WATER) return null
    this.filling.add(id)
    const seen = [...this.seen(topic.id, subtopic.id)].slice(-40)
    const parts = splitBankCounts(bankWants(subtopic, topic.level)).map((counts) =>
      generateBankSet({ ...request, counts, avoid: seen, ticket: { priority: 'background' } }, counts, ask)
        .then((exercises) => this.add(topic.id, subtopic.id, exercises, today))
        .catch((err) => console.error(`[banco] No se pudo sumar ejercicios a ${id}`, err))
    )
    return Promise.all(parts)
      .then(() => undefined)
      .finally(() => this.filling.delete(id))
  }
}

// Los formatos que se mezclan de tópicos anteriores: los que piden recordar la respuesta.
export const MIX_TYPES: ExerciseType[] = ['fill_blank', 'error_correction', 'transformation', 'translation', 'multiple_choice']

// El generador de la práctica: cortos del banco (y de Claude lo que falte) y cada largo en su pedido.
export function bankedGenerator(bank: ExerciseBank, ask?: Ask): PoolGenerator {
  return async (request) => {
    const entries = Object.entries(request.counts) as [ExerciseType, number][]
    const shortCounts = Object.fromEntries(entries.filter(([type]) => !isLongType(type)))
    const longTypes = entries.filter(([type]) => isLongType(type)).flatMap(([type, count]) => Array.from({ length: count }, () => type))

    const { taken, missing } = bank.take(request.topic, request.subtopic.id, shortCounts, request.avoid)
    const fromBank = taken.flatMap((e) => {
      try {
        return [prepareExercise(e)]
      } catch {
        return []
      }
    })
    if (fromBank.length > 0) request.onGroup?.(fromBank)

    // Lo que el banco no tenía (por ejemplo, un tópico sin banco todavía) se pide en una sola pasada.
    const missingShort = Object.keys(missing).length > 0 ? generateShortOnce(request, missing, ask) : Promise.resolve([])
    const longs = longTypes.map((type) =>
      generateLongOnce(request, type, ask).then((exercise) => {
        request.onGroup?.([exercise])
        return exercise
      })
    )
    const results = await Promise.allSettled([
      missingShort.then((exercises) => {
        if (exercises.length > 0) request.onGroup?.(exercises)
        return exercises
      }),
      ...longs.map((p) => p.then((e) => [e]))
    ])
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    const done = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    if (failed) throw failed.reason
    return [...fromBank, ...done]
  }
}

export { isBankType }
