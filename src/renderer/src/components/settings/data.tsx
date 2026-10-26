// Ajustes → Datos: copias, exportar, importar y borrar.

import { useCallback, useEffect, useState } from 'react'
import { type BackupInfo } from '@shared/data'
import { formatDayMonth } from '@shared/dates'

// Copias de seguridad, exportar e importar, y borrar todo con la explicación de qué se pierde.
export function DataSettings(): React.JSX.Element {
  const [backups, setBackups] = useState<BackupInfo[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'delete' | `restore:${string}` | null>(null)

  const load = useCallback(() => {
    window.api
      .getBackups()
      .then(setBackups)
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  const act = (action: () => Promise<unknown>, done?: string): void => {
    setError(null)
    setMessage(null)
    action()
      .then((result) => {
        if (done) setMessage(typeof result === 'string' ? `${done} ${result}` : done)
        load()
      })
      .catch((err: Error) => setError(err.message))
  }

  return (
    <>
      <section className="card stack">
        <h2>Copias de seguridad</h2>
        <p className="muted small">
          Todos los días, al abrir la app, se guarda una copia de cada curso. Quedan las últimas siete. Restaurar una vuelve todo (progreso, ajustes,
          vocabulario, diario) a ese día y reinicia la app.
        </p>
        {backups && backups.length === 0 && (
          <p className="muted small">Todavía no hay copias: la primera se hace unos segundos después de abrir la app.</p>
        )}
        {backups && backups.length > 0 && (
          <ul className="backup-list">
            {backups.map((b) => (
              <li key={b.date} className="row spread">
                <span>
                  <strong>{formatDayMonth(b.date)}</strong>{' '}
                  <span className="muted small">
                    · {b.courses} {b.courses === 1 ? 'curso' : 'cursos'} ·{' '}
                    {(b.size / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB
                  </span>
                </span>
                {confirm === `restore:${b.date}` ? (
                  <span className="row">
                    <button className="btn" onClick={() => act(() => window.api.restoreBackup(b.date))}>
                      Sí, restaurar
                    </button>
                    <button className="btn secondary" onClick={() => setConfirm(null)}>
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button className="btn secondary" onClick={() => setConfirm(`restore:${b.date}`)}>
                    Restaurar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div>
          <button className="btn secondary" onClick={() => act(() => window.api.backupNow(), 'Copia guardada.')}>
            Hacer una copia ahora
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>Pasar el progreso a otra computadora</h2>
        <p className="muted small">
          Exportar guarda todo en un solo archivo .enhome. En la otra computadora, «Importar» lo trae (antes guarda una copia de lo que había) y
          reinicia la app.
        </p>
        <div className="row">
          <button className="btn" onClick={() => act(() => window.api.exportData(), 'Exportado en')}>
            Exportar
          </button>
          <button className="btn secondary" onClick={() => act(() => window.api.importData())}>
            Importar…
          </button>
        </div>
      </section>

      <section className="card stack danger-zone">
        <h2>Borrar todo</h2>
        <div className="delete-explain">
          <div>
            <strong>Se borra</strong>
            <ul>
              <li>El progreso de los cuatro cursos: semanas, prácticas, exámenes, racha, experiencia y logros.</li>
              <li>Repaso, vocabulario, lecturas, diario, charlas, resaltados y partidas.</li>
              <li>Tus ajustes y tus comentarios.</li>
            </ul>
          </div>
          <div>
            <strong>Queda</strong>
            <ul>
              <li>Las copias de seguridad (antes de borrar se guarda una más, por si te arrepentís).</li>
              <li>El modelo de reconocimiento de voz descargado.</li>
              <li>El temario, que viene con la app.</li>
            </ul>
          </div>
        </div>
        <p className="muted small">Para empezar de cero un solo idioma, usá «Reiniciar» en Estudio → Cursos.</p>
        {confirm === 'delete' ? (
          <div className="row">
            <button className="btn danger" onClick={() => act(() => window.api.deleteAllData())}>
              Sí, borrar todo y reiniciar
            </button>
            <button className="btn secondary" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
          </div>
        ) : (
          <div>
            <button className="btn secondary" onClick={() => setConfirm('delete')}>
              Borrar todo…
            </button>
          </div>
        )}
      </section>
      {message && <p className="muted small">{message}</p>}
      {error && <p className="error">{error}</p>}
    </>
  )
}
