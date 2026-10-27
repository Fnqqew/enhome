import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPronunciation } from '../src/main/content/pronunciation'
import { LANGUAGE_IDS } from '../src/shared/languages'

const CONTENT = join(__dirname, '..', 'content')

describe('guías de pronunciación', () => {
  it('las que existen son válidas y los pares mínimos tienen dos palabras distintas', () => {
    for (const language of LANGUAGE_IDS) {
      const guide = loadPronunciation(CONTENT, language)
      if (!guide) continue
      for (const pair of guide.pairs) expect(pair.a.toLowerCase()).not.toBe(pair.b.toLowerCase())
    }
  })

  it('el portugués tiene la suya', () => {
    expect(loadPronunciation(CONTENT, 'pt')?.sounds.length).toBeGreaterThanOrEqual(6)
  })
})
