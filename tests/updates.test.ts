import { describe, expect, it } from 'vitest'
import { compareVersions } from '../src/shared/updates'

describe('compareVersions', () => {
  it('ordena por mayor, menor y parche', () => {
    expect(compareVersions('2.0.0', '1.5.0')).toBeGreaterThan(0)
    expect(compareVersions('1.10.0', '1.9.3')).toBeGreaterThan(0)
    expect(compareVersions('1.4.1', '1.4.10')).toBeLessThan(0)
  })

  it('ignora la v del tag y las partes que faltan', () => {
    expect(compareVersions('v2.0.0', '2.0.0')).toBe(0)
    expect(compareVersions('2.0', '2.0.0')).toBe(0)
    expect(compareVersions('v2.0.1', '2.0')).toBeGreaterThan(0)
  })

  it('una versión previa (-beta) cuenta como la misma base', () => {
    expect(compareVersions('2.1.0-beta', '2.0.0')).toBeGreaterThan(0)
  })
})
