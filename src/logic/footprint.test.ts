import { describe, expect, it } from 'vitest'
import { ringCellCount, sideOf } from './footprint'

describe('footprint', () => {
  it('donne le côté de chaque taille', () => {
    expect(sideOf('1x1')).toBe(1)
    expect(sideOf('2x2')).toBe(2)
    expect(sideOf('3x3')).toBe(3)
  })

  it("compte les cases de l'anneau autour d'une empreinte : 8, 12 et 16", () => {
    expect(ringCellCount(1)).toBe(8)
    expect(ringCellCount(2)).toBe(12)
    expect(ringCellCount(3)).toBe(16)
  })
})
