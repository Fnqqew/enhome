// Examen inicial: tópico por tópico, 3 preguntas cada uno; el primer tópico no superado es donde empieza el recorrido.

import type { CurriculumTopic } from '../../shared/curriculum'
import type { PlacementView } from '../../shared/progress'
import type { Db } from '../db/database'
import type { AnswerTag } from './planning'
import type { Progression } from './progression'
import { PLACEMENT_MIN_CORRECT, PLACEMENT_QUESTIONS_PER_TOPIC } from './rules'

export interface GeneratedQuestion {
  subtopicId: string
  instruction: string
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface PlacementQuestion extends GeneratedQuestion {
  id: string
  topicId: string
}

export type QuestionGenerator = (topic: CurriculumTopic) => Promise<GeneratedQuestion[]>

export class PlacementError extends Error {}

interface ExamRow {
  id: number
  questions: string
}

type Evaluation =
  | { finished: true; startTopicId: string | null }
  | { finished: false; topicIndex: number; topic: CurriculumTopic; question: PlacementQuestion | null; answeredInTopic: number }

export class Placement {
  private readonly generating = new Map<string, Promise<void>>()

  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[],
    private readonly progression: Progression,
    private readonly generate: QuestionGenerator
  ) {}

  start(): void {
    if (this.isDone()) throw new PlacementError('El examen inicial ya está hecho.')
    if (!this.currentExam()) {
      this.db.prepare("INSERT INTO exams (kind, status, questions) VALUES ('placement', 'in_progress', '[]')").run()
    }
  }

  async view(today: string): Promise<PlacementView> {
    const exam = this.currentExam()
    if (!exam) return this.isDone() ? this.result() : { status: 'not-started' }

    const evaluation = this.evaluate(exam)
    if (evaluation.finished) {
      this.finish(exam, evaluation.startTopicId, today)
      return this.result()
    }
    if (!evaluation.question) {
      await this.ensureQuestions(evaluation.topic)
      return this.view(today)
    }

    // Se prepara el tópico siguiente en segundo plano; si falla, se reintenta cuando haga falta.
    const next = this.curriculum[evaluation.topicIndex + 1]
    if (next) this.ensureQuestions(next).catch(() => undefined)

    const { question } = evaluation
    return {
      status: 'question',
      question: { id: question.id, instruction: question.instruction, prompt: question.prompt, options: question.options },
      topicTitle: evaluation.topic.title,
      topicNumber: evaluation.topicIndex + 1,
      totalTopics: this.curriculum.length,
      answeredInTopic: evaluation.answeredInTopic,
      questionsPerTopic: PLACEMENT_QUESTIONS_PER_TOPIC
    }
  }

  // choice -1 = "No lo sé".
  async answer(questionId: string, choice: number, today: string): Promise<PlacementView> {
    const exam = this.currentExam()
    if (!exam) throw new PlacementError('No hay un examen inicial en curso.')
    const evaluation = this.evaluate(exam)
    if (evaluation.finished || evaluation.question?.id !== questionId) throw new PlacementError('Esa pregunta ya no es la actual.')

    const questions = this.questions(exam)
    const index = questions.findIndex((q) => q.id === questionId)
    const question = questions[index]
    this.db
      .prepare('INSERT INTO exam_answers (exam_id, question_index, answer, correct, topic_tag, subtopic_tag) VALUES (?, ?, ?, ?, ?, ?)')
      .run(exam.id, index, JSON.stringify({ choice }), choice === question.correctIndex ? 1 : 0, question.topicId, question.subtopicId)
    return this.view(today)
  }

  private evaluate(exam: ExamRow): Evaluation {
    const questions = this.questions(exam)
    const answers = this.answers(exam.id)

    for (const [topicIndex, topic] of this.curriculum.entries()) {
      const topicQuestions = questions.map((q, i) => ({ q, i })).filter(({ q }) => q.topicId === topic.id)
      if (topicQuestions.length === 0) return { finished: false, topicIndex, topic, question: null, answeredInTopic: 0 }

      const pending = topicQuestions.find(({ i }) => !answers.has(i))
      if (pending) {
        const answeredInTopic = topicQuestions.filter(({ i }) => answers.has(i)).length
        return { finished: false, topicIndex, topic, question: pending.q, answeredInTopic }
      }
      const correct = topicQuestions.filter(({ i }) => answers.get(i)).length
      if (correct < PLACEMENT_MIN_CORRECT) return { finished: true, startTopicId: topic.id }
    }
    return { finished: true, startTopicId: null }
  }

  private ensureQuestions(topic: CurriculumTopic): Promise<void> {
    const exam = this.currentExam()
    if (!exam || this.questions(exam).some((q) => q.topicId === topic.id)) return Promise.resolve()

    let pending = this.generating.get(topic.id)
    if (!pending) {
      pending = this.generate(topic)
        .then((generated) => {
          const current = this.currentExam()
          if (!current) return
          const questions = this.questions(current)
          if (questions.some((q) => q.topicId === topic.id)) return
          const added = generated
            .slice(0, PLACEMENT_QUESTIONS_PER_TOPIC)
            .map((q, i): PlacementQuestion => ({ ...q, id: `${topic.id}-${i + 1}`, topicId: topic.id }))
          this.db.prepare('UPDATE exams SET questions = ? WHERE id = ?').run(JSON.stringify([...questions, ...added]), current.id)
        })
        .finally(() => this.generating.delete(topic.id))
      this.generating.set(topic.id, pending)
    }
    return pending
  }

  private finish(exam: ExamRow, startTopicId: string | null, today: string): void {
    const questions = this.questions(exam)
    const answers = this.answers(exam.id)
    const tags: AnswerTag[] = [...answers].map(([i, correct]) => ({
      topicId: questions[i].topicId,
      subtopicId: questions[i].subtopicId,
      correct
    }))
    this.progression.applyPlacementResult(startTopicId, tags, today)
    const correct = tags.filter((t) => t.correct).length
    const grade = tags.length === 0 ? 0 : Math.round((correct / tags.length) * 100) / 10
    this.db
      .prepare("UPDATE exams SET status = 'submitted', grade = ?, submitted_at = datetime('now') WHERE id = ?")
      .run(grade, exam.id)
  }

  private result(): PlacementView {
    const exam = this.db
      .prepare("SELECT id FROM exams WHERE kind = 'placement' AND status = 'submitted' ORDER BY id DESC LIMIT 1")
      .get() as { id: number } | undefined
    const counts = exam
      ? (this.db.prepare('SELECT COUNT(*) AS answered, COALESCE(SUM(correct), 0) AS correct FROM exam_answers WHERE exam_id = ?').get(exam.id) as {
          answered: number
          correct: number
        })
      : { answered: 0, correct: 0 }
    const start = this.db.prepare("SELECT topic_id FROM topic_progress WHERE status = 'in_progress' LIMIT 1").get() as
      | { topic_id: string }
      | undefined
    const startTopic = start ? this.curriculum.find((t) => t.id === start.topic_id) : undefined
    const player = this.db.prepare('SELECT cefr_level FROM player WHERE id = 1').get() as { cefr_level: string | null }
    return {
      status: 'finished',
      startTopicTitle: startTopic?.title ?? null,
      level: startTopic?.level ?? player.cefr_level,
      correct: counts.correct,
      answered: counts.answered
    }
  }

  private currentExam(): ExamRow | null {
    return (
      (this.db.prepare("SELECT id, questions FROM exams WHERE kind = 'placement' AND status = 'in_progress' ORDER BY id DESC LIMIT 1").get() as
        | ExamRow
        | undefined) ?? null
    )
  }

  private questions(exam: ExamRow): PlacementQuestion[] {
    const row = this.db.prepare('SELECT questions FROM exams WHERE id = ?').get(exam.id) as { questions: string }
    return JSON.parse(row.questions) as PlacementQuestion[]
  }

  private answers(examId: number): Map<number, boolean> {
    const rows = this.db.prepare('SELECT question_index, correct FROM exam_answers WHERE exam_id = ?').all(examId) as unknown as {
      question_index: number
      correct: number
    }[]
    return new Map(rows.map((r) => [r.question_index, r.correct === 1]))
  }

  private isDone(): boolean {
    const player = this.db.prepare('SELECT placement_done_at FROM player WHERE id = 1').get() as { placement_done_at: string | null }
    return player.placement_done_at !== null
  }
}
