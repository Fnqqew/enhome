// Las miniaturas de Ajustes y el fondo de la ventana usan colores escritos en settings.ts:
// este test verifica que sigan coincidiendo con los de las hojas de estilo.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STYLES, type StylePreview } from '../src/shared/settings'

const stylesDir = join(__dirname, '..', 'src', 'renderer', 'src', 'styles')
const base = readFileSync(join(stylesDir, 'base.css'), 'utf8')
const styles = readFileSync(join(stylesDir, 'styles.css'), 'utf8')

// Las variables de un bloque cuyo selector es exactamente el pedido.
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return {}
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()]))
}

function tokens(id: string, dark: boolean): Partial<StylePreview> {
  // Lo que define la base, pisado por lo del estilo.
  const merged = {
    ...block(base, ':root'),
    ...(dark ? block(base, ":root[data-theme='dark']") : {}),
    ...block(styles, `:root[data-style='${id}']`),
    ...(dark ? block(styles, `:root[data-style='${id}'][data-theme='dark']`) : {})
  }
  const sidebar = merged['--sidebar-bg']?.startsWith('#') ? merged['--sidebar-bg'] : merged['--surface']
  return { bg: merged['--bg'], accent: merged['--accent'], sidebar, surface: merged['--surface'] }
}

describe('vista previa de los estilos', () => {
  for (const style of STYLES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${style.label} en ${mode === 'dark' ? 'oscuro' : 'claro'} coincide con la hoja de estilo`, () => {
        const css = tokens(style.id, mode === 'dark')
        const preview = style.preview[mode]
        expect(preview.bg).toBe(css.bg)
        expect(preview.sidebar).toBe(css.sidebar)
        expect(preview.surface).toBe(css.surface)
        expect(preview.accent).toBe(css.accent)
      })
    }
  }
})
