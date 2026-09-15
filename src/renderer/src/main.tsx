import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { SettingsProvider } from './theme/SettingsProvider'
import './styles/base.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </SettingsProvider>
  </StrictMode>
)
