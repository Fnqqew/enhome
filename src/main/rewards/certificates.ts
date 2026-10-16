// Certificados de nivel: el estado de cada nivel del curso y el diploma (HTML para ver y para el PDF).

import { CEFR_LEVEL_NAMES, CEFR_LEVELS, type CurriculumTopic } from '../../shared/curriculum'
import type { CertificateView } from '../../shared/certificates'
import { languageInfo, type LanguageId } from '../../shared/languages'
import type { Db } from '../db/database'

interface ProgressRow {
  topic_id: string
  status: string
  best_grade: number | null
  passed_at: string | null
}

export function certificates(db: Db, curriculum: CurriculumTopic[]): CertificateView[] {
  const rows = db.prepare('SELECT topic_id, status, best_grade, passed_at FROM topic_progress').all() as unknown as ProgressRow[]
  const byId = new Map(rows.map((r) => [r.topic_id, r]))
  const passed = (id: string): boolean => ['passed', 'review'].includes(byId.get(id)?.status ?? '')

  return CEFR_LEVELS.flatMap((level) => {
    const topics = curriculum.filter((t) => t.level === level)
    if (topics.length === 0) return []
    const done = topics.filter((t) => passed(t.id))
    const grades = done.map((t) => byId.get(t.id)?.best_grade).filter((g): g is number => g !== null && g !== undefined)
    const dates = done.map((t) => byId.get(t.id)?.passed_at?.slice(0, 10)).filter((d): d is string => !!d)
    const complete = done.length === topics.length
    return [
      {
        level,
        levelName: CEFR_LEVEL_NAMES[level],
        complete,
        passedTopics: done.length,
        totalTopics: topics.length,
        completedOn: complete && dates.length > 0 ? dates.sort().at(-1)! : null,
        average: grades.length > 0 ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 10) / 10 : null,
        topics: topics.map((t) => ({ title: t.title, grade: byId.get(t.id)?.best_grade ?? null }))
      }
    ]
  })
}

const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const longDate = (date: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

// El diploma como una página A4 apaisada, con su propio estilo (no depende del tema de la app).
export function certificateHtml(cert: CertificateView, language: LanguageId, studentName: string): string {
  const info = languageInfo(language)
  const name = studentName.trim() || 'Estudiante de Enhome'
  const rows = cert.topics
    .map((t) => `<tr><td>${escape(t.title)}</td><td>${t.grade === null ? '—' : t.grade.toLocaleString('es-AR')}</td></tr>`)
    .join('')
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Certificado ${cert.level}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1d232c; background: #fbf9f4; }
  .sheet { position: relative; width: 297mm; height: 210mm; padding: 16mm 22mm; display: flex; flex-direction: column; }
  .frame { position: absolute; inset: 8mm; border: 1.5px solid ${info.color}; border-radius: 6mm; }
  .frame::after { content: ''; position: absolute; inset: 2.5mm; border: 0.5px solid ${info.color}55; border-radius: 4.5mm; }
  header { display: flex; justify-content: space-between; align-items: baseline; font-family: 'Segoe UI', system-ui, sans-serif; }
  .brand { font-weight: 700; font-size: 15pt; letter-spacing: 0.02em; }
  .brand b { color: ${info.color}; }
  .kind { font-size: 9pt; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; }
  main { flex: 1; display: grid; grid-template-columns: 1.25fr 1fr; gap: 14mm; align-items: center; }
  h1 { margin: 0 0 4mm; font-size: 30pt; font-weight: 400; line-height: 1.1; }
  .level { display: inline-block; margin-bottom: 6mm; padding: 1.5mm 5mm; border-radius: 99px; background: ${info.color}; color: #fff;
    font-family: 'Segoe UI', system-ui, sans-serif; font-weight: 700; font-size: 13pt; letter-spacing: 0.06em; }
  .name { margin: 0; font-size: 26pt; font-style: italic; border-bottom: 1px solid #c9c2b4; padding-bottom: 2mm; }
  p { font-size: 11.5pt; line-height: 1.55; color: #3d4450; }
  table { width: 100%; border-collapse: collapse; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 9.5pt; }
  td { padding: 1.8mm 0; border-bottom: 0.5px solid #ddd6c8; }
  td + td { text-align: right; font-weight: 600; width: 16mm; }
  .average { margin-top: 4mm; display: flex; justify-content: space-between; font-family: 'Segoe UI', system-ui, sans-serif; font-weight: 700; }
  footer { display: flex; justify-content: space-between; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 9pt; color: #6b7280; }
</style></head>
<body><div class="sheet"><div class="frame"></div>
  <header><span class="brand"><b>En</b>home</span><span class="kind">Certificado de nivel</span></header>
  <main>
    <section>
      <span class="level">${cert.level} · ${escape(cert.levelName)}</span>
      <h1>Curso de ${escape(info.name)}</h1>
      <p class="name">${escape(name)}</p>
      <p>Completó y aprobó los ${cert.totalTopics} tópicos del nivel ${cert.level}, con práctica diaria, exámenes semanales
      y repasos, ${cert.completedOn ? `el ${longDate(cert.completedOn)}` : 'en Enhome'}.</p>
    </section>
    <section>
      <table>${rows}</table>
      <div class="average"><span>Promedio de exámenes</span><span>${cert.average === null ? '—' : cert.average.toLocaleString('es-AR')}</span></div>
    </section>
  </main>
  <footer><span>${escape(info.greeting)} · Aprender idiomas en casa, de a un tópico por semana</span><span>Enhome</span></footer>
</div></body></html>`
}
