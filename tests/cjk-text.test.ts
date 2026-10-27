import { describe, expect, it } from 'vitest'
import { matchesAny, normalize, tokenize } from '../src/shared/exercise-types/text'

describe('respuestas en idiomas con otra escritura', () => {
  it('en japonés y chino no cuentan los espacios entre caracteres ni la puntuación propia', () => {
    expect(matchesAny('私は 学生 です', ['私は学生です。'])).toBe(true)
    expect(matchesAny('我 是 学生。', ['我是学生'])).toBe(true)
    expect(matchesAny('私は先生です', ['私は学生です'])).toBe(false)
  })

  it('el ancho completo se lleva a la forma común', () => {
    expect(normalize('ＡＢＣ！')).toBe(normalize('ABC!'))
  })

  it('en coreano los espacios entre palabras se respetan', () => {
    expect(normalize('저는 학생입니다')).toBe('저는 학생입니다')
  })

  it('para ordenar, los bloques separados por espacios son las fichas', () => {
    expect(tokenize('私は 毎日 日本語を 勉強します。')).toEqual(['私は', '毎日', '日本語を', '勉強します'])
  })

  it('el ruso y el alemán se comparan como siempre', () => {
    expect(matchesAny('Я студент', ['Я студент.'])).toBe(true)
    expect(matchesAny('Ich bin Student', ['ich bin Student.'])).toBe(true)
  })
})
