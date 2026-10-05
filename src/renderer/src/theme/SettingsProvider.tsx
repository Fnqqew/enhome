import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, PALETTES, type AppSettings } from '@shared/settings'

interface SettingsContextValue {
  settings: AppSettings
  update: (patch: Partial<AppSettings>) => void
  // Si la app se ve en oscuro ahora mismo (resuelve «Sistema» con la preferencia de Windows).
  dark: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)
const DARK_QUERY = '(prefers-color-scheme: dark)'

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia(DARK_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (e: MediaQueryListEvent): void => setDark(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return dark
}

// Carga las preferencias guardadas y las aplica como atributos y variables CSS en <html>.
export function SettingsProvider({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const prefersDark = usePrefersDark()

  useEffect(() => {
    window.api
      .getSettings()
      .then(setSettings)
      .catch((err) => console.error('No se pudieron cargar las preferencias', err))
      .finally(() => setLoaded(true))
  }, [])

  const dark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark)

  useEffect(() => {
    const root = document.documentElement
    const theme = dark ? 'dark' : 'light'
    const palette = PALETTES.find((p) => p.id === settings.palette) ?? PALETTES[0]
    root.dataset.theme = theme
    root.dataset.style = settings.style
    root.dataset.palette = settings.palette
    root.dataset.font = settings.font
    root.dataset.size = settings.fontSize
    root.dataset.density = settings.density
    root.dataset.motion = settings.reduceMotion ? 'reduce' : 'full'
    // «Del estilo» deja el color que define el CSS de cada estilo.
    if (palette.id === 'estilo') root.style.removeProperty('--accent')
    else root.style.setProperty('--accent', theme === 'dark' ? palette.dark : palette.light)
  }, [settings, dark])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...patch }))
    window.api
      .updateSettings(patch)
      .then(setSettings)
      .catch((err) => {
        console.error('No se pudo guardar la preferencia', err)
        window.api.getSettings().then(setSettings)
      })
  }, [])

  if (!loaded) return null
  return <SettingsContext.Provider value={{ settings, update, dark }}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider')
  return ctx
}
