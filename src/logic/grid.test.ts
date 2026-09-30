import { describe, expect, it } from 'vitest'
import { cell, gridFrom, presetById } from '../test/grids'
import { mutationById, projectData } from '../test/projectData'
import {
  analyzeGrid,
  buildOccupancy,
  gridConsumption,
  requiredEffectsCheck,
  withCrop,
  withGround,
  withoutCropAt,
  type GridInput,
} from './grid'
import { BROKEN_GROUND } from './ground'
import { ringCropCounts } from './neighborRule'

const data = projectData()

/** Mutations qui peuvent spawn sur une case. */
function spawnsAt(grid: GridInput, x: number, y: number): readonly string[] {
  return analyzeGrid(data, grid).cells[cell(grid, x, y)]?.mutationIds ?? []
}

describe('grille : conditions de spawn', () => {
  it('2 Wheat autour d’une case vide font spawn un Dustgrain', () => {
    const grid = gridFrom(data, ['WW.', '...', '...'], { W: 'Wheat' })
    expect(spawnsAt(grid, 0, 1)).toEqual(['dustgrain'])
    expect(spawnsAt(grid, 1, 1)).toEqual(['dustgrain'])
    expect(spawnsAt(grid, 2, 1)).toEqual([]) // un seul Wheat voisin
  })

  it('refuse le spawn sur le mauvais sol', () => {
    const grid = gridFrom(data, ['WW.', 's..', '...'], { W: 'Wheat', s: { surface: 'Sand' } })
    expect(spawnsAt(grid, 0, 1)).toEqual([]) // Dustgrain pousse sur Dirt
    expect(spawnsAt(grid, 1, 1)).toEqual(['dustgrain'])
  })

  it('Lonelily spawn seulement sans aucun crop autour', () => {
    const empty = gridFrom(data, ['...', '...', '...'])
    expect(analyzeGrid(data, empty).cells.every((c) => c.mutationIds.includes('lonelily'))).toBe(true)
    const withCrop = gridFrom(data, ['...', '.W.', '...'], { W: 'Wheat' })
    expect(analyzeGrid(data, withCrop).cells.some((c) => c.mutationIds.includes('lonelily'))).toBe(false)
  })

  it('une mutation 2x2 ou 3x3 demande une empreinte entièrement libre, du bon sol', () => {
    const noctilume = presetById(data, 'avrg_noctilume_fleshtrap')
    const options = analyzeGrid(data, noctilume).options.filter((o) => o.mutationId === 'noctilume')
    expect(options.map((o) => [o.x, o.y])).toEqual([
      [1, 2],
      [4, 2],
    ])
    // Un crop posé dans l'empreinte bloque le spawn.
    const blocked = withCrop(data, noctilume, { kind: 'base', name: 'Wheat' }, 2, 3)
    if (!blocked.ok) throw new Error(blocked.reason)
    expect(analyzeGrid(data, blocked.grid).options.filter((o) => o.mutationId === 'noctilume')).toHaveLength(1)

    const snoozling = presetById(data, 'avrg_snoozling')
    expect(analyzeGrid(data, snoozling).options.filter((o) => o.mutationId === 'snoozling').map((o) => [o.x, o.y])).toEqual([
      [1, 1],
      [5, 1],
    ])
  })

  it('une mutation multi-cases compte une fois par case qu’elle occupe autour', () => {
    const complex = presetById(data, 'avrg_snoozling_complex_1')
    const area = { width: complex.width, height: complex.height, occupancy: buildOccupancy(data, complex) }
    const crops = complex.placements.map((p) => p.crop)
    // Case du Stoplight Petal : 2 Snoozlings et 2 Noctilumes touchent 4 cases de chaque.
    const counts = ringCropCounts(area, crops, 5, 5, 1)
    expect(counts.get('mutation:snoozling')).toBe(4)
    expect(counts.get('mutation:noctilume')).toBe(4)
    expect(spawnsAt(complex, 5, 5)).toEqual(['stoplight_petal'])
    // All-in Aloe : un PlantBoy 2x2 compte pour 2 cases.
    const aloe = presetById(data, 'avrg_all_in_aloe')
    const aloeArea = { width: aloe.width, height: aloe.height, occupancy: buildOccupancy(data, aloe) }
    expect(ringCropCounts(aloeArea, aloe.placements.map((p) => p.crop), 7, 5, 1).get('mutation:plantboy_advance')).toBe(2)
  })
})

describe('grille : conflits et priorité', () => {
  it('signale plusieurs mutations possibles sur une même case', () => {
    // First Big Farm : cette case touche 1 Carrot, 1 Potato et 2 Cocoa Beans.
    const farm = presetById(data, 'avrg_first_big_farm')
    const spawn = analyzeGrid(data, farm).cells[cell(farm, 7, 6)]
    expect(spawn?.mutationIds).toEqual(['choconut', 'scourroot'])
    expect(spawn?.conflict).toBe(true)
    expect(spawn?.winner).toBeNull()
  })

  it('donne la priorité au Godseed quand tous les effets requis sont autour', () => {
    const legend = { W: 'Wheat', S: 'Shadevine', A: 'Ashwreath', C: 'Choconut', G: 'Gloomgourd', H: 'Witherbloom' }
    const grid = gridFrom(data, ['WWSAC', 'G...W', 'H...W', 'W...W', 'WWWWW'], legend)
    const spawn = analyzeGrid(data, grid).cells[cell(grid, 1, 1)]
    expect(spawn?.mutationIds).toEqual(['dustgrain', 'godseed'])
    expect(spawn).toMatchObject({ conflict: true, winner: 'godseed' })
  })

  it('le vérificateur Godseed liste les effets présents et manquants', () => {
    const legend = { W: 'Wheat', S: 'Shadevine', A: 'Ashwreath', G: 'Gloomgourd', H: 'Witherbloom' }
    const grid = gridFrom(data, ['WWSAW', 'G...W', 'H...W', 'W...W', 'WWWWW'], legend) // sans Choconut
    const godseed = mutationById(data, 'godseed')
    const check = requiredEffectsCheck(data, grid, buildOccupancy(data, grid), godseed, 1, 1)
    expect(check).toMatchObject({ fits: true, footprintFree: true, soilOk: true, missing: ['Immunity'], ready: false })
    expect(check.effects.find((e) => e.name === 'Effect Spread')?.sources).toHaveLength(1)
    expect(analyzeGrid(data, grid).cells[cell(grid, 1, 1)]?.mutationIds).toEqual(['dustgrain'])
  })
})

describe('grille : effets reçus', () => {
  const effectsAt = (grid: GridInput, x: number, y: number) => analyzeGrid(data, grid).effects[cell(grid, x, y)]

  it('additionne les effets des voisins', () => {
    // 2 Dustgrain (Harvest Boost +20) et 1 Ashwreath (Improved Harvest Boost +30, XP Loss -20).
    const grid = gridFrom(data, ['DDA', '...', '...'], { D: 'Dustgrain', A: 'Ashwreath' })
    expect(effectsAt(grid, 1, 1)?.totals).toEqual({ yield: 70, xp: -20, water: 0 })
  })

  it('Immunity annule les effets négatifs', () => {
    const grid = gridFrom(data, ['DDA', '...', 'C..'], { D: 'Dustgrain', A: 'Ashwreath', C: 'Choconut' })
    const effects = effectsAt(grid, 1, 1)
    expect(effects?.immunity).toBe(true)
    expect(effects?.totals).toEqual({ yield: 70, xp: 0, water: 0 })
    expect(effects?.contributions.find((c) => c.effect === 'XP Loss')?.cancelled).toBe(true)
  })

  it('Effect Spread relaie les effets reçus par le voisin qui l’a', () => {
    // Le Dustgrain n'est pas voisin de la case (2, 2), mais le Witherbloom (Effect Spread) l'est.
    const spread = gridFrom(data, ['D..', '.H.', '...'], { D: 'Dustgrain', H: 'Witherbloom' })
    const effects = effectsAt(spread, 2, 2)
    expect(effects?.totals.yield).toBe(20)
    expect(effects?.spread).toBe(true)
    expect(effects?.contributions.find((c) => c.effect === 'Harvest Boost')?.via).not.toBeNull()
    const noSpread = gridFrom(data, ['D..', '.W.', '...'], { D: 'Dustgrain', W: 'Wheat' })
    expect(effectsAt(noSpread, 2, 2)?.totals.yield).toBe(0)
  })

  it('une case occupée reçoit les effets de l’anneau de son crop', () => {
    const grid = gridFrom(data, ['DW.', '...', '...'], { D: 'Dustgrain', W: 'Wheat' })
    expect(effectsAt(grid, 1, 0)?.totals.yield).toBe(20) // le Wheat reçoit le Harvest Boost du Dustgrain
  })
})

describe('grille : modifications', () => {
  const wheat = { kind: 'base', name: 'Wheat' } as const
  const snoozling = { kind: 'mutation', id: 'snoozling' } as const

  it('pose un crop et remplace ceux qu’il recouvre', () => {
    const grid = gridFrom(data, ['W....', '.....', '.....'], { W: 'Wheat' })
    const placed = withCrop(data, grid, snoozling, 0, 0)
    if (!placed.ok) throw new Error(placed.reason)
    expect(placed.grid.placements).toEqual([{ crop: snoozling, x: 0, y: 0 }])
  })

  it('une mutation posée met ses cases à son sol ; un crop de base garde le sol', () => {
    const grid = gridFrom(data, ['....', '....', '....'])
    const blastberry = withCrop(data, grid, { kind: 'mutation', id: 'blastberry' }, 1, 1)
    if (!blastberry.ok) throw new Error(blastberry.reason)
    expect(blastberry.grid.ground[cell(grid, 1, 1)]).toBe('Sand')
    expect(blastberry.grid.ground.filter((ground) => ground === 'Sand')).toHaveLength(1) // les voisines ne changent pas
    const withWheat = withCrop(data, blastberry.grid, wheat, 3, 0)
    if (!withWheat.ok) throw new Error(withWheat.reason)
    expect(withWheat.grid.ground).toEqual(blastberry.grid.ground)
    // Une mutation 3x3 change ses 9 cases.
    const big = withCrop(data, gridFrom(data, ['SSS', 'SSS', 'SSS'], { S: { surface: 'Sand' } }), snoozling, 0, 0)
    if (!big.ok) throw new Error(big.reason)
    expect(new Set(big.grid.ground)).toEqual(new Set([mutationById(data, 'snoozling').surface]))
  })

  it('refuse un crop qui dépasse ou qui tombe sur un bloc cassé', () => {
    const grid = gridFrom(data, ['...', '..x', '...'])
    expect(withCrop(data, grid, snoozling, 1, 1)).toEqual({ ok: false, reason: 'Le crop dépasse de la grille.' })
    expect(withCrop(data, grid, wheat, 2, 1)).toEqual({ ok: false, reason: 'Case verrouillée ou bloc cassé.' })
  })

  it('retire un crop multi-cases en cliquant sur n’importe laquelle de ses cases', () => {
    const placed = withCrop(data, gridFrom(data, ['...', '...', '...']), snoozling, 0, 0)
    if (!placed.ok) throw new Error(placed.reason)
    expect(withoutCropAt(data, placed.grid, 2, 2).placements).toEqual([])
  })

  it('casser un bloc retire le crop qui s’y trouve', () => {
    const grid = gridFrom(data, ['W..'], { W: 'Wheat' })
    const broken = withGround(data, grid, 0, 0, BROKEN_GROUND)
    expect(broken.placements).toEqual([])
    expect(broken.ground[0]).toBe(BROKEN_GROUND)
    expect(withGround(data, grid, 0, 0, 'Sand').placements).toHaveLength(1) // changer de sol garde le crop
  })

  it('compte ce que la grille consomme', () => {
    const blastberry = presetById(data, 'avrg_blastberry_min')
    const consumption = gridConsumption(blastberry, buildOccupancy(data, blastberry))
    expect(Object.fromEntries(consumption.mutations)).toEqual({ ashwreath: 12, chocoberry: 9 })
  })
})

describe('plans du guide AVRG', () => {
  it('contient les 21 plans transcrits', () => {
    expect(data.layouts).toHaveLength(21)
  })

  for (const preset of projectData().layouts) {
    it(`${preset.name} : chaque emplacement fait spawn la mutation attendue, et rien d'autre`, () => {
      const cells = analyzeGrid(data, preset).cells
      expect(preset.spots.length).toBeGreaterThan(0)
      for (const spot of preset.spots) {
        const spawns = cells[cell(preset, spot.x, spot.y)]?.mutationIds ?? []
        const where = `${preset.id} (${spot.x}, ${spot.y}) : ${spawns.join(', ') || 'aucun spawn'}`
        expect(spawns.length, where).toBeGreaterThan(0)
        for (const mutationId of spawns) expect(spot.expect, where).toContain(mutationId)
      }
    })
  }
})
