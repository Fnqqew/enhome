// Pruebas de interfaz: abren la app compilada (out/) con una carpeta de datos vacía y un Claude
// simulado que figura conectado pero no responde. Así no tocan el progreso real ni la suscripción.
// Uso: npm run e2e (compila y corre).

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { _electron as electron } from 'playwright-core'

const project = resolve(import.meta.dirname, '../..')
// Desde Node, el paquete electron devuelve la ruta del ejecutable.
const electronPath = createRequire(import.meta.url)('electron')
const shotsDir = join(project, 'out', 'e2e')

async function launch(dataDir) {
  const env = { ...process.env, ENHOME_DATA_DIR: dataDir, ENHOME_CLAUDE_FALSO: '1' }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ executablePath: electronPath, args: [project], cwd: project, env })
  const win = await app.firstWindow()
  const errors = []
  win.on('pageerror', (error) => errors.push(error.message))
  await win.setViewportSize({ width: 1280, height: 860 }).catch(() => undefined)
  await win.waitForSelector('.sidebar', { timeout: 60_000 })
  return { app, win, errors }
}

// Cierra la bienvenida de un curso nuevo.
async function skipWelcome(win) {
  const modal = win.locator('.modal')
  await modal.getByText('Bienvenida', { exact: false }).waitFor()
  await modal.getByRole('button', { name: 'Saltear' }).click()
  await modal.waitFor({ state: 'detached' })
}

// Abre una sección desde la barra lateral y espera su título.
async function open(win, label, title = label) {
  await win.locator('.sidebar').getByRole('button', { name: label, exact: true }).click()
  await win.locator('.content h1', { hasText: title }).first().waitFor({ timeout: 15_000 })
}

describe('Enhome', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'enhome-e2e-'))
  let session

  before(async () => {
    mkdirSync(shotsDir, { recursive: true })
    session = await launch(dataDir)
  })

  after(async () => {
    await session?.app.close().catch(() => undefined)
    rmSync(dataDir, { recursive: true, force: true })
  })

  // Si una prueba falla, deja una captura en out/e2e para ver qué había en pantalla.
  const step = (name, run) =>
    it(name, async () => {
      try {
        await run(session.win)
        assert.deepEqual(session.errors, [], 'la interfaz tiró errores')
        assert.equal(await session.win.locator('.crash').count(), 0, 'apareció la pantalla de error')
      } catch (error) {
        await session.win.screenshot({ path: join(shotsDir, `${name.replace(/[^a-z0-9áéíóúñ]+/gi, '-')}.png`) }).catch(() => undefined)
        throw error
      }
    })

  step('muestra la bienvenida y se puede saltear', skipWelcome)

  step('arranca desde cero sin examen inicial', async (win) => {
    await win.getByRole('button', { name: 'Empezar desde cero' }).click()
    await win.getByText('Examen inicial').waitFor({ state: 'detached', timeout: 15_000 })
  })

  step('abre cada sección sin errores', async (win) => {
    const sections = ['Temario', 'Práctica', 'Repaso', 'Resúmenes', 'Pruebas', 'Progreso', 'Estadísticas']
    const extra = ['Charla', 'Juegos', 'Lecturas', 'Pronunciación', 'Diario', 'Biblioteca', 'Ajustes', 'Ayuda', 'Comentarios', 'Acerca de', 'Inicio']
    for (const label of [...sections, ...extra]) await open(win, label)
  })

  step('hace una práctica entera sin Claude, con los ejercicios del banco', async (win) => {
    // Solo los formatos que se corrigen al instante: el Claude de prueba no responde.
    await win.evaluate(() =>
      window.api.updateSettings({
        practiceLength: 'short',
        excludedTypes: ['translation', 'translation_set', 'dialogue', 'roleplay', 'writing', 'shadowing', 'transformation']
      })
    )
    // El día en que empieza la semana del primer tópico, para que haya práctica.
    const state = await win.evaluate(() => window.api.devSetToday(null))
    if (state.week) await win.evaluate((day) => window.api.devSetToday(day), state.week.startsOn)
    await open(win, 'Práctica')
    await win.getByRole('button', { name: 'Empezar la práctica' }).click()

    const main = win.locator('.exercise-main')
    let finished = false
    for (let round = 0; round < 150 && !finished; round++) {
      if (await win.getByRole('button', { name: 'Terminar práctica' }).isVisible()) {
        finished = true
        break
      }
      const next = win.getByRole('button', { name: /^(Siguiente|Ver resultado)$/ })
      if (await next.isVisible()) {
        await next.click()
        continue
      }
      // Se responde cualquier cosa: también se prueban el segundo intento y la repetición al final.
      for (const group of await main.locator('.options').all()) {
        const option = group.locator('.option:not([disabled])').first()
        if (await option.count()) await option.click()
      }
      for (const input of await main.locator('input.blank:not([disabled]), input.text-answer:not([disabled])').all()) await input.fill(`zz${round}`)
      // Ordenar: si ya estaba armado (segundo intento), se saca una ficha y se vuelve a poner.
      const placed = main.locator('.answer-line .token:not([disabled]), .reorder-text .sentence-piece:not([disabled])')
      if (await placed.count()) await placed.first().click()
      for (let k = 0; k < 15; k++) {
        const piece = main.locator('.token-bank .token:not([disabled]), .stack-sm > .sentence-piece:not([disabled])').first()
        if (!(await piece.count())) break
        await piece.click()
      }
      const check = win.getByRole('button', { name: 'Comprobar' })
      if (await check.isEnabled()) await check.click()
      else await win.getByRole('button', { name: 'Cambiar ejercicio' }).click()
      await win.waitForTimeout(100)
    }
    assert.ok(finished, 'la práctica no llegó al final')
    await win.getByRole('button', { name: 'Terminar práctica' }).click()
    await win.getByText(/Terminaste la práctica/).waitFor({ timeout: 15_000 })
    await win.evaluate(() => window.api.devSetToday(null))
  })

  step('el temario muestra el primer tópico', async (win) => {
    await open(win, 'Temario')
    await win.locator('.content').getByText('A1', { exact: true }).first().waitFor()
  })

  step('si Claude no responde, la charla lo avisa', async (win) => {
    await open(win, 'Charla')
    await win.locator('.suggestion').first().click()
    await win.locator('.content .error', { hasText: 'Claude simulado' }).waitFor({ timeout: 20_000 })
  })

  step('el buscador lleva a una sección', async (win) => {
    await win.keyboard.press('Control+K')
    await win.keyboard.type('Juegos')
    await win.keyboard.press('Enter')
    await win.locator('.content h1', { hasText: 'Juegos' }).waitFor()
  })

  step('el estilo elegido se aplica al instante', async (win) => {
    await open(win, 'Ajustes')
    await win.getByRole('tab', { name: 'Apariencia' }).click()
    await win.locator('.style-card', { hasText: 'Noche' }).click()
    await win.waitForFunction(() => document.documentElement.dataset.style === 'noche')
  })

  step('cada idioma tiene su propio curso', async (win) => {
    await win.locator('.lang-current').click()
    await win.getByRole('option', { name: /Portugu/ }).click()
    await win.locator('.lang-name', { hasText: 'Portugués' }).waitFor()
    await skipWelcome(win)
    await open(win, 'Inicio')
    // El curso de portugués empieza de cero: vuelve a ofrecer el examen inicial.
    await win.getByText('Examen inicial').waitFor()
    await win.locator('.lang-current').click()
    await win.getByRole('option', { name: /Inglés/ }).click()
    await win.locator('.lang-name', { hasText: 'Inglés' }).waitFor()
  })

  step('al volver a abrir recuerda el estilo y el curso', async () => {
    await session.app.close()
    session = await launch(dataDir)
    const { win } = session
    assert.equal(await win.evaluate(() => document.documentElement.dataset.style), 'noche')
    assert.equal(await win.locator('.lang-name').innerText(), 'Inglés')
    await open(win, 'Inicio')
    assert.equal(await win.getByText('Examen inicial').count(), 0)
  })
})
