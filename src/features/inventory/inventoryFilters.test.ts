import { describe, expect, it } from 'vitest'
import { computePlan } from '../../logic/recipes'
import { projectData } from '../../test/projectData'
import { DEFAULT_FILTERS, filterMutations, hasActiveFilters, normalizeSearch, type InventoryFilters } from './inventoryFilters'

const data = projectData()
// Objectif : 1 Chocoberry, avec déjà 6 Choconut → Chocoberry et Gloomgourd manquent, Choconut est complet.
const plan = computePlan(data, {
  targets: [{ mutationId: 'chocoberry', quantity: 1 }],
  inventory: { choconut: 6 },
  mode: 'minimum',
})
const analyzed = new Set(['dustgrain', 'choconut'])

function ids(filters: Partial<InventoryFilters>): string[] {
  return filterMutations(data.mutations, { ...DEFAULT_FILTERS, ...filters }, plan, analyzed).map((m) => m.id)
}

describe("filtres de l'inventaire", () => {
  it('sans filtre, montre les 40 mutations', () => {
    expect(ids({})).toHaveLength(40)
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
  })

  it('cherche sans tenir compte des majuscules, accents et tirets', () => {
    expect(normalizeSearch('Do-not-eat-shroom')).toBe('do not eat shroom')
    expect(ids({ search: 'DO NOT eat' })).toEqual(['do_not_eat_shroom'])
    expect(ids({ search: 'chorus' })).toEqual(['chorus_fruit'])
  })

  it('filtre par rareté, sol et taille', () => {
    expect(ids({ rarity: 'LEGENDARY' })).toHaveLength(7)
    expect(ids({ surface: 'End Stone' })).toEqual(['chorus_fruit', 'timestalk'])
    expect(ids({ size: '3x3' })).toEqual(['snoozling', 'godseed'])
    expect(ids({ rarity: 'RARE', size: '2x2' })).toEqual(['noctilume'])
  })

  it('filtre selon les besoins des objectifs', () => {
    expect(ids({ need: 'missing' })).toEqual(['gloomgourd', 'chocoberry'])
    expect(ids({ need: 'complete' })).toEqual(['choconut'])
    expect(ids({ need: 'unrequested' })).toHaveLength(37)
  })

  it('filtre les mutations analysées ou non', () => {
    expect(ids({ analysis: 'analyzed' })).toEqual(['choconut', 'dustgrain'])
    expect(ids({ analysis: 'notAnalyzed' })).toHaveLength(38)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, analysis: 'analyzed' })).toBe(true)
  })
})
