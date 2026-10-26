// Ajustes → Apariencia: estilo, tema, color, tipografía y el estilo propio.

import {
  contrast,
  contrastText,
  CUSTOM_RADII,
  FONTS,
  isDarkColor,
  PALETTES,
  STYLES,
  type AppSettings,
  type CustomRadius,
  type CustomStyle,
  type StylePreview
} from '@shared/settings'
import Logo from '../Logo'
import Segmented from '../Segmented'
import { useSettings } from '../../theme/SettingsProvider'
import { Row } from './common'

const FONT_FAMILIES: Record<string, string> = {
  estilo: 'var(--style-font)',
  moderna: 'var(--font-moderna)',
  clasica: 'var(--font-clasica)',
  amigable: 'var(--font-amigable)'
}

export function AppearanceSettings(): React.JSX.Element {
  const { settings, update, dark: isDark } = useSettings()
  const styleColors = (STYLES.find((s) => s.id === settings.style) ?? STYLES[0]).colors

  return (
    <>
      <section className="card stack">
        <h2>Apariencia</h2>

        <div className="stack-sm">
          <span>Estilo</span>
          <div className="style-grid" role="group" aria-label="Estilo">
            {STYLES.map((s) => (
              <button key={s.id} type="button" className="style-card" aria-pressed={s.id === settings.style} onClick={() => update({ style: s.id })}>
                <StyleThumb preview={s.id === 'personal' ? customPreview(settings.customStyle) : isDark ? s.preview.dark : s.preview.light} />
                <span className="style-head">
                  <Logo style={s.id} />
                  <span className="style-name">{s.label}</span>
                  {s.id === settings.style && <span className="badge ok">En uso</span>}
                </span>
                <span className="muted small">{s.description}</span>
              </button>
            ))}
          </div>
        </div>
        {settings.style === 'personal' && <CustomStyleEditor />}

        <Row label="Tema">
          <Segmented
            label="Tema"
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'system', label: 'Sistema' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Oscuro' }
            ]}
          />
        </Row>

        <Row label="Color">
          <div className="swatches" role="group" aria-label="Color">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                className="swatch"
                title={p.label}
                aria-label={p.label}
                aria-pressed={p.id === settings.palette}
                style={{
                  background: p.id === 'estilo' ? `linear-gradient(135deg, ${styleColors[0]} 50%, ${styleColors[1]} 50%)` : isDark ? p.dark : p.light
                }}
                onClick={() => update({ palette: p.id })}
              />
            ))}
          </div>
        </Row>

        <Row label="Tipografía">
          <Segmented
            label="Tipografía"
            value={settings.font}
            onChange={(font) => update({ font })}
            options={FONTS.map((f) => ({ value: f.id, label: f.label, style: { fontFamily: FONT_FAMILIES[f.id] } }))}
          />
        </Row>

        <Row label="Tamaño de letra">
          <Segmented<AppSettings['fontSize']>
            label="Tamaño de letra"
            value={settings.fontSize}
            onChange={(fontSize) => update({ fontSize })}
            options={[
              { value: 'sm', label: 'Chica' },
              { value: 'md', label: 'Mediana' },
              { value: 'lg', label: 'Grande' }
            ]}
          />
        </Row>

        <Row label="Espaciado">
          <Segmented<AppSettings['density']>
            label="Espaciado"
            value={settings.density}
            onChange={(density) => update({ density })}
            options={[
              { value: 'compact', label: 'Compacto' },
              { value: 'comfortable', label: 'Cómodo' }
            ]}
          />
        </Row>

        <Row label="Animaciones">
          <Segmented<'full' | 'reduce'>
            label="Animaciones"
            value={settings.reduceMotion ? 'reduce' : 'full'}
            onChange={(motion) => update({ reduceMotion: motion === 'reduce' })}
            options={[
              { value: 'full', label: 'Normales' },
              { value: 'reduce', label: 'Reducidas' }
            ]}
          />
        </Row>

        <Row label="Sonidos">
          <Segmented<'on' | 'off'>
            label="Sonidos"
            value={settings.sounds ? 'on' : 'off'}
            onChange={(v) => update({ sounds: v === 'on' })}
            options={[
              { value: 'off', label: 'Apagados' },
              { value: 'on', label: 'Prendidos' }
            ]}
          />
        </Row>

        <Row label="Pantalla de carga">
          <Segmented<AppSettings['splash']>
            label="Pantalla de carga"
            value={settings.splash}
            onChange={(splash) => update({ splash })}
            options={[
              { value: 'full', label: 'Completa' },
              { value: 'short', label: 'Breve' },
              { value: 'none', label: 'Ninguna' }
            ]}
          />
        </Row>

        <div className="preview" aria-label="Vista previa">
          <span className="level">VISTA PREVIA</span>
          <p>
            <strong>She is my sister.</strong> <span className="muted">— Ella es mi hermana.</span>
          </p>
          <div className="row">
            <button type="button" className="btn">
              Practicar
            </button>
            <button type="button" className="btn secondary">
              Leer el resumen
            </button>
            <span className="badge ok">Aprobado</span>
          </div>
        </div>
      </section>
    </>
  )
}

// Miniatura de la app con los colores de un estilo: barra lateral, título, una tarjeta y un botón.
// Miniatura del estilo propio con sus colores (los mismos tonos que calcula styles.css).
function customPreview(custom: CustomStyle): StylePreview {
  const dark = isDarkColor(custom.bg)
  const mix = (amount: number, other: string): string => `color-mix(in srgb, ${custom.bg} ${amount}%, ${other})`
  return {
    bg: custom.bg,
    sidebar: dark ? mix(88, '#ffffff') : mix(35, '#ffffff'),
    surface: dark ? mix(88, '#ffffff') : mix(35, '#ffffff'),
    accent: custom.accent,
    text: dark ? '#ececf0' : '#1d1d1f',
    border: dark ? mix(70, '#ffffff') : mix(80, '#000000')
  }
}

// Editor del estilo propio: fondo, acento y bordes, con la app entera como vista previa.
function CustomStyleEditor(): React.JSX.Element {
  const { settings, update } = useSettings()
  const custom = settings.customStyle
  const set = (patch: Partial<CustomStyle>): void => update({ customStyle: { ...custom, ...patch } })
  const dark = isDarkColor(custom.bg)
  const accentContrast = contrast(custom.accent, custom.bg)

  return (
    <div className="custom-style stack-sm">
      <div className="row custom-colors">
        <label className="color-field">
          <input type="color" value={custom.bg} onChange={(e) => set({ bg: e.target.value })} />
          <span>Fondo</span>
        </label>
        <label className="color-field">
          <input type="color" value={custom.accent} onChange={(e) => set({ accent: e.target.value })} />
          <span>Acento</span>
        </label>
        <Segmented<CustomRadius>
          label="Bordes"
          value={custom.radius}
          onChange={(radius) => set({ radius })}
          options={(Object.keys(CUSTOM_RADII) as CustomRadius[]).map((r) => ({
            value: r,
            label: r === 'square' ? 'Rectos' : r === 'soft' ? 'Suaves' : 'Redondeados'
          }))}
        />
      </div>
      <div
        className="custom-sample"
        style={{ background: custom.bg, color: dark ? '#ececf0' : '#1d1d1f', borderRadius: CUSTOM_RADII[custom.radius] }}
      >
        <span>Así se ve el texto</span>
        <span
          className="custom-sample-btn"
          style={{ background: custom.accent, color: contrastText(custom.accent), borderRadius: CUSTOM_RADII[custom.radius] }}
        >
          Botón
        </span>
      </div>
      <p className="muted small">
        Con un fondo {dark ? 'oscuro' : 'claro'} la app usa letras {dark ? 'claras' : 'oscuras'}. La tipografía se elige más abajo.
        {accentContrast < 3 && ' Ojo: el acento se distingue poco del fondo; probá uno más oscuro o más claro.'}
      </p>
    </div>
  )
}

function StyleThumb({ preview }: { preview: StylePreview }): React.JSX.Element {
  return (
    <span className="style-thumb" style={{ background: preview.bg, borderColor: preview.border }} aria-hidden="true">
      <span className="thumb-side" style={{ background: preview.sidebar }}>
        <i style={{ background: preview.accent }} />
        <i />
        <i />
        <i />
      </span>
      <span className="thumb-main">
        <span className="thumb-title" style={{ background: preview.text }} />
        <span className="thumb-card" style={{ background: preview.surface, borderColor: preview.border }}>
          <span className="thumb-line" style={{ background: preview.text }} />
          <span className="thumb-line short" style={{ background: preview.text }} />
          <span className="thumb-btn" style={{ background: preview.accent }} />
        </span>
      </span>
    </span>
  )
}
