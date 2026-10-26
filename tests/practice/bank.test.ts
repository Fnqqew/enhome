import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { CourseBanks, readBank } from '../../src/main/content/bank'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { openDatabase, type Db } from '../../src/main/db/database'
import { bankedGenerator, ExerciseBank } from '../../src/main/practice/bank'
import type { CurriculumTopic } from '../../src/shared/curriculum'
import type { GeneratedExercise, StoredExercise } from '../../src/shared/exercises'
import { fakeClaude, generatedSample } from '../helpers/exercises'

const CONTENT = join(__dirname, '..', '..', 'content')
const topic: CurriculumTopic = loadCurriculum(CONTENT, 'en')[0]
const subtopic = topic.subtopics[0]

// Un temario de mentira con un banco: 3 opción múltiple y 2 completar para el primer subtema.
function contentWithBank(exercises: GeneratedExercise[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'enhome-banco-'))
  const topicDir = join(dir, 'en', topic.level, '01-prueba')
  mkdirSync(topicDir, { recursive: true })
  writeFileSync(join(topicDir, 'topic.json'), JSON.stringify({ id: topic.id }))
  writeFileSync(join(topicDir, 'banco.json'), JSON.stringify({ subtopics: { [subtopic.id]: exercises } }))
  return dir
}

const bankExercises: GeneratedExercise[] = [
  generatedSample('multiple_choice', 'A'),
  generatedSample('multiple_choice', 'B'),
  generatedSample('multiple_choice', 'C'),
  generatedSample('fill_blank', 'D'),
  generatedSample('fill_blank', 'E')
]

describe('banco de ejercicios', () => {
  let db: Db
  let bank: ExerciseBank

  beforeEach(() => {
    db = openDatabase(':memory:')
    bank = new ExerciseBank(db, new CourseBanks(contentWithBank(bankExercises), 'en'))
  })

  const markSeen = (e: GeneratedExercise): void => {
    db.prepare('INSERT INTO exercises (topic_id, subtopic_id, skill, type, payload) VALUES (?, ?, ?, ?, ?)').run(
      topic.id,
      subtopic.id,
      'grammar',
      e.type,
      JSON.stringify(e)
    )
  }

  it('lee el banco del tópico y descarta lo que no sirve', () => {
    const broken = { ...generatedSample('fill_blank', 'X'), sentence: 'Sin hueco.' }
    const dir = contentWithBank([...bankExercises, broken])
    const loaded = readBank(join(dir, 'en', topic.level, '01-prueba', 'banco.json'), topic)
    expect(loaded.subtopics.get(subtopic.id)).toHaveLength(5)
    expect(loaded.problems).toHaveLength(1)
  })

  it('da primero los que el alumno no vio', () => {
    markSeen(bankExercises[0])
    markSeen(bankExercises[1])
    const { taken, missing } = bank.take(topic, subtopic.id, { multiple_choice: 1 }, [])
    expect(taken).toEqual([bankExercises[2]])
    expect(missing).toEqual({})
  })

  it('si no alcanza, repite lo visto (salvo lo más reciente) y avisa lo que falta', () => {
    for (const e of bankExercises) markSeen(e)
    const recent = [bankExercises[0].type === 'multiple_choice' ? (bankExercises[0] as { prompt: string }).prompt : '']
    const { taken, missing } = bank.take(topic, subtopic.id, { multiple_choice: 3, translation: 2 }, recent)
    expect(taken).toHaveLength(2)
    expect(taken).not.toContainEqual(bankExercises[0])
    expect(missing).toEqual({ multiple_choice: 1, translation: 2 })
  })

  it('suma al banco lo que genera la app', () => {
    expect(bank.unused(topic, subtopic.id)).toBe(5)
    bank.add(topic.id, subtopic.id, [generatedSample('translation', 'F')], '2026-10-26')
    expect(bank.unused(topic, subtopic.id)).toBe(6)
  })

  it('la práctica arranca con el banco al instante y pide a Claude solo lo largo y lo que falta', async () => {
    const { ask, prompts } = fakeClaude([{ exercises: [generatedSample('translation', 'G')] }, { exercises: [generatedSample('dialogue', 'H')] }])
    const groups: StoredExercise[][] = []
    const all = await bankedGenerator(
      bank,
      ask
    )({
      topic,
      subtopic,
      kind: 'lesson',
      counts: { multiple_choice: 2, translation: 1, dialogue: 1 },
      avoid: [],
      onGroup: (group) => groups.push(group)
    })
    // Primero llegan los del banco, sin esperar a Claude.
    expect(groups[0].map((e) => e.type)).toEqual(['multiple_choice', 'multiple_choice'])
    expect(all.map((e) => e.type).sort()).toEqual(['dialogue', 'multiple_choice', 'multiple_choice', 'translation'])
    // Un pedido para la traducción que faltaba y otro para la conversación, cada uno con solo su formato.
    expect(prompts).toHaveLength(2)
    expect(prompts.some((p) => p.includes('- translation:') && !p.includes('- dialogue:'))).toBe(true)
  })
})
