// Busca versiones nuevas en las publicaciones del repo y las instala.
// El repo es privado: se consulta con la CLI de GitHub (gh) si está instalada y con sesión; si no,
// se prueba sin sesión (sirve si el repo se hace público).

import { execFile, spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { compareVersions, type UpdateInfo } from '../shared/updates'

export const REPO = 'Fnqqew/enhome'

const releaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.string(),
  body: z.string().nullable().optional(),
  assets: z.array(z.object({ name: z.string() })).default([])
})
type Release = z.infer<typeof releaseSchema>

function gh(args: string[], timeout = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) =>
      error ? reject(new Error(stderr.trim() || error.message)) : resolve(stdout)
    )
  })
}

let ghWorks = false

async function latestRelease(): Promise<Release> {
  try {
    const release = releaseSchema.parse(JSON.parse(await gh(['api', `repos/${REPO}/releases/latest`])))
    ghWorks = true
    return release
  } catch (error) {
    ghWorks = false
    // Con sesión, un 404 sobre un repo al que sí se llega quiere decir que todavía no hay versiones.
    const reachable =
      /404/.test(String(error)) &&
      (await gh(['api', `repos/${REPO}`, '--jq', '.name']).then(
        () => true,
        () => false
      ))
    if (reachable) throw new Error('Todavía no hay versiones publicadas en GitHub.')
  }
  let response: Response
  try {
    response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Enhome' },
      signal: AbortSignal.timeout(15_000)
    })
  } catch {
    throw new Error('No se pudo conectar con GitHub. Revisá la conexión y probá de nuevo.')
  }
  if (response.status === 404) {
    throw new Error('GitHub no muestra las versiones: el repositorio es privado. Instalá la CLI de GitHub (gh) e iniciá sesión con gh auth login.')
  }
  if (!response.ok) throw new Error(`GitHub respondió ${response.status}. Probá de nuevo en un rato.`)
  return releaseSchema.parse(await response.json())
}

const installerOf = (release: Release): string | undefined => release.assets.find((a) => /setup\.exe$/i.test(a.name))?.name

let found: Release | null = null

export async function checkUpdates(): Promise<UpdateInfo> {
  const release = await latestRelease()
  found = release
  const current = app.getVersion()
  const latest = release.tag_name.replace(/^v/i, '')
  return {
    current,
    latest,
    newer: compareVersions(latest, current) > 0,
    url: release.html_url,
    notes: (release.body ?? '').trim(),
    canInstall: ghWorks && app.isPackaged && !!installerOf(release)
  }
}

// Baja el instalador de la versión encontrada, lo corre en silencio y cierra la app; al terminar,
// el instalador la vuelve a abrir. El progreso vive aparte y no se toca.
export async function installUpdate(quit: () => void): Promise<void> {
  if (!found) throw new Error('Primero buscá actualizaciones.')
  const asset = installerOf(found)
  if (!asset) throw new Error('Esta versión no tiene instalador para Windows.')
  const dir = mkdtempSync(join(tmpdir(), 'enhome-update-'))
  try {
    await gh(['release', 'download', found.tag_name, '--repo', REPO, '--pattern', asset, '--dir', dir, '--clobber'], 5 * 60_000)
  } catch (error) {
    throw new Error(`No se pudo bajar el instalador: ${error instanceof Error ? error.message : String(error)}`)
  }
  spawn(join(dir, asset), ['--updated', '/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref()
  quit()
}
