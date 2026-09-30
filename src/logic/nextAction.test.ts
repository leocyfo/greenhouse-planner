import { describe, expect, it } from 'vitest'
import { mutationById, projectData } from '../test/projectData'
import { mergeGoalTargets } from './goals'
import { missingInputs, nextActions } from './nextAction'
import { computePlan, type Inventory } from './recipes'

const data = projectData()
const roseDragon = mergeGoalTargets(data, new Set(['rose_dragon']), new Set())

function roseDragonActions(inventory: Inventory) {
  const plan = computePlan(data, { targets: roseDragon.targets, inventory, mode: 'optimum', route: roseDragon.route })
  return nextActions(data, plan, inventory)
}

/** Toutes les communes aux totaux AVRG. */
const COMMONS_DONE: Inventory = Object.fromEntries(
  data.mutations.filter((m) => m.rarity === 'COMMON').map((m) => [m.id, m.roseDragonOptimum]),
)

describe('prochaine action recommandée', () => {
  it('commence par le plus bas de l’arbre : une commune faisable avec des crops de base', () => {
    const actions = roseDragonActions({})
    expect(actions.recommended).toBe('ashwreath')
    expect(actions.alsoReady).toEqual(['choconut', 'dustgrain', 'gloomgourd', 'lonelily', 'scourroot'])
    expect(actions.manual).toEqual([])
  })

  it('passe au niveau suivant quand les communes sont faites, si les ingrédients sont en stock', () => {
    const actions = roseDragonActions(COMMONS_DONE)
    expect(actions.recommended).toBe('chocoberry')
    // Soggybud (Rare) passe après les Uncommon du même niveau.
    expect(actions.alsoReady).toEqual(['cindershade', 'coalroot', 'creambloom', 'duskbloom', 'thornshade'])
  })

  it("n'est pas faisable tant qu'un ingrédient manque", () => {
    const chocoberry = mutationById(data, 'chocoberry')
    expect(missingInputs(data, chocoberry, { choconut: 4, gloomgourd: 2 })).toEqual([
      { crop: { kind: 'mutation', id: 'choconut' }, missing: 2 },
    ])
    expect(missingInputs(data, chocoberry, { choconut: 6, gloomgourd: 2 })).toEqual([])
  })

  it('vérifie les prérequis du Shellfruit : 1 Turtlellini et 2 Blastberry', () => {
    const shellfruit = mutationById(data, 'shellfruit')
    expect(missingInputs(data, shellfruit, { turtlellini: 1, blastberry: 1 })).toEqual([
      { crop: { kind: 'mutation', id: 'blastberry' }, missing: 1 },
    ])
    expect(missingInputs(data, shellfruit, { turtlellini: 1, blastberry: 2 })).toEqual([])
  })

  it('met à part les conditions spéciales invérifiables (Godseed, Jerryflower)', () => {
    const plan = computePlan(data, {
      targets: [
        { mutationId: 'godseed', quantity: 1 },
        { mutationId: 'jerryflower', quantity: 1 },
      ],
      inventory: {},
      mode: 'minimum',
    })
    expect(nextActions(data, plan, {})).toEqual({ recommended: null, alsoReady: [], manual: ['godseed', 'jerryflower'] })
  })

  it('ne recommande rien quand tout est en stock', () => {
    const plan = computePlan(data, { targets: [{ mutationId: 'dustgrain', quantity: 1 }], inventory: { dustgrain: 1 }, mode: 'minimum' })
    expect(nextActions(data, plan, { dustgrain: 1 }).recommended).toBeNull()
  })
})
