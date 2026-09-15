// Temario completo con el estado del alumno en cada tópico, para la vista interactiva.

import {
  CEFR_LEVEL_NAMES,
  CEFR_LEVELS,
  type CurriculumMap,
  type CurriculumTopic,
  type Roadmap,
  type TopicMapStatus
} from '../../shared/curriculum'

export interface TopicProgressInfo {
  status: string
  bestGrade: number | null
  attempts: number
}

export function buildCurriculumMap(
  curriculum: CurriculumTopic[],
  roadmap: Roadmap,
  progress: Map<string, TopicProgressInfo>,
  currentTopicId: string | null,
  placementDone: boolean
): CurriculumMap {
  const statusOf = (topicId: string): TopicMapStatus => {
    if (!placementDone) return 'not-started'
    if (topicId === currentTopicId) return 'current'
    const status = progress.get(topicId)?.status
    if (status === 'passed') return 'passed'
    if (status === 'review') return 'review'
    return 'locked'
  }

  return {
    currentTopicId,
    totalTopics: curriculum.length,
    reviewedCount: curriculum.filter((t) => t.reviewed).length,
    levels: CEFR_LEVELS.map((level) => {
      const topics = curriculum
        .filter((t) => t.level === level)
        .map(({ summary: _summary, ...topic }) => ({
          ...topic,
          status: statusOf(topic.id),
          bestGrade: progress.get(topic.id)?.bestGrade ?? null,
          attempts: progress.get(topic.id)?.attempts ?? 0
        }))
      return {
        level,
        name: CEFR_LEVEL_NAMES[level],
        available: topics.length > 0,
        topics,
        planned: roadmap.levels.find((l) => l.level === level)?.topics ?? []
      }
    })
  }
}
