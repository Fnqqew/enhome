// Herramientas de prueba (solo en desarrollo) mientras no existen las prácticas y los exámenes reales.

import type { CurriculumTopic } from '../../shared/curriculum'
import type { ExamSubmission } from './progression'

const QUESTIONS = 20
const PREREQUISITE_QUESTIONS = 4

// Examen de 20 preguntas con la nota pedida: los errores se reparten de forma pareja,
// y las últimas 4 preguntas son del primer prerrequisito (si hay) para ejercitar la detección de repasos.
export function simulatedExam(topic: CurriculumTopic, grade: number, prerequisite?: CurriculumTopic): ExamSubmission {
  const wrong = QUESTIONS - Math.round(grade * 2)
  const answers = Array.from({ length: QUESTIONS }, (_, i) => {
    const source = prerequisite && i >= QUESTIONS - PREREQUISITE_QUESTIONS ? prerequisite : topic
    const subtopic = source.subtopics[i % source.subtopics.length]
    const correct = Math.floor((i * wrong) / QUESTIONS) === Math.floor(((i + 1) * wrong) / QUESTIONS)
    return { topicId: source.id, subtopicId: subtopic.id, correct }
  })
  return { grade, answers }
}
