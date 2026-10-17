import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/main/db/database'
import { addHighlight, listHighlights, removeHighlight, updateHighlightNote } from '../src/main/reading/highlights'

describe('resaltados del modo lectura', () => {
  it('se guardan por texto, sin repetir, con nota, y se pueden quitar', () => {
    const db = openDatabase(':memory:')
    const key = 'resumen:a1-to-be:explicacion'
    addHighlight(db, key, '  I am a teacher  ')
    const [mark] = addHighlight(db, key, 'I am a teacher')
    expect(listHighlights(db, key)).toEqual([{ id: mark.id, text: 'I am a teacher', note: '' }])
    expect(listHighlights(db, 'otro')).toEqual([])

    updateHighlightNote(db, mark.id, 'Ojo con el artículo')
    expect(listHighlights(db, key)[0].note).toBe('Ojo con el artículo')
    expect(removeHighlight(db, key, mark.id)).toEqual([])
  })
})
