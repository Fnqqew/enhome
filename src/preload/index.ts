import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api, type Result } from '../shared/ipc'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  if (!result.ok) throw new Error(result.error)
  return result.data
}

const api: Api = {
  getAppInfo: () => invoke(IPC.appInfo),
  getClaudeTimings: () => invoke(IPC.appTimings),
  openLogFile: () => invoke(IPC.appOpenLog),
  openDataFolder: () => invoke(IPC.appOpenData),
  checkUpdates: () => invoke(IPC.updatesCheck),
  installUpdate: () => invoke(IPC.updatesInstall),
  getModelsSize: () => invoke(IPC.modelsSize),
  addStudyTime: (seconds) => invoke(IPC.studyAdd, seconds),
  getGoal: () => invoke(IPC.goalGet),
  onNavigate: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, section: string): void => callback(section)
    ipcRenderer.on(IPC.navigate, listener)
    return () => ipcRenderer.removeListener(IPC.navigate, listener)
  },
  getBackups: () => invoke(IPC.dataBackups),
  backupNow: () => invoke(IPC.dataBackupNow),
  restoreBackup: (date) => invoke(IPC.dataRestore, date),
  exportData: () => invoke(IPC.dataExport),
  importData: () => invoke(IPC.dataImport),
  deleteAllData: () => invoke(IPC.dataDeleteAll),
  removeModels: () => invoke(IPC.modelsRemove),
  getClaudeStatus: () => invoke(IPC.claudeStatus),
  cancelClaude: () => invoke(IPC.claudeCancel),
  sampleSentence: () => invoke(IPC.claudeSample),
  getSettings: () => invoke(IPC.settingsGet),
  updateSettings: (patch) => invoke(IPC.settingsUpdate, patch),
  getCurriculum: () => invoke(IPC.curriculumList),
  getCurriculumMap: () => invoke(IPC.curriculumMap),
  saveTopicReview: (topicId, edit, markReviewed) => invoke(IPC.topicReviewSave, topicId, edit, markReviewed),
  getProgress: () => invoke(IPC.progressGet),
  getCourses: () => invoke(IPC.coursesList),
  pauseCourse: () => invoke(IPC.coursePause),
  resumeCourse: () => invoke(IPC.courseResume),
  resetCourse: (language) => invoke(IPC.courseReset, language),
  completePracticeUnit: (unitId) => invoke(IPC.practiceComplete, unitId),
  recordRecoverySession: () => invoke(IPC.recoveryRecord),
  startPlacement: () => invoke(IPC.placementStart),
  getPlacement: () => invoke(IPC.placementGet),
  startFromScratch: () => invoke(IPC.placementSkip),
  answerPlacement: (questionId, choice) => invoke(IPC.placementAnswer, questionId, choice),
  getPractice: () => invoke(IPC.practiceGet),
  startPractice: () => invoke(IPC.practiceStart),
  answerExercise: (exerciseId, answer) => invoke(IPC.practiceAnswer, exerciseId, answer),
  skipExercise: (exerciseId) => invoke(IPC.practiceSkip, exerciseId),
  regradeExercise: (exerciseId) => invoke(IPC.practiceRegrade, exerciseId),
  listVoices: () => invoke(IPC.voiceList),
  installVoice: (voiceId) => invoke(IPC.voiceInstall, voiceId),
  removeVoice: (voiceId) => invoke(IPC.voiceRemove, voiceId),
  speakNeural: (text, lang, speed, role) => invoke(IPC.voiceSpeak, text, lang, speed, role),
  prefetchVoice: (texts, lang, role) => invoke(IPC.voicePrefetch, texts, lang, role),
  onVoiceChanged: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.voiceChanged, listener)
    return () => ipcRenderer.removeListener(IPC.voiceChanged, listener)
  },
  onPracticeGraded: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.practiceGraded, listener)
    return () => ipcRenderer.removeListener(IPC.practiceGraded, listener)
  },
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
  startMockExam: (scope, subtopicId) => invoke(IPC.examStartMock, scope, subtopicId ?? null),
  resumeExam: (examId) => invoke(IPC.examResume, examId),
  saveExamAnswer: (examId, index, answer) => invoke(IPC.examSave, examId, index, answer),
  examHeartbeat: (examId) => invoke(IPC.examHeartbeat, examId),
  submitExam: (examId) => invoke(IPC.examSubmit, examId),
  getExamResult: (examId) => invoke(IPC.examResult, examId),
  discardMockExam: (examId) => invoke(IPC.examDiscard, examId),
  getProgressView: () => invoke(IPC.rewardsView),
  takeRewardNews: () => invoke(IPC.rewardsNews),
  getCertificates: () => invoke(IPC.certificatesList),
  getStats: () => invoke(IPC.statsGet),
  searchLibrary: (query) => invoke(IPC.librarySearch, query),
  getCertificateHtml: (level) => invoke(IPC.certificateHtml, level),
  saveCertificatePdf: (level) => invoke(IPC.certificatePdf, level),
  usePracticeHint: (exerciseId) => invoke(IPC.rewardsHint, exerciseId),
  useSecondChance: (examId, index) => invoke(IPC.rewardsSecondChance, examId, index),
  lookupWord: (term, context) => invoke(IPC.vocabLookup, term, context),
  saveWord: (info) => invoke(IPC.vocabSave, info),
  getVocab: () => invoke(IPC.vocabOverview),
  getDueWords: () => invoke(IPC.vocabDue),
  reviewWord: (cardId, knew) => invoke(IPC.vocabReview, cardId, knew),
  removeWord: (cardId) => invoke(IPC.vocabRemove, cardId),
  saveSentence: (sentence) => invoke(IPC.vocabSaveSentence, sentence),
  getChats: () => invoke(IPC.chatList),
  getChat: (chatId) => invoke(IPC.chatGet, chatId),
  startChat: (suggestion) => invoke(IPC.chatStart, suggestion),
  sendChat: (chatId, text, spoken) => invoke(IPC.chatSend, chatId, text, spoken),
  removeChat: (chatId) => invoke(IPC.chatRemove, chatId),
  getHighlights: (docKey) => invoke(IPC.highlightsList, docKey),
  addHighlight: (docKey, text) => invoke(IPC.highlightAdd, docKey, text),
  noteHighlight: (highlightId, note) => invoke(IPC.highlightNote, highlightId, note),
  removeHighlight: (docKey, highlightId) => invoke(IPC.highlightRemove, docKey, highlightId),
  getReadings: () => invoke(IPC.readingsList),
  getReading: (readingId) => invoke(IPC.readingGet, readingId),
  generateReading: (theme) => invoke(IPC.readingGenerate, theme),
  answerReading: (readingId, answers) => invoke(IPC.readingAnswer, readingId, answers),
  removeReading: (readingId) => invoke(IPC.readingRemove, readingId),
  getStory: () => invoke(IPC.readingStory),
  nextChapter: () => invoke(IPC.readingNextChapter),
  getMission: () => invoke(IPC.missionGet),
  getPronunciation: () => invoke(IPC.pronunciationGet),
  getWriting: () => invoke(IPC.writingGet),
  getCoreWords: () => invoke(IPC.coreWordsToday),
  learnCoreWords: (terms) => invoke(IPC.coreWordsLearn, terms),
  createMission: (mode) => invoke(IPC.missionCreate, mode),
  submitMission: (answer) => invoke(IPC.missionSubmit, answer),
  getJournal: () => invoke(IPC.journalGet),
  saveJournal: (text) => invoke(IPC.journalSave, text),
  correctJournal: () => invoke(IPC.journalCorrect),
  getGameDeck: () => invoke(IPC.gamesDeck),
  finishGame: (game, score) => invoke(IPC.gamesFinish, game, score),
  getReviewOverview: () => invoke(IPC.reviewOverview),
  getDueReviews: () => invoke(IPC.reviewDue),
  getExamReview: (examId) => invoke(IPC.reviewExam, examId),
  answerReview: (mistakeId, answer) => invoke(IPC.reviewAnswer, mistakeId, answer),
  getFeedback: () => invoke(IPC.feedbackList),
  addFeedback: (note) => invoke(IPC.feedbackAdd, note),
  toggleFeedback: (id) => invoke(IPC.feedbackToggle, id),
  removeFeedback: (id) => invoke(IPC.feedbackRemove, id),
  minimizeWindow: () => ipcRenderer.send(IPC.windowMinimize),
  toggleMaximizeWindow: () => ipcRenderer.send(IPC.windowMaximizeToggle),
  closeWindow: () => ipcRenderer.send(IPC.windowClose),
  onWindowState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean): void => callback(maximized)
    ipcRenderer.on(IPC.windowState, listener)
    return () => ipcRenderer.removeListener(IPC.windowState, listener)
  },
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
