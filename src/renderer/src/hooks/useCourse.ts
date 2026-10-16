import { languageInfo, type LanguageInfo } from '@shared/languages'
import { useSettings } from '../theme/SettingsProvider'

// El idioma del curso que se está viendo: nombre, color, voces y saludo.
export function useCourse(): LanguageInfo {
  const { settings } = useSettings()
  return languageInfo(settings.language)
}
