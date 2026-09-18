// Genera los íconos de la app con Electron, que dibuja los SVG con las tipografías reales.
// Uso: npm run icon
//   build/icon.ico + resources/icon.png          → ícono del instalador y del ejecutable (estilo Celeste)
//   build/icons/<estilo>.ico                     → accesos directos, que cambian con el estilo elegido
//   resources/icons/<estilo>.png                 → ícono de la ventana y la barra de tareas
const { app, BrowserWindow } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const LOGOS = require('../src/shared/logos.json')

const root = join(__dirname, '..')
const RENDER = 512
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
// Hasta 32 px las letras no se leen: esos tamaños van sin texto.
const TEXT_FROM = 40

const FONTS = {
  'Plus Jakarta Sans': '@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2',
  Literata: '@fontsource-variable/literata/files/literata-latin-wght-italic.woff2'
}

function page(style, withText) {
  // El texto se saca en los tamaños chicos, donde sería una mancha.
  const mark = withText ? LOGOS[style] : LOGOS[style].replace(/<text[\s\S]*?<\/text>/g, '')
  const faces = Object.entries(FONTS)
    .map(([family, file]) => {
      const url = pathToFileURL(join(root, 'node_modules', file)).href
      return `@font-face { font-family: '${family}'; src: url('${url}') format('woff2'); font-weight: 200 800; font-style: italic; }
              @font-face { font-family: '${family}'; src: url('${url}') format('woff2'); font-weight: 200 800; }`
    })
    .join('\n')
  return `<!doctype html><style>
    ${faces}
    html, body { margin: 0; background: transparent; overflow: hidden; }
    /* El escalado de pantalla de Windows cambia el tamaño real: el logo ocupa el lado menor visible. */
    svg { display: block; width: 100vmin; height: 100vmin; }
  </style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${mark}</svg>`
}

async function render(win, style, withText) {
  const htmlPath = join(app.getPath('temp'), `enhome-icon-${style}-${withText ? 'texto' : 'simple'}.html`)
  writeFileSync(htmlPath, page(style, withText))

  await win.loadFile(htmlPath)
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => document.fonts.size)')

  // La primera captura a veces falla mientras la ventana todavía no compuso nada.
  let image = null
  for (let intento = 0; intento < 3 && !image; intento++) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    image = await win.webContents.capturePage().catch(() => null)
  }
  if (!image) throw new Error(`No se pudo capturar el logo de ${style}`)
  const { width, height } = image.getSize()
  const side = Math.min(width, height)
  return image.crop({ x: 0, y: 0, width: side, height: side })
}

// ICO con cada tamaño guardado como PNG (formato admitido desde Windows Vista).
function buildIco(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length
  pngs.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(data.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...pngs.map((p) => p.data)])
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: RENDER,
    height: RENDER,
    show: false,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true }
  })
  try {
    mkdirSync(join(root, 'build/icons'), { recursive: true })
    mkdirSync(join(root, 'resources/icons'), { recursive: true })

    for (const style of Object.keys(LOGOS)) {
      const full = await render(win, style, true)
      const simple = await render(win, style, false)
      const png = (size) => (size >= TEXT_FROM ? full : simple).resize({ width: size, height: size, quality: 'best' }).toPNG()

      writeFileSync(join(root, 'build/icons', `${style}.ico`), buildIco(ICO_SIZES.map((size) => ({ size, data: png(size) }))))
      writeFileSync(join(root, 'resources/icons', `${style}.png`), png(256))
      // El instalador y el ejecutable llevan el ícono del estilo predeterminado.
      if (style === 'celeste') {
        writeFileSync(join(root, 'build/icon.ico'), buildIco(ICO_SIZES.map((size) => ({ size, data: png(size) }))))
        writeFileSync(join(root, 'resources/icon.png'), png(256))
      }
      console.log(`Ícono de ${style} generado`)
    }
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    win.destroy()
    app.quit()
  }
})
