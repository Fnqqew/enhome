// Ajustes → Notificaciones: recordatorio, bandeja y arranque con Windows.

import Segmented from '../Segmented'
import { useSettings } from '../../theme/SettingsProvider'
import { Row } from './common'

// Recordatorio diario, bandeja del sistema y arranque con Windows.
export function NotificationSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  return (
    <section className="card stack">
      <h2>Notificaciones</h2>
      <Row label="Recordatorio diario">
        <Segmented<'on' | 'off'>
          label="Recordatorio diario"
          value={settings.reminderEnabled ? 'on' : 'off'}
          onChange={(v) => update({ reminderEnabled: v === 'on' })}
          options={[
            { value: 'off', label: 'Apagado' },
            { value: 'on', label: 'Prendido' }
          ]}
        />
      </Row>
      {settings.reminderEnabled && (
        <Row label="A las">
          <input
            type="time"
            className="time-input"
            value={settings.reminderTime}
            onChange={(e) => e.target.value && update({ reminderTime: e.target.value })}
          />
        </Row>
      )}
      <p className="muted small">
        Una notificación de Windows a esa hora si todavía no hiciste la práctica del día o no llegaste a tu meta, y otra a las 23 si la meta sigue
        pendiente. Para que lleguen, la app tiene que estar abierta (o en la bandeja).
      </p>
      <Row label="Al cerrar la ventana">
        <Segmented<'tray' | 'quit'>
          label="Al cerrar la ventana"
          value={settings.tray ? 'tray' : 'quit'}
          onChange={(v) => update({ tray: v === 'tray' })}
          options={[
            { value: 'quit', label: 'Cerrar la app' },
            { value: 'tray', label: 'Quedar en la bandeja' }
          ]}
        />
      </Row>
      <Row label="Arrancar con Windows">
        <Segmented<'on' | 'off'>
          label="Arrancar con Windows"
          value={settings.startWithWindows ? 'on' : 'off'}
          onChange={(v) => update({ startWithWindows: v === 'on' })}
          options={[
            { value: 'off', label: 'No' },
            { value: 'on', label: 'Sí' }
          ]}
        />
      </Row>
      <p className="muted small">Al arrancar con Windows la app abre escondida en la bandeja (si está activa), lista para el recordatorio.</p>
    </section>
  )
}
