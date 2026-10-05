import { useEffect, useState } from 'react'

// Barra de la ventana propia: se arrastra desde cualquier parte y los tres botones van a la derecha,
// en el orden de Windows: minimizar, maximizar y cerrar.
export default function TitleBar({ title }: { title: string }): React.JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => window.api.onWindowState(setMaximized), [])

  return (
    <div className="titlebar" onDoubleClick={() => window.api.toggleMaximizeWindow()}>
      <span className="titlebar-title">{title}</span>
      <div className="window-buttons">
        <button
          type="button"
          className="win-btn minimize"
          aria-label="Minimizar"
          title="Minimizar"
          onClick={() => window.api.minimizeWindow()}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2.5 5h5" />
          </svg>
        </button>
        <button
          type="button"
          className="win-btn maximize"
          aria-label={maximized ? 'Restaurar' : 'Maximizar'}
          title={maximized ? 'Restaurar' : 'Maximizar'}
          onClick={() => window.api.toggleMaximizeWindow()}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            {maximized ? <path d="M3 3h4v4H3z" /> : <path d="M2.5 2.5h5v5h-5z" />}
          </svg>
        </button>
        <button type="button" className="win-btn close" aria-label="Cerrar" title="Cerrar" onClick={() => window.api.closeWindow()}>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M3 3l4 4M7 3l-4 4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
