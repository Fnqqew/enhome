// Compila el instalador y actualiza la app instalada en esta compu: npm run update-local
// Cierra Enhome si está abierta, instala en silencio encima de la versión anterior (el progreso
// vive aparte, en %APPDATA%\enhome) y la vuelve a abrir.
// Opciones: --sin-compilar (usa el instalador que ya está en dist/) · --sin-abrir

const { execFileSync, execSync, spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
const { version } = require(join(root, 'package.json'))
const installer = join(root, 'dist', `enhome-${version}-setup.exe`)
const installed = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Enhome', 'Enhome.exe')
const flag = (name) => process.argv.includes(name)

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const running = () => execFileSync('tasklist', ['/FI', 'IMAGENAME eq Enhome.exe', '/NH'], { encoding: 'utf8' }).includes('Enhome.exe')

if (!flag('--sin-compilar')) execSync('npm run dist', { cwd: root, stdio: 'inherit' })
if (!existsSync(installer)) {
  console.error(`No está el instalador ${installer}. Corré npm run dist.`)
  process.exit(1)
}

if (running()) {
  console.log('Cerrando Enhome…')
  // La base guarda cada cambio al momento: cerrarla de golpe no pierde progreso.
  execFileSync('taskkill', ['/IM', 'Enhome.exe', '/T', '/F'], { stdio: 'ignore' })
  for (let i = 0; i < 20 && running(); i++) sleep(250)
}

console.log(`Instalando Enhome ${version}…`)
execFileSync(installer, ['/S'], { stdio: 'inherit' })
console.log(`Listo: ${installed}`)

if (!flag('--sin-abrir') && existsSync(installed)) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  spawn(installed, [], { detached: true, stdio: 'ignore', env }).unref()
}
