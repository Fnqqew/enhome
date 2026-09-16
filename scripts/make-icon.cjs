// Genera el ícono de la app (logo Celeste) con Electron, que dibuja el SVG con la tipografía real.
// Uso: npm run icon  → build/icon.ico (instalador y ejecutable) y resources/icon.png (ventana).
const { app, BrowserWindow } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const root = join(__dirname, '..')
const RENDER = 512
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
// Hasta 32 px las letras no se leen: esos tamaños van solo con los globos.
const TEXT_FROM = 40

function logo(withText) {
  const font = "'Plus Jakarta Sans', sans-serif"
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect x="1" y="1" width="62" height="62" rx="14" fill="#FFFFFF" stroke="#D5E2EE" stroke-width="2"/>
    <path d="M11 12h24a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H22l-7 6v-6h-4a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" fill="#4BA3E3"/>
    <path d="M53 25H31a6 6 0 0 0-6 6v12a6 6 0 0 0 6 6h12l7 6v-6h3a6 6 0 0 0 6-6V31a6 6 0 0 0-6-6z" fill="#0B3C6D"/>
    ${withText ? `<text x="14" y="29" font-family="${font}" font-weight="800" font-size="11" fill="#fff">ES</text>
    <text x="34" y="42" font-family="${font}" font-weight="800" font-size="11" fill="#fff">EN</text>` : ''}
    <circle cx="54" cy="12" r="4" fill="#F2B33D"/>
  </svg>`
}

async function render(win, withText) {
  const fontUrl = pathToFileURL(
    join(root, 'node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2')
  ).href
  const html = `<!doctype html><style>
    @font-face { font-family: 'Plus Jakarta Sans'; src: url('${fontUrl}') format('woff2'); font-weight: 200 800; }
    html, body { margin: 0; background: transparent; overflow: hidden; }
    /* El escalado de pantalla de Windows cambia el tamaño real: el logo ocupa el lado menor visible. */
    svg { display: block; width: 100vmin; height: 100vmin; }
  </style>${logo(withText)}`
  const htmlPath = join(app.getPath('temp'), `proyecto-ingles-icon-${withText ? 'texto' : 'simple'}.html`)
  writeFileSync(htmlPath, html)

  await win.loadFile(htmlPath)
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => document.fonts.size)')
  await new Promise((resolve) => setTimeout(resolve, 300))
  const image = await win.webContents.capturePage()
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
    const full = await render(win, true)
    const simple = await render(win, false)
    const png = (size) => (size >= TEXT_FROM ? full : simple).resize({ width: size, height: size, quality: 'best' }).toPNG()

    mkdirSync(join(root, 'build'), { recursive: true })
    mkdirSync(join(root, 'resources'), { recursive: true })
    writeFileSync(join(root, 'build/icon.ico'), buildIco(ICO_SIZES.map((size) => ({ size, data: png(size) }))))
    writeFileSync(join(root, 'resources/icon.png'), png(256))
    console.log(`Ícono generado desde ${full.getSize().width} px: build/icon.ico y resources/icon.png`)
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    win.destroy()
    app.quit()
  }
})
