/**
 * Plusieurs fermes du guide dans un même greenhouse : un plan 10 x 10 accueille par exemple quatre
 * fermes 5 x 5, ou les quatre fermes légendaires (« All the legendary designs fit onto one plot »,
 * guide AVRG). Une ferme est posée là où ses cases (crops, emplacements, sols particuliers) sont
 * libres, puis le plan est vérifié par la logique de la grille : chaque emplacement de chaque ferme
 * doit faire spawn exactement les mêmes mutations que si la ferme était seule. Une ferme marquée
 * ownPlot (Chorus Fruit) reste seule sur son greenhouse.
 */
import { analyzeGrid, buildOccupancy, cropSide, type GridInput } from '../../logic/grid'
import { isUsableGround } from '../../logic/ground'
import { cropKey } from '../../logic/neighborRule'
import type { GameData, GuideChapter, LayoutPreset, Placement } from '../../types/game'

export interface FarmAt {
  readonly preset: LayoutPreset
  readonly dx: number
  readonly dy: number
}

export interface FoundFarm extends FarmAt {
  readonly chapter: GuideChapter
}

interface Cell {
  readonly x: number
  readonly y: number
}

const defaultSurface = (data: GameData) => data.surfaces[0] ?? ''

/** Cases d'une ferme dans son plan : ses crops (toute leur empreinte), ses emplacements, ses sols particuliers. */
export function farmMask(data: GameData, preset: LayoutPreset): Cell[] {
  const cells = new Set<number>()
  for (const placement of preset.placements) {
    const side = cropSide(data, placement.crop)
    for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) cells.add((placement.y + y) * preset.width + placement.x + x)
  }
  for (const spot of preset.spots) cells.add(spot.y * preset.width + spot.x)
  preset.ground.forEach((ground, cell) => {
    if (ground !== defaultSurface(data)) cells.add(cell)
  })
  return [...cells].map((cell) => ({ x: cell % preset.width, y: Math.floor(cell / preset.width) }))
}

const shifted = (preset: LayoutPreset, dx: number, dy: number): Placement[] =>
  preset.placements.map((placement) => ({ crop: placement.crop, x: placement.x + dx, y: placement.y + dy }))

/** Le plan avec une ferme de plus : ses sols et ses crops, décalés de (dx, dy). */
export function withFarm(data: GameData, grid: GridInput, farm: FarmAt): GridInput {
  const ground = [...grid.ground]
  for (const { x, y } of farmMask(data, farm.preset)) {
    ground[(y + farm.dy) * grid.width + x + farm.dx] = farm.preset.ground[y * farm.preset.width + x] ?? defaultSurface(data)
  }
  return { ...grid, ground, placements: [...grid.placements, ...shifted(farm.preset, farm.dx, farm.dy)] }
}

/** Un greenhouse vide, au sol par défaut. */
export function emptyGrid(data: GameData): GridInput {
  const { width, height } = data.mechanics.greenhouse
  return { width, height, ground: new Array<string>(width * height).fill(defaultSurface(data)), placements: [] }
}

/** Décalages possibles d'une ferme : toutes ses cases restent dans la grille. */
function offsets(data: GameData, grid: GridInput, preset: LayoutPreset): Cell[] {
  const mask = farmMask(data, preset)
  if (mask.length === 0) return []
  const xs = mask.map((c) => c.x)
  const ys = mask.map((c) => c.y)
  const result: Cell[] = []
  for (let dy = -Math.min(...ys); dy + Math.max(...ys) < grid.height; dy += 1) {
    for (let dx = -Math.min(...xs); dx + Math.max(...xs) < grid.width; dx += 1) result.push({ x: dx, y: dy })
  }
  return result
}

const placementKey = (placement: Placement) => `${cropKey(placement.crop)}@${placement.x},${placement.y}`

/** Fermes du guide présentes dans un plan (une ferme et sa version minimum : la plus grande l'emporte). */
export function farmsIn(data: GameData, grid: GridInput): FoundFarm[] {
  const present = new Set(grid.placements.map(placementKey))
  const at = new Map(grid.placements.map((placement) => [`${placement.x},${placement.y}`, placement]))
  const found: FoundFarm[] = []
  for (const chapter of data.guide.sections.flatMap((section) => section.chapters)) {
    for (const preset of [chapter.layout, chapter.minimumLayout]) {
      if (!preset || preset.placements.length === 0) continue
      for (const { x: dx, y: dy } of offsets(data, grid, preset)) {
        if (!shifted(preset, dx, dy).every((placement) => present.has(placementKey(placement)))) continue
        // Ses emplacements sont vides (ou ont déjà fait spawn ce qu'ils doivent).
        const spotsFree = preset.spots.every((spot) => {
          const placed = at.get(`${spot.x + dx},${spot.y + dy}`)
          return !placed || (placed.crop.kind === 'mutation' && spot.expect.includes(placed.crop.id))
        })
        if (spotsFree) found.push({ chapter, preset, dx, dy })
      }
    }
  }
  // Une petite ferme peut se retrouver dans une plus grande : chaque crop n'appartient qu'à une ferme.
  const claimed = new Set<string>()
  return found
    .sort((a, b) => b.preset.placements.length - a.preset.placements.length)
    .filter((farm) => {
      const keys = shifted(farm.preset, farm.dx, farm.dy).map(placementKey)
      if (keys.some((key) => claimed.has(key))) return false
      for (const key of keys) claimed.add(key)
      return true
    })
}

/** Le plan ne contient que des fermes du guide (ou rien) : on peut y en ajouter d'autres. */
export function isGuideOnly(data: GameData, grid: GridInput, farms: readonly FarmAt[] = farmsIn(data, grid)): boolean {
  return farms.reduce((sum, farm) => sum + farm.preset.placements.length, 0) === grid.placements.length
}

/** Mutations qui peuvent spawn sur chaque emplacement de la ferme, dans ce plan. */
function spotSpawns(data: GameData, grid: GridInput, farm: FarmAt, analysis = analyzeGrid(data, grid)): string[] {
  return farm.preset.spots.map((spot) => {
    const cell = (spot.y + farm.dy) * grid.width + spot.x + farm.dx
    return [...(analysis.cells[cell]?.mutationIds ?? [])].sort().join('+')
  })
}

/** Ce que chaque emplacement de la ferme fait spawn quand elle est seule (gardé par ferme et décalage). */
const aloneCache = new WeakMap<GameData, Map<string, string[]>>()
function aloneSpawns(data: GameData, farm: FarmAt): string[] {
  let cache = aloneCache.get(data)
  if (!cache) aloneCache.set(data, (cache = new Map()))
  const key = `${farm.preset.id}@${farm.dx},${farm.dy}`
  let spawns = cache.get(key)
  if (!spawns) {
    const alone = withFarm(data, emptyGrid(data), farm)
    spawns = spotSpawns(data, alone, farm)
    cache.set(key, spawns)
  }
  return spawns
}

/**
 * Première place (de haut en bas, de gauche à droite) où la ferme tient dans le plan sans rien
 * gêner, ou null : ses cases sont libres, sur un sol utilisable, hors des cases des autres fermes,
 * et toutes les fermes du plan font encore spawn exactement les mêmes mutations.
 */
export function fitFarm(data: GameData, grid: GridInput, preset: LayoutPreset, farms: readonly FarmAt[]): FarmAt | null {
  const occupancy = buildOccupancy(data, grid)
  const taken = new Set<number>()
  for (const farm of farms) for (const { x, y } of farmMask(data, farm.preset)) taken.add((y + farm.dy) * grid.width + x + farm.dx)
  const mask = farmMask(data, preset)

  for (const { x: dx, y: dy } of offsets(data, grid, preset)) {
    const free = mask.every(({ x, y }) => {
      const cell = (y + dy) * grid.width + x + dx
      return occupancy[cell] === null && !taken.has(cell) && isUsableGround(grid.ground[cell] ?? '')
    })
    if (!free) continue
    const farm = { preset, dx, dy }
    const next = withFarm(data, grid, farm)
    const analysis = analyzeGrid(data, next)
    const unchanged = [...farms, farm].every((f) => spotSpawns(data, next, f, analysis).join('|') === aloneSpawns(data, f).join('|'))
    if (unchanged) return farm
  }
  return null
}

export interface PackResult {
  readonly grid: GridInput
  /** Fermes du plan après coup : celles qui y étaient, puis les nouvelles. */
  readonly farms: readonly FarmAt[]
  readonly added: readonly FarmAt[]
  /** Fermes qui n'ont pas trouvé de place. */
  readonly rest: readonly LayoutPreset[]
}

/**
 * Range des fermes dans un plan, dans l'ordre donné ; une ferme ownPlot ne va que dans un plan vide
 * et rien ne la rejoint.
 */
export function packFarms(
  data: GameData,
  grid: GridInput,
  presets: readonly LayoutPreset[],
  existing: readonly FarmAt[],
  ownPlot: (preset: LayoutPreset) => boolean,
): PackResult {
  let current = grid
  const farms = [...existing]
  const added: FarmAt[] = []
  const rest: LayoutPreset[] = []
  for (const preset of presets) {
    const blocked = ownPlot(preset) ? current.placements.length > 0 : farms.some((farm) => ownPlot(farm.preset))
    const farm = blocked ? null : fitFarm(data, current, preset, farms)
    if (!farm) {
      rest.push(preset)
      continue
    }
    current = withFarm(data, current, farm)
    farms.push(farm)
    added.push(farm)
  }
  return { grid: current, farms, added, rest }
}

/** Ferme marquée « seule sur son greenhouse » dans le guide. */
export function ownPlotOf(data: GameData): (preset: LayoutPreset) => boolean {
  const alone = new Set(
    data.guide.sections.flatMap((section) =>
      section.chapters.filter((chapter) => chapter.ownPlot).flatMap((chapter) => [chapter.layout.id, chapter.minimumLayout?.id ?? '']),
    ),
  )
  return (preset) => alone.has(preset.id)
}

/** Nom d'un plan qui réunit des fermes : leurs noms, « Cheesebite + Chloronite ». */
export function farmsName(farms: readonly FarmAt[]): string {
  return farms.map((farm) => farm.preset.name).join(' + ')
}

/** Un plan et ses fermes, sous la forme d'une ferme (aperçu) : les emplacements de chacune, décalés. */
export function planPreview(grid: GridInput, farms: readonly FarmAt[], name: string): Pick<LayoutPreset, 'name' | 'width' | 'height' | 'ground' | 'placements' | 'spots'> {
  return {
    name,
    width: grid.width,
    height: grid.height,
    ground: grid.ground,
    placements: grid.placements,
    spots: farms.flatMap((farm) => farm.preset.spots.map((spot) => ({ ...spot, x: spot.x + farm.dx, y: spot.y + farm.dy }))),
  }
}

/**
 * Les plus grandes fermes d'abord (à taille égale, l'ordre donné) : posées en premier, elles laissent
 * aux petites des places d'un seul tenant.
 */
export function largestFirst(data: GameData, presets: readonly LayoutPreset[]): LayoutPreset[] {
  const size = new Map(presets.map((preset) => [preset.id, farmMask(data, preset).length]))
  return [...presets].sort((a, b) => (size.get(b.id) ?? 0) - (size.get(a.id) ?? 0))
}
