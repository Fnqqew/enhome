// Corre una herramienta escrita en TypeScript (scripts/*.ts) sin compilar el proyecto entero:
// la empaqueta con esbuild en out/tools/ y la ejecuta. Uso: node scripts/run-ts.mjs scripts/x.ts [argumentos]

import { build } from 'esbuild'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [entry, ...args] = process.argv.slice(2)
if (!entry) {
  console.error('Uso: node scripts/run-ts.mjs scripts/herramienta.ts [argumentos]')
  process.exit(1)
}
const root = resolve(import.meta.dirname, '..')
const outfile = join(root, 'out', 'tools', basename(entry).replace(/\.ts$/, '.mjs'))
await build({
  entryPoints: [resolve(entry)],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile,
  // Los paquetes se cargan de node_modules (out/tools está dentro del proyecto).
  packages: 'external',
  alias: { '@shared': join(root, 'src', 'shared') },
  logLevel: 'warning'
})
process.argv = [process.argv[0], outfile, ...args]
await import(pathToFileURL(outfile).href)
