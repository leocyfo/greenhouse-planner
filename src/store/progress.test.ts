import { describe, expect, it } from 'vitest'
import {
  MAX_OWNED,
  normalizeCount,
  withAnalyzed,
  withAnalyzedMany,
  withGoalActive,
  withImportedInventory,
  withMember,
  withMembers,
  withOwned,
} from './progress'
import type { ProgressState } from './state'

const EMPTY: ProgressState = { inventory: {}, analyzed: [], activeGoals: [] }

describe('progression : transitions pures', () => {
  it('ramène un compteur à un entier entre 0 et le plafond', () => {
    expect(normalizeCount(2.9)).toBe(2)
    expect(normalizeCount(-4)).toBe(0)
    expect(normalizeCount(Number.NaN)).toBe(0)
    expect(normalizeCount(Infinity)).toBe(0)
    expect(normalizeCount(MAX_OWNED + 10)).toBe(MAX_OWNED)
  })

  it("met à jour l'inventaire sans modifier l'état précédent et sans stocker les zéros", () => {
    const withFive = withOwned(EMPTY, 'choconut', 5)
    expect(withFive.inventory).toEqual({ choconut: 5 })
    expect(EMPTY.inventory).toEqual({})
    expect(withOwned(withFive, 'choconut', 0).inventory).toEqual({})
  })

  it('garde les listes triées et sans doublon', () => {
    expect(withMember(['b', 'a'], 'a', true)).toEqual(['a', 'b'])
    expect(withMember(['a', 'b'], 'c', true)).toEqual(['a', 'b', 'c'])
    expect(withMember(['a', 'b'], 'a', false)).toEqual(['b'])
  })

  it('coche et décoche une analyse ou un objectif', () => {
    const analyzed = withAnalyzed(EMPTY, 'dustgrain', true)
    expect(analyzed.analyzed).toEqual(['dustgrain'])
    expect(withAnalyzed(analyzed, 'dustgrain', false).analyzed).toEqual([])
    expect(withGoalActive(EMPTY, 'rose_dragon', true).activeGoals).toEqual(['rose_dragon'])
  })

  it("remplace le stock par celui d'un profil importé, en gardant ou non les mutations non trouvées", () => {
    const before = { ...EMPTY, inventory: { choconut: 5, glasscorn: 1 } }
    expect(withImportedInventory(before, { choconut: 12, ashwreath: 3 }, false).inventory).toEqual({ choconut: 12, ashwreath: 3 })
    expect(withImportedInventory(before, { choconut: 12 }, true).inventory).toEqual({ choconut: 12, glasscorn: 1 })
    expect(before.inventory).toEqual({ choconut: 5, glasscorn: 1 })
  })

  it("coche ou décoche plusieurs analyses d'un coup, sans doublon", () => {
    const some = withAnalyzed(EMPTY, 'lonelily', true)
    const all = withAnalyzedMany(some, ['dustgrain', 'ashwreath', 'lonelily'], true)
    expect(all.analyzed).toEqual(['ashwreath', 'dustgrain', 'lonelily'])
    expect(withAnalyzedMany(all, ['dustgrain', 'lonelily'], false).analyzed).toEqual(['ashwreath'])
    expect(withMembers(['b'], ['a', 'a'], true)).toEqual(['a', 'b'])
  })
})
