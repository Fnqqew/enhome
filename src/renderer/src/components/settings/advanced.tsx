// Ajustes → Avanzado.

import { useState } from 'react'
import { writeLocal } from '../../shell'

// Avanzado: registro de errores, carpeta de datos y volver a ver la bienvenida.
export function AdvancedSettings(): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const open = (action: () => Promise<void>): void => {
    setMessage(null)
    action().catch((err: Error) => setMessage(err.message))
  }
  return (
    <section className="card stack">
      <h2>Avanzado</h2>
      <div className="row">
        <button className="btn secondary" onClick={() => open(window.api.openLogFile)}>
          Abrir registro de errores
        </button>
        <button className="btn secondary" onClick={() => open(window.api.openDataFolder)}>
          Abrir carpeta de datos
        </button>
        <button
          className="btn secondary"
          onClick={() => {
            for (const id of ['en', 'pt', 'it', 'fr']) writeLocal(`tour:${id}`, '')
            writeLocal('version', '')
            setMessage('Listo: la bienvenida y las novedades vuelven a aparecer la próxima vez que abras la app.')
          }}
        >
          Volver a ver la bienvenida
        </button>
      </div>
      {message && <p className="muted small">{message}</p>}
      <p className="muted small">Los tiempos de cada tarea de Claude y los datos técnicos están en Acerca de.</p>
    </section>
  )
}
