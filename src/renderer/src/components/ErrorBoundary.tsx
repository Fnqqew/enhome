import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

// Si una pantalla falla, se muestra un aviso con la opción de recargar en lugar de una ventana en blanco.
// El progreso está en la base de datos: recargar no pierde nada.
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error en la interfaz', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <main className="centered">
        <div className="card stack crash">
          <h1>Algo salió mal</h1>
          <p>Esta pantalla tuvo un problema. Tu progreso está guardado: recargá la app para seguir.</p>
          <p className="muted small">{this.state.error.message}</p>
          <div>
            <button className="btn" onClick={() => window.location.reload()}>
              Recargar
            </button>
          </div>
        </div>
      </main>
    )
  }
}
