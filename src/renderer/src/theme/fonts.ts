// Tipografías de cada estilo: se cargan solo las del estilo elegido (antes entraban las diez familias
// al abrir). Cambiar de estilo trae las del nuevo en el momento.

import type { AppSettings, StyleId } from '@shared/settings'

type FontId = 'jakarta' | 'mono' | 'plex' | 'bricolage' | 'atkinson' | 'literata' | 'nunito' | 'baloo'

const LOADERS: Record<FontId, () => Promise<unknown>> = {
  jakarta: () => import('@fontsource-variable/plus-jakarta-sans/index.css'),
  mono: () => import('@fontsource-variable/jetbrains-mono/index.css'),
  plex: () => Promise.all([import('@fontsource/ibm-plex-sans/400.css'), import('@fontsource/ibm-plex-sans/600.css')]),
  bricolage: () => import('@fontsource-variable/bricolage-grotesque/index.css'),
  atkinson: () => Promise.all([import('@fontsource/atkinson-hyperlegible/400.css'), import('@fontsource/atkinson-hyperlegible/700.css')]),
  literata: () => Promise.all([import('@fontsource-variable/literata/wght.css'), import('@fontsource-variable/literata/wght-italic.css')]),
  nunito: () => import('@fontsource-variable/nunito/index.css'),
  baloo: () => import('@fontsource-variable/baloo-2/index.css')
}

// Tienen que coincidir con las familias de styles.css.
const STYLE_FONTS: Record<StyleId, FontId[]> = {
  celeste: ['jakarta', 'mono'],
  ruta: ['plex', 'bricolage'],
  cuaderno: ['atkinson', 'literata'],
  racha: ['nunito', 'baloo'],
  noche: [],
  papel: ['literata'],
  contraste: ['atkinson'],
  original: []
}

const loaded = new Map<FontId, Promise<unknown>>()

function load(id: FontId): Promise<unknown> {
  let pending = loaded.get(id)
  if (!pending) {
    pending = LOADERS[id]().catch((err) => {
      loaded.delete(id)
      console.error(`No se pudo cargar la tipografía ${id}`, err)
    })
    loaded.set(id, pending)
  }
  return pending
}

export function fontsFor(settings: Pick<AppSettings, 'style' | 'font'>): FontId[] {
  const ids = [...STYLE_FONTS[settings.style]]
  if (settings.font === 'amigable' && !ids.includes('nunito')) ids.push('nunito')
  return ids
}

// Espera a que estén las hojas de las tipografías, con un tope para no demorar la apertura.
export function loadFonts(settings: Pick<AppSettings, 'style' | 'font'>, maxWaitMs = 500): Promise<void> {
  const all = Promise.all(fontsFor(settings).map(load)).then(() => document.fonts?.ready)
  return Promise.race([all, new Promise((resolve) => setTimeout(resolve, maxWaitMs))]).then(() => undefined)
}
