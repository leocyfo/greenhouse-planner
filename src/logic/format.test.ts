import { describe, expect, it } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  it('affiche secondes, minutes, heures et jours', () => {
    expect(formatDuration(45)).toBe('45s')
    expect(formatDuration(725)).toBe('12m 05s')
    expect(formatDuration(6260.87)).toBe('1h 44m 20s')
    expect(formatDuration(3 * 86_400 + 4 * 3600 + 12 * 60 + 59)).toBe('3j 04h 12m')
  })

  it('gère zéro, les valeurs négatives et l\'infini', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(-10)).toBe('0s')
    expect(formatDuration(Infinity)).toBe('∞')
  })
})
