import { describe, expect, it } from 'vitest'
import { layoutFromPreset, toGridInput } from '../store/grids'
import { projectData } from '../test/projectData'
import { autofill, autofillTargets, mutationCost, type AutofillRequest, type AutofillResult } from './autofill'
import { analyzeGrid, gridConsumption } from './grid'
import { LOCKED_GROUND } from './ground'

const data = projectData()
const { width, height } = data.mechanics.greenhouse
const open = () => new Array<string>(width * height).fill('Dirt')
/** Coût des mutations posées : chacune compte ce qu'il faut de mutations pour en faire une. */
const cost = (counts: ReadonlyMap<string, number>) =>
  [...counts].reduce((sum, [id, count]) => sum + count * mutationCost(data, id), 0)

function run(request: Partial<AutofillRequest> & Pick<AutofillRequest, 'targetId' | 'spots'>): AutofillResult {
  const outcome = autofill(data, { width, height, ground: open(), ...request })
  if (!outcome.ok) throw new Error(outcome.reason)
  return outcome.result
}

describe('remplissage automatique : aussi bien que les plans du guide AVRG', () => {
  // Plans AVRG pour une seule mutation : le plan automatique doit donner au moins autant
  // d'emplacements, pour un coût en mutations au plus égal et pas plus de conflits.
  const presets = data.layouts.filter((preset) => new Set(preset.spots.flatMap((spot) => spot.expect)).size === 1)

  it('couvre les 12 plans AVRG à une seule mutation', () => {
    expect(presets).toHaveLength(12)
  })

  for (const preset of presets) {
    it(`fait au moins aussi bien que « ${preset.name} »`, () => {
      const targetId = preset.spots[0]?.expect[0] ?? ''
      const grid = toGridInput(layoutFromPreset('avrg', preset, { width, height }, 'Dirt'), { width, height })
      const analysis = analyzeGrid(data, grid)
      const avrgSpots = analysis.options.filter((option) => option.mutationId === targetId).length
      const avrgConflicts = analysis.cells.filter((cell) => cell.conflict).length
      const avrgCost = cost(gridConsumption(grid, analysis.occupancy).mutations)

      const result = run({ targetId, spots: avrgSpots })
      expect(result.spots).toBeGreaterThanOrEqual(avrgSpots)
      expect(cost(result.mutations)).toBeLessThanOrEqual(avrgCost)
      expect(result.conflicts).toBeLessThanOrEqual(avrgConflicts)
    })
  }
})

describe('remplissage automatique : un plan propre', () => {
  /** Case → nom du crop posé (ou « spot » pour un emplacement), dans le cadre du plan. */
  const picture = (result: AutofillResult, targetId: string) => {
    const cells = new Map<number, string>()
    for (const p of result.placements) {
      const name = p.crop.kind === 'mutation' ? p.crop.id : p.crop.name
      const side = p.crop.kind === 'mutation' ? (data.mutationsById.get(p.crop.id)?.side ?? 1) : 1
      for (let dy = 0; dy < side; dy += 1) for (let dx = 0; dx < side; dx += 1) cells.set((p.y + dy) * width + p.x + dx, name)
    }
    const surface = data.mutationsById.get(targetId)?.surface
    result.ground.forEach((ground, cell) => {
      if (!cells.has(cell) && ground === surface) cells.set(cell, 'spot')
    })
    const xs = [...cells.keys()].map((c) => c % width)
    const ys = [...cells.keys()].map((c) => Math.floor(c / width))
    return { cells, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  }
  /** Groupes (4 voisins) d'un même crop. */
  const groups = (cells: ReadonlyMap<number, string>, name: string) => {
    const left = new Set([...cells].filter(([, value]) => value === name).map(([cell]) => cell))
    let count = 0
    while (left.size > 0) {
      count += 1
      const stack = [left.values().next().value ?? 0]
      while (stack.length > 0) {
        const cell = stack.pop() ?? 0
        if (!left.delete(cell)) continue
        stack.push(cell - 1, cell + 1, cell - width, cell + width)
      }
    }
    return count
  }

  it('regroupe les Chocoberry et fait un plan symétrique (demande du joueur)', () => {
    for (const spots of [4, 8]) {
      const result = run({ targetId: 'blastberry', spots })
      const { cells, minX, maxX, minY, maxY } = picture(result, 'blastberry')
      expect(groups(cells, 'chocoberry'), `${spots} emplacements`).toBe(1)
      for (const [cell, name] of cells) {
        const x = cell % width
        const y = Math.floor(cell / width)
        expect(cells.get(y * width + (minX + maxX - x)), `reflet gauche-droite de ${x},${y}`).toBe(name)
        expect(cells.get((minY + maxY - y) * width + x), `reflet haut-bas de ${x},${y}`).toBe(name)
      }
    }
  })

  it('met un seul PlantBoy Advance au centre de quatre All-in Aloe, comme le plan AVRG', () => {
    const result = run({ targetId: 'all_in_aloe', spots: 4 })
    expect(result.spots).toBe(4)
    expect(result.mutations.get('plantboy_advance')).toBe(1)
  })
})

describe('remplissage automatique : règles', () => {
  it('donne un plan que la logique de la grille confirme', () => {
    const result = run({ targetId: 'blastberry', spots: 4 })
    const analysis = analyzeGrid(data, { width, height, ground: result.ground, placements: result.placements })
    expect(analysis.options.filter((option) => option.mutationId === 'blastberry')).toHaveLength(4)
    expect(analysis.cells.some((cell) => cell.conflict)).toBe(false)
    // Seuls les ingrédients de la cible sont posés.
    expect(new Set(result.placements.map((p) => (p.crop.kind === 'mutation' ? p.crop.id : p.crop.name)))).toEqual(
      new Set(['chocoberry', 'ashwreath']),
    )
  })

  it("n'utilise jamais une case verrouillée, et fait ce qui tient dans la place", () => {
    // Seulement 4 x 3 cases utilisables : un seul emplacement de Blastberry tient, avec ses 8 voisins.
    const ground = open().map((value, cell) => (cell % width < 4 && Math.floor(cell / width) < 3 ? value : LOCKED_GROUND))
    const result = run({ targetId: 'blastberry', spots: 4, ground })
    expect(result.spots).toBe(1)
    expect(result.placements).toHaveLength(8)
    for (const placement of result.placements) expect(ground[placement.y * width + placement.x]).not.toBe(LOCKED_GROUND)
    expect(result.ground.filter((value) => value === LOCKED_GROUND)).toHaveLength(width * height - 12)
  })

  it('respecte le stock : jamais plus de mutations que celles possédées', () => {
    const stock = new Map([
      ['chocoberry', 5],
      ['ashwreath', 3],
    ])
    const result = run({ targetId: 'blastberry', spots: 4, stock })
    expect(result.spots).toBe(1)
    expect(result.mutations.get('chocoberry') ?? 0).toBeLessThanOrEqual(5)
    expect(result.mutations.get('ashwreath') ?? 0).toBeLessThanOrEqual(3)
    // Pas assez pour un seul emplacement : le message dit ce qui manque.
    const stockOf = (chocoberry: number, ashwreath: number) =>
      new Map([
        ['chocoberry', chocoberry],
        ['ashwreath', ashwreath],
      ])
    expect(autofill(data, { targetId: 'blastberry', spots: 4, width, height, ground: open(), stock: stockOf(2, 0) })).toEqual({
      ok: false,
      reason: 'Pas assez de stock pour un emplacement de Blastberry : il faut au moins 5 Chocoberry (tu en as 2), 3 Ashwreath (tu en as 0).',
    })
  })

  it('évite les conflits évitables (Chocoberry sans Creambloom) et signale les inévitables (Zombud)', () => {
    // 8 Choconut autour d'une case : une Creambloom pourrait y apparaître à la place.
    expect(run({ targetId: 'chocoberry', spots: 4 }).conflicts).toBe(0)
    // Witherbloom demande 4 Dead Plant sur de la Soul Sand, comme chaque emplacement de Zombud.
    const zombud = run({ targetId: 'zombud', spots: 2 })
    expect(zombud.spots).toBe(2)
    expect(zombud.conflicts).toBe(2)
  })

  it('gère les mutations et les ingrédients de plusieurs cases', () => {
    expect(run({ targetId: 'glasscorn', spots: 1 }).spots).toBe(1)
    expect(run({ targetId: 'all_in_aloe', spots: 4 }).mutations.get('plantboy_advance')).toBeGreaterThan(0)
  })

  it('donne toujours le même plan pour la même demande', () => {
    expect(run({ targetId: 'chloronite', spots: 4 })).toEqual(run({ targetId: 'chloronite', spots: 4 }))
  })

  it('refuse ce qui ne peut pas être rempli', () => {
    const targets = autofillTargets(data).map((m) => m.id)
    for (const id of ['lonelily', 'godseed', 'shellfruit', 'jerryflower']) expect(targets).not.toContain(id)
    expect(autofill(data, { targetId: 'shellfruit', spots: 1, width, height, ground: open() }).ok).toBe(false)
    // 2 x 2 cases : un Glasscorn (2x2, 12 voisins) ne tient pas.
    const tiny = open().map((value, cell) => (cell % width < 2 && Math.floor(cell / width) < 2 ? value : LOCKED_GROUND))
    expect(autofill(data, { targetId: 'glasscorn', spots: 1, width, height, ground: tiny })).toMatchObject({ ok: false })
  })
})
