import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api, type Result } from '../shared/ipc'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  if (!result.ok) throw new Error(result.error)
  return result.data
}

const api: Api = {
  getAppInfo: () => invoke(IPC.appInfo),
  getClaudeStatus: () => invoke(IPC.claudeStatus),
  sampleSentence: () => invoke(IPC.claudeSample),
  getSettings: () => invoke(IPC.settingsGet),
  updateSettings: (patch) => invoke(IPC.settingsUpdate, patch),
  getCurriculum: () => invoke(IPC.curriculumList),
  getCurriculumMap: () => invoke(IPC.curriculumMap),
  getProgress: () => invoke(IPC.progressGet),
  completePracticeUnit: (unitId) => invoke(IPC.practiceComplete, unitId),
  recordRecoverySession: () => invoke(IPC.recoveryRecord),
  startPlacement: () => invoke(IPC.placementStart),
  getPlacement: () => invoke(IPC.placementGet),
  answerPlacement: (questionId, choice) => invoke(IPC.placementAnswer, questionId, choice),
  getPractice: () => invoke(IPC.practiceGet),
  startPractice: () => invoke(IPC.practiceStart),
  answerExercise: (exerciseId, answer) => invoke(IPC.practiceAnswer, exerciseId, answer),
  skipExercise: (exerciseId) => invoke(IPC.practiceSkip, exerciseId),
  rateExercise: (exerciseId, rating) => invoke(IPC.practiceRate, exerciseId, rating),
  finishPractice: (sessionId) => invoke(IPC.practiceFinish, sessionId),
  getSummariesIndex: () => invoke(IPC.summariesIndex),
  getSummary: (topicId, type) => invoke(IPC.summaryGet, topicId, type),
  generateSummary: (topicId, type, regenerate) => invoke(IPC.summaryGenerate, topicId, type, regenerate),
  rateSummary: (topicId, type, rating) => invoke(IPC.summaryRate, topicId, type, rating),
  setFavoriteSummaryType: (type, favorite) => invoke(IPC.summaryFavorite, type, favorite),
  askAboutText: (topicId, fragment, question) => invoke(IPC.summaryAsk, topicId, fragment, question),
  getTestsOverview: () => invoke(IPC.testsOverview),
  getExamLock: () => invoke(IPC.examLock),
  startWeeklyExam: () => invoke(IPC.examStartWeekly),
  startMockExam: (scope) => invoke(IPC.examStartMock, scope),
  resumeExam: (examId) => invoke(IPC.examResume, examId),
  saveExamAnswer: (examId, index, answer) => invoke(IPC.examSave, examId, index, answer),
  examHeartbeat: (examId) => invoke(IPC.examHeartbeat, examId),
  submitExam: (examId) => invoke(IPC.examSubmit, examId),
  getExamResult: (examId) => invoke(IPC.examResult, examId),
  discardMockExam: (examId) => invoke(IPC.examDiscard, examId),
  onDayChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, today: string): void => callback(today)
    ipcRenderer.on(IPC.dayChanged, listener)
    return () => ipcRenderer.removeListener(IPC.dayChanged, listener)
  },
  devSetToday: (date) => invoke(IPC.devSetToday, date),
  devSimulateExam: (grade) => invoke(IPC.devSimulateExam, grade),
  devResetProgress: () => invoke(IPC.devResetProgress)
}

contextBridge.exposeInMainWorld('api', api)
