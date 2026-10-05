// Estado de progresión que la interfaz muestra.

export type UnitKind = 'lesson' | 'focus' | 'review'
export type WeekKind = 'normal' | 'carry' | 'retry'
export type DayStatus = 'upcoming' | 'today' | 'done' | 'missed' | 'recovered' | 'skipped' | 'weekend'
export type ExamStatus = 'not-ready' | 'too-early' | 'locked' | 'available' | 'closed'

export interface WeekDayView {
  date: string
  weekday: number
  status: DayStatus
  practiced: boolean
}

export interface PracticeUnitView {
  id: number
  index: number
  kind: UnitKind
  topicId: string
  topicTitle: string
  subtopicId: string
  subtopicTitle: string
  completedOn: string | null
}

export interface WeekView {
  id: number
  topicId: string
  topicTitle: string
  level: string
  kind: WeekKind
  weekStart: string
  startsOn: string
  days: WeekDayView[]
  units: PracticeUnitView[]
  faltas: number
  recovered: boolean
  effectiveFaltas: number
  completedUnits: number
  nextUnit: PracticeUnitView | null
  canPracticeNow: boolean
  practiceBlockedReason: string | null
  canRecover: boolean
  examStatus: ExamStatus
  examMessage: string
}

export interface ProgressState {
  today: string
  placementDone: boolean
  placementInProgress: boolean
  level: string | null
  week: WeekView | null
  finished: boolean
  reviewTopics: { id: string; title: string; level: string }[]
  attempts: { attempts: number; failed: number } | null
}

export type PlacementView =
  | { status: 'not-started' }
  | {
      status: 'question'
      question: { id: string; instruction: string; prompt: string; options: string[] }
      topicTitle: string
      topicNumber: number
      totalTopics: number
      answeredInTopic: number
      questionsPerTopic: number
    }
  | { status: 'finished'; startTopicTitle: string | null; level: string | null; correct: number; answered: number }

export interface AppInfo {
  isDev: boolean
  version: string
  // Para la sección «Acerca de».
  electron: string
  node: string
  chrome: string
  dataDir: string
  repoUrl: string
}
