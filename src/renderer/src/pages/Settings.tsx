import { useEffect, useState } from 'react'
import type { ClaudeStatus } from '@shared/ipc'
import { readLocal, writeLocal } from '../shell'
import { AdvancedSettings } from '../components/settings/advanced'
import { AppearanceSettings } from '../components/settings/appearance'
import { ClaudeConnection, ClaudeModeSettings } from '../components/settings/claude'
import { DataSettings } from '../components/settings/data'
import { NotificationSettings } from '../components/settings/notifications'
import { CourseSettings, GoalSettings, PracticeSettings } from '../components/settings/study'
import { NeuralVoiceSettings, SpeechModelSettings, VoiceSettings } from '../components/settings/voice'

const TABS = [
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'estudio', label: 'Estudio' },
  { id: 'voz', label: 'Voz' },
  { id: 'avisos', label: 'Notificaciones' },
  { id: 'datos', label: 'Datos' },
  { id: 'claude', label: 'Claude' },
  { id: 'avanzado', label: 'Avanzado' }
] as const

type TabId = (typeof TABS)[number]['id']

// Ajustes por pestañas; la última que se abrió se recuerda.
export default function Settings({ status }: { status: Extract<ClaudeStatus, { state: 'ready' }> }): React.JSX.Element {
  const [tab, setTab] = useState<TabId>(() => {
    const saved = readLocal('settings-tab')
    return TABS.some((t) => t.id === saved) ? (saved as TabId) : 'apariencia'
  })
  useEffect(() => writeLocal('settings-tab', tab), [tab])

  return (
    <>
      <h1>Ajustes</h1>
      <div className="tabs" role="tablist" aria-label="Ajustes">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" key={tab} className="tab-panel">
        {tab === 'apariencia' && <AppearanceSettings />}
        {tab === 'estudio' && (
          <>
            <PracticeSettings />
            <GoalSettings />
            <CourseSettings />
          </>
        )}
        {tab === 'voz' && (
          <>
            <NeuralVoiceSettings />
            <VoiceSettings />
            <SpeechModelSettings />
          </>
        )}
        {tab === 'avisos' && <NotificationSettings />}
        {tab === 'datos' && <DataSettings />}
        {tab === 'claude' && (
          <>
            <ClaudeConnection status={status} />
            <ClaudeModeSettings />
          </>
        )}
        {tab === 'avanzado' && <AdvancedSettings />}
      </div>
    </>
  )
}
