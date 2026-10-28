import { beforeEach, describe, expect, it } from 'vitest'
import { englishCore } from '../helpers/courses'
import { openDatabase, type Db } from '../../src/main/db/database'
import { Progression } from '../../src/main/engine/progression'
import type { OpenAnswerGrader } from '../../src/main/practice/ai-grading'
import { SESSION_SIZE } from '../../src/main/practice/composition'
import type { PoolGenerator } from '../../src/main/practice/generation'
import { Practice } from '../../src/main/practice/practice'
import { addDays } from '../../src/shared/dates'
import type { ExerciseAnswer, ExerciseType, PracticeView, SessionView, StoredExercise } from '../../src/shared/exercises'
import { emptyAnswer } from '../../src/shared/exercise-types'
import { recordMistake } from '../../src/main/review/notebook'
import { Vocabulary } from '../../src/main/vocab/vocab'
import { generatedSample, rightAnswer, sample } from '../helpers/exercises'

const curriculum = englishCore()

// 14/9/2026 es lunes.
const MON = '2026-09-14'
const day = (offset: number): string => addDays(MON, offset)
// Una práctica de 10 en la que siempre entra la traducción (sin los cortos de escuchar que compiten por su lugar).
const WITH_TRANSLATION = (): { size: number; excluded: ExerciseType[] } => ({
  size: 10,
  excluded: ['dictation', 'minimal_pair', 'listening', 'shadowing']
})

let db: Db
let progression: Progression
let practice: Practice
let generated: string[]
let graded: string[]

const generator: PoolGenerator = async ({ subtopic, counts }) => {
  generated.push(subtopic.id)
  return (Object.entries(counts) as [ExerciseType, number][]).flatMap(([type, count]) => Array.from({ length: count }, (_, i) => sample(type, i)))
}

const grader: OpenAnswerGrader = async ({ exercise, answers }) => {
  graded.push(exercise.type)
  const text = answers.join(' ')
  const correct = text.length > 10
  return { correct, score: correct ? 8 : 3, correctAnswer: 'ref', explanation: '', review: { correctedText: text, comments: 'Bien.', mistakes: [] } }
}

beforeEach(() => {
  db = openDatabase(':memory:')
  progression = new Progression(db, curriculum)
  practice = new Practice(db, curriculum, progression, generator, grader)
  generated = []
  graded = []
  // Examen inicial el domingo: la semana de "El verbo to be" arranca el lunes 14/9.
  progression.applyPlacementResult('a1-to-be', [], day(-1))
})

const session = (view: PracticeView): SessionView => {
  if (view.status !== 'session') throw new Error(`se esperaba una sesión y llegó ${view.status}`)
  return view.session
}

const stored = (exerciseId: number): StoredExercise =>
  JSON.parse((db.prepare('SELECT payload FROM exercises WHERE id = ?').get(exerciseId) as { payload: string }).payload) as StoredExercise

// Responde todo bien y espera las correcciones de Claude (llegan en segundo plano).
async function answerAllRight(s: SessionView, today = MON): Promise<SessionView> {
  for (const e of s.exercises) await practice.answer(e.id, rightAnswer(stored(e.id)))
  await practice.settled()
  return session(practice.getView(today))
}

describe('práctica del día', () => {
  it('muestra la introducción del subtema antes de empezar', () => {
    const view = practice.getView(MON)
    expect(view).toMatchObject({ status: 'ready', purpose: 'unit', unitIndex: 1, subtopicTitle: 'Pronombres personales' })
    if (view.status === 'ready') expect(view.keyPoints.length).toBeGreaterThan(0)
  })

  it('arma una sesión de 6 ejercicios con lectura y genera una sola vez', async () => {
    practice.getView(MON)
    const s = session(await practice.start(MON))
    expect(s.exercises).toHaveLength(SESSION_SIZE)
    expect(s.exercises.map((e) => e.type)).toContain('reading')
    expect(s.spareCount).toBeGreaterThan(0)
    expect(generated.filter((id) => id === 'pronombres-personales')).toHaveLength(1)
    expect(JSON.stringify(s)).not.toContain('correctIndex')
  })

  it('al terminar marca la práctica del día como hecha', async () => {
    const s = await answerAllRight(session(await practice.start(MON)))
    expect(s.canFinish).toBe(true)
    const result = practice.finish(s.id, MON)
    expect(result).toMatchObject({ purpose: 'unit', unitIndex: 1, correct: SESSION_SIZE, total: SESSION_SIZE })

    const week = progression.getState(MON).week!
    expect(week.completedUnits).toBe(1)
    expect(practice.getView(MON)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/martes/) })
  })

  it('una práctica empezada antes de medianoche y terminada después cuenta para el día nuevo', async () => {
    const s = await answerAllRight(session(await practice.start(MON)))
    practice.finish(s.id, day(1))

    const week = progression.getState(day(1)).week!
    expect(week.days[0].status).toBe('missed')
    expect(week.days[1].status).toBe('done')
    expect(week.units[0].completedOn).toBe(day(1))
  })

  it('no deja terminar con ejercicios sin responder', async () => {
    const s = session(await practice.start(MON))
    expect(() => practice.finish(s.id, MON)).toThrow(/sin responder/)
  })

  it('retoma la sesión empezada', async () => {
    const s = session(await practice.start(MON))
    await practice.answer(s.exercises[0].id, rightAnswer(stored(s.exercises[0].id)))
    const again = practice.getView(MON)
    expect(session(again).exercises[0].feedback?.correct).toBe(true)
  })

  it('no acepta responder dos veces ni con otro tipo de respuesta', async () => {
    const s = session(await practice.start(MON))
    const first = s.exercises[0]
    await expect(practice.answer(first.id, { type: 'writing', text: 'hola' })).rejects.toThrow(/no corresponde/)
    await practice.answer(first.id, rightAnswer(stored(first.id)))
    await expect(practice.answer(first.id, rightAnswer(stored(first.id)))).rejects.toThrow(/ya está respondido/)
  })

  it('cambiar de ejercicio usa una alternativa hasta que se acaban', async () => {
    let s = session(await practice.start(MON))
    const spares = s.spareCount
    const originalId = s.exercises[0].id
    s = session(practice.skip(originalId))
    expect(s.spareCount).toBe(spares - 1)
    expect(s.exercises).toHaveLength(SESSION_SIZE)
    expect(s.exercises.map((e) => e.id)).not.toContain(originalId)

    while (s.spareCount > 0) s = session(practice.skip(s.exercises[0].id))
    expect(() => practice.skip(s.exercises[0].id)).toThrow(/alternativos/)
  })

  it('una traducción distinta de la referencia la corrige Claude sin frenar la práctica', async () => {
    practice = new Practice(db, curriculum, progression, generator, grader, WITH_TRANSLATION)
    const s = session(await practice.start(MON))
    const translation = s.exercises.find((e) => e.type === 'translation')!
    const view = session(await practice.answer(translation.id, { type: 'translation', text: 'I work teaching English' }))
    // Queda respondida y corrigiéndose: se puede seguir con el próximo.
    expect(view.exercises.find((e) => e.id === translation.id)).toMatchObject({ grading: true, feedback: null })
    expect(view.canFinish).toBe(false)
    let notified = 0
    practice.onGraded = () => notified++
    await practice.settled()
    expect(graded).toEqual(['translation'])
    expect(notified).toBe(1)
    const after = session(practice.getView(MON))
    expect(after.exercises.find((e) => e.id === translation.id)).toMatchObject({ grading: false, feedback: { review: { comments: 'Bien.' } } })
  })

  it('si la corrección de Claude falla, se puede reintentar sin volver a responder', async () => {
    let fail = true
    practice = new Practice(
      db,
      curriculum,
      progression,
      generator,
      async (request) => {
        if (fail) throw new Error('Claude saturado')
        return grader(request)
      },
      WITH_TRANSLATION
    )
    const s = session(await practice.start(MON))
    const translation = s.exercises.find((e) => e.type === 'translation')!
    await practice.answer(translation.id, { type: 'translation', text: 'I work teaching English' })
    await practice.settled()
    expect(session(practice.getView(MON)).exercises.find((e) => e.id === translation.id)).toMatchObject({
      grading: false,
      gradingError: 'Claude saturado'
    })
    fail = false
    practice.regrade(translation.id, MON)
    await practice.settled()
    expect(session(practice.getView(MON)).exercises.find((e) => e.id === translation.id)?.feedback?.correct).toBe(true)
  })

  it('guarda la calificación del alumno solo después de responder', async () => {
    const s = session(await practice.start(MON))
    const first = s.exercises[0]
    expect(() => practice.rate(first.id, 5)).toThrow(/Primero/)
    await practice.answer(first.id, rightAnswer(stored(first.id)))
    expect(session(practice.rate(first.id, 5)).exercises[0].rating).toBe(5)
  })
})

describe('escritura y recuperación', () => {
  // Completa los días 1 a 4 sin faltar y deja el viernes para el subtema de escritura.
  function completeUntilThursday(): void {
    for (let i = 0; i < 4; i++) progression.completeUnit(progression.getState(day(i)).week!.nextUnit!.id, day(i))
  }

  it('el día de escritura incluye un texto que corrige Claude', async () => {
    completeUntilThursday()
    const s = session(await practice.start(day(4)))
    expect(s.exercises[s.exercises.length - 1].type).toBe('writing')
    await answerAllRight(s, day(4))
    expect(graded).toContain('writing')
  })

  it('el domingo con una falta se recupera con una sesión de repaso', async () => {
    // Faltó el lunes y se puso al día el martes.
    progression.completeUnit(progression.getState(day(1)).week!.nextUnit!.id, day(1))
    progression.completeUnit(progression.getState(day(1)).week!.nextUnit!.id, day(1))
    for (let i = 2; i <= 4; i++) progression.completeUnit(progression.getState(day(i)).week!.nextUnit!.id, day(i))

    expect(practice.getView(day(6))).toMatchObject({ status: 'ready', purpose: 'recovery', kind: 'review', subtopicTitle: 'Pronombres personales' })
    const s = session(await practice.start(day(6)))
    for (const e of s.exercises) await practice.answer(e.id, rightAnswer(stored(e.id)))
    await practice.settled()
    expect(practice.finish(s.id, day(6)).purpose).toBe('recovery')
    expect(progression.getState(day(6)).week?.recovered).toBe(true)
  })
})

describe('práctica larga', () => {
  it('siempre trae una tanda de traducción y una conversación o situación', async () => {
    const view = session(await practice.start(MON))
    expect(view.exercises).toHaveLength(SESSION_SIZE)
    const types = view.exercises.map((e) => e.type)
    expect(types).toContain('translation_set')
    expect(types.filter((t) => t === 'dialogue' || t === 'roleplay')).toHaveLength(1)
  })

  it('al cambiar la conversación la reemplaza por la situación, y al revés', async () => {
    const view = session(await practice.start(MON))
    const immersive = view.exercises.find((e) => e.type === 'dialogue' || e.type === 'roleplay')!
    const next = session(practice.skip(immersive.id))
    const replaced = next.exercises.find((e) => e.slot === immersive.slot)!
    expect(replaced.type).toBe(immersive.type === 'dialogue' ? 'roleplay' : 'dialogue')
  })

  it('las respuestas de varias partes llegan completas a la corrección', async () => {
    const view = session(await practice.start(MON))
    const set = view.exercises.find((e) => e.type === 'translation_set')!
    // Una oración distinta de la referencia obliga a pedirle la corrección a Claude.
    await practice.answer(set.id, { type: 'translation_set', texts: ['I work today 0.', 'My sister is a student.', 'We are friends.'] })
    await practice.settled()
    expect(graded).toContain('translation_set')
  })
})
describe('práctica guardada de un subtema que cambió', () => {
  it('sin respuestas, se descarta y se arma con el subtema actual del mismo día', async () => {
    await practice.start(day(0))
    // Como si el temario se hubiera editado: el subtema guardado ya no existe.
    db.exec("UPDATE practice_units SET subtopic_id = 'subtema-viejo'; UPDATE practice_sessions SET subtopic_id = 'subtema-viejo'")

    const view = practice.getView(day(0))
    expect(view.status).toBe('ready')
    const started = session(await practice.start(day(0)))
    const firstDay = curriculum.find((t) => t.id === 'a1-to-be')!.subtopics[0]
    expect(started.subtopicTitle).toBe(firstDay.title)
    expect(generated.at(-1)).toBe(firstDay.id)
    const row = db.prepare('SELECT subtopic_id FROM practice_sessions').get() as { subtopic_id: string }
    expect(row.subtopic_id).toBe(firstDay.id)
  })

  it('con respuestas, sigue con lo que ya tenía en vez de fallar', async () => {
    const s = session(await practice.start(day(0)))
    await practice.answer(s.exercises[0].id, rightAnswer(stored(s.exercises[0].id)))
    db.exec("UPDATE practice_units SET subtopic_id = 'subtema-viejo'; UPDATE practice_sessions SET subtopic_id = 'subtema-viejo'")

    const view = practice.getView(day(0))
    expect(view.status).toBe('session')
    expect(session(view).exercises[0].feedback).not.toBeNull()
  })
})

describe('práctica que empieza con los ejercicios cortos', () => {
  const isLong = (type: ExerciseType): boolean => ['translation_set', 'dialogue', 'roleplay', 'writing'].includes(type)

  it('arranca apenas llegan los cortos y suma los largos al final cuando llegan', async () => {
    let releaseLong!: () => void
    const longArrived = new Promise<void>((resolve) => (releaseLong = resolve))
    const progressive: PoolGenerator = async ({ counts, onGroup }) => {
      const all = (Object.entries(counts) as [ExerciseType, number][]).flatMap(([type, count]) =>
        Array.from({ length: count }, (_, i) => sample(type, i))
      )
      const short = all.filter((e) => !isLong(e.type))
      const long = all.filter((e) => isLong(e.type))
      onGroup?.(short)
      await longArrived
      onGroup?.(long)
      return all
    }
    practice = new Practice(db, curriculum, progression, progressive, grader)

    const first = session(await practice.start(day(0)))
    expect(first.pendingCount).toBeGreaterThan(0)
    expect(first.exercises.length + first.pendingCount).toBe(SESSION_SIZE)
    expect(first.exercises.every((e) => !isLong(e.type))).toBe(true)

    // Respondidos los cortos, todavía no se puede terminar.
    const answered = await answerAllRight(first)
    expect(answered.canFinish).toBe(false)

    releaseLong()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const full = session(practice.getView(day(0)))
    expect(full.pendingCount).toBe(0)
    expect(full.exercises).toHaveLength(SESSION_SIZE)
    expect(full.exercises.slice(-first.pendingCount).every((e) => isLong(e.type))).toBe(true)
  })

  it('si la app se cerró sin los largos, los vuelve a pedir al abrir la práctica', async () => {
    const calls: string[][] = []
    const shortOnly: PoolGenerator = async ({ counts, onGroup }) => {
      calls.push(Object.keys(counts))
      const all = (Object.entries(counts) as [ExerciseType, number][]).flatMap(([type, count]) =>
        Array.from({ length: count }, (_, i) => sample(type, i))
      )
      const short = all.filter((e) => !isLong(e.type))
      onGroup?.(short)
      if (all.some((e) => isLong(e.type)) && short.length > 0) throw new Error('se cortó')
      onGroup?.(all.filter((e) => isLong(e.type)))
      return all
    }
    practice = new Practice(db, curriculum, progression, shortOnly, grader)
    const first = session(await practice.start(day(0)))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(session(practice.getView(day(0))).pendingError).toBe('se cortó')

    // «Reintentar» pide solo los largos.
    practice = new Practice(db, curriculum, progression, shortOnly, grader)
    practice.getView(day(0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls.at(-1)!.every((type) => isLong(type as ExerciseType))).toBe(true)
    const full = session(practice.getView(day(0)))
    expect(full.pendingCount).toBe(0)
    expect(full.exercises.length).toBe(first.exercises.length + first.pendingCount)
  })
})

describe('dificultad que se adapta', () => {
  it('arranca guiada y sube un escalón después de dos prácticas casi perfectas', async () => {
    const asked: (string | undefined)[] = []
    const recording: PoolGenerator = async (request) => {
      asked.push(request.difficulty)
      return generator(request)
    }
    practice = new Practice(db, curriculum, progression, recording, grader)
    for (const offset of [0, 1]) {
      const s = session(await practice.start(day(offset)))
      await answerAllRight(s, day(offset))
      practice.finish(s.id, day(offset))
    }
    await practice.start(day(2))
    expect(asked[0]).toBe('guided')
    expect(asked.at(-1)).toBe('normal')
    const view = practice.getView(day(2))
    if (view.status === 'session') expect(practice.difficultyState().difficulty).toBe('normal')
  })
})

describe('segundo intento y repetición al final', () => {
  const RETRYABLE: ExerciseType[] = ['multiple_choice', 'fill_blank', 'error_correction', 'word_order']

  // Una respuesta equivocada de los tipos que se corrigen al instante.
  function wrongAnswer(e: StoredExercise): ExerciseAnswer {
    switch (e.type) {
      case 'multiple_choice':
        return { type: e.type, choice: (e.correctIndex + 1) % e.options.length }
      case 'word_order':
        return { type: e.type, tokens: [...e.tokens].sort().reverse() }
      case 'fill_blank':
      case 'error_correction':
        return { type: e.type, text: 'zzz' }
      default:
        throw new Error(`sin respuesta equivocada para ${e.type}`)
    }
  }
  const mistakes = (): number => (db.prepare("SELECT COUNT(*) AS n FROM cards WHERE kind = 'mistake'").get() as { n: number }).n
  const find = (s: SessionView, id: number): SessionView['exercises'][number] => s.exercises.find((e) => e.id === id)!

  it('si le erra, tiene un segundo intento con una pista; si acierta, vale con menos puntaje y no va al cuaderno', async () => {
    const s = session(await practice.start(MON))
    const e = s.exercises.find((x) => RETRYABLE.includes(x.type))!
    const first = find(session(await practice.answer(e.id, wrongAnswer(stored(e.id)))), e.id)
    expect(first).toMatchObject({ answer: null, feedback: null })
    expect(first.retry).toBeTruthy()

    const done = find(session(await practice.answer(e.id, rightAnswer(stored(e.id)))), e.id)
    expect(done.feedback).toMatchObject({ correct: true, score: 7 })
    expect(done.feedback!.explanation).toMatch(/^Bien al segundo intento/)
    expect(done.retry).toBeNull()
    expect(mistakes()).toBe(0)
  })

  it('si le erra dos veces, va al cuaderno y vuelve al final, sin segundo intento ni otra vuelta', async () => {
    const s = session(await practice.start(MON))
    const e = s.exercises.find((x) => RETRYABLE.includes(x.type))!
    await practice.answer(e.id, wrongAnswer(stored(e.id)))
    const view = session(await practice.answer(e.id, wrongAnswer(stored(e.id))))
    expect(find(view, e.id).feedback?.correct).toBe(false)
    expect(mistakes()).toBe(1)

    const repeat = view.exercises.at(-1)!
    expect(repeat).toMatchObject({ type: e.type, repeat: true, answer: null })
    expect(view.exercises).toHaveLength(s.exercises.length + 1)

    const after = session(await practice.answer(repeat.id, wrongAnswer(stored(repeat.id))))
    expect(find(after, repeat.id).feedback?.correct).toBe(false)
    expect(after.exercises).toHaveLength(view.exercises.length)
    expect(mistakes()).toBe(1)
  })

  it('la repetición hay que hacerla para terminar, pero no cuenta en el resultado', async () => {
    const s = session(await practice.start(MON))
    const e = s.exercises.find((x) => RETRYABLE.includes(x.type))!
    await practice.answer(e.id, wrongAnswer(stored(e.id)))
    await practice.answer(e.id, wrongAnswer(stored(e.id)))
    for (const x of s.exercises) if (x.id !== e.id) await practice.answer(x.id, rightAnswer(stored(x.id)))
    await practice.settled()
    const view = session(practice.getView(MON))
    expect(view.canFinish).toBe(false)

    const repeat = view.exercises.at(-1)!
    await practice.answer(repeat.id, rightAnswer(stored(repeat.id)))
    expect(practice.finish(view.id, MON)).toMatchObject({ correct: SESSION_SIZE - 1, total: SESSION_SIZE })
  })
})

describe('práctica que empieza antes de que llegue lo de escuchar', () => {
  it('lo de escuchar que llega tarde entra en lugar de un corto, sin alargar la práctica', async () => {
    const LATE: ExerciseType[] = ['dictation', 'listening', 'minimal_pair', 'shadowing']
    let release!: () => void
    const later = new Promise<void>((resolve) => (release = resolve))
    const lateGenerator: PoolGenerator = async ({ counts, onGroup }) => {
      const all = (Object.entries(counts) as [ExerciseType, number][]).flatMap(([type, count]) =>
        Array.from({ length: count }, (_, i) => sample(type, i))
      )
      onGroup?.(all.filter((e) => !LATE.includes(e.type)))
      await later
      onGroup?.(all.filter((e) => LATE.includes(e.type)))
      return all
    }
    practice = new Practice(db, curriculum, progression, lateGenerator, grader)
    const s = session(await practice.start(MON))
    expect(s.exercises.some((e) => LATE.includes(e.type))).toBe(false)

    release()
    await new Promise((resolve) => setTimeout(resolve, 10))
    const after = session(practice.getView(MON))
    const types = after.exercises.map((e) => e.type)
    expect(after.exercises).toHaveLength(s.exercises.length)
    expect(types).not.toContain('shadowing')
    expect(types.some((t) => ['dictation', 'listening', 'minimal_pair'].includes(t))).toBe(true)
    // El primero sigue en su lugar: es el que el alumno tiene a la vista.
    expect(after.exercises[0].id).toBe(s.exercises[0].id)
  })
})

describe('el recorrido del día', () => {
  it('la microlección trae los errores típicos y cuántos repasos tocan para el calentamiento', () => {
    const view = practice.getView(MON)
    if (view.status !== 'ready') throw new Error('se esperaba la microlección')
    expect(view.commonMistakes.length).toBeGreaterThan(0)
    expect(view.warmUp).toBe(0)
  })

  it('el cierre dice qué se trabajó, cuánto pasó al cuaderno y cuánto vuelve mañana', async () => {
    const s = session(await practice.start(MON))
    const [first, ...rest] = s.exercises
    // La primera, en blanco dos veces: queda mal y pasa al cuaderno.
    const blank = (): ExerciseAnswer => emptyAnswer(stored(first.id))
    await practice.answer(first.id, blank(), MON)
    if (!session(practice.getView(MON)).exercises.find((e) => e.id === first.id)!.answer) await practice.answer(first.id, blank(), MON)
    for (const e of rest) await practice.answer(e.id, rightAnswer(stored(e.id)))
    await practice.settled()
    for (const e of session(practice.getView(MON)).exercises.filter((x) => x.repeat)) await practice.answer(e.id, rightAnswer(stored(e.id)))
    const result = practice.finish(s.id, MON)
    // Mañana vuelven el error y las frases hechas que se sumaron al terminar.
    expect(result).toMatchObject({ subtopicTitle: 'Pronombres personales', newMistakes: 1, dueTomorrow: 1 + result.newPhrases })
  })
})

describe('lo de otros tópicos que se mezcla', () => {
  it('trae ejercicios de los subtemas con más errores de otros tópicos, sin alargar la práctica', async () => {
    const other = curriculum[1]
    const subtopicId = other.subtopics[0].id
    recordMistake(
      db,
      {
        source: 'practice',
        sourceId: 999,
        topicId: other.id,
        subtopicId,
        exercise: sample('fill_blank', 'x'),
        given: { type: 'fill_blank', text: 'z' }
      },
      MON
    )
    const picked: string[] = []
    practice = new Practice(db, curriculum, progression, generator, grader, undefined, (topic, sub) => {
      picked.push(`${topic.id}/${sub}`)
      return generatedSample('fill_blank', `mezcla ${sub}`)
    })
    const s = session(await practice.start(MON))
    expect(s.exercises).toHaveLength(SESSION_SIZE)
    expect(picked).toEqual([`${other.id}/${subtopicId}`])
    const mixed = s.exercises.filter((e) => e.from)
    expect(mixed.map((e) => e.from)).toEqual([other.title])

    // Si sale mal, el error queda anotado en su tópico.
    const wrong: ExerciseAnswer = { type: 'fill_blank', text: 'zzz' }
    await practice.answer(mixed[0].id, wrong, MON)
    await practice.answer(mixed[0].id, wrong, MON)
    expect((db.prepare('SELECT COUNT(*) AS n FROM cards WHERE topic_id = ?').get(other.id) as { n: number }).n).toBe(2)
  })
})

describe('frases hechas', () => {
  it('al terminar, las frases del subtema pasan a las tarjetas y se repasan como frases', async () => {
    const withChunks = structuredClone(curriculum)
    withChunks[0].subtopics[0].chunks = [
      { target: 'How are you?', es: '¿Cómo estás?', example: 'Hi Ana, how are you?', exampleEs: 'Hola Ana, ¿cómo estás?' },
      { target: 'Nice to meet you', es: 'Encantado', example: 'Nice to meet you, Tom.', exampleEs: 'Encantado, Tom.' }
    ]
    progression = new Progression(db, withChunks)
    practice = new Practice(db, withChunks, progression, generator, grader)
    const view = practice.getView(MON)
    if (view.status !== 'ready') throw new Error('se esperaba la microlección')
    expect(view.chunks).toHaveLength(2)

    const s = await answerAllRight(session(await practice.start(MON)))
    expect(practice.finish(s.id, MON).newPhrases).toBe(2)
    const cards = new Vocabulary(db, withChunks, 'en').overview(MON).cards
    expect(cards.map((c) => [c.kind, c.term, c.example])).toEqual([
      ['phrase', 'Nice to meet you', 'Nice to meet you, Tom.'],
      ['phrase', 'How are you?', 'Hi Ana, how are you?']
    ])
  })
})
