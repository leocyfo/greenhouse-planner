/**
 * Grille d'un greenhouse (logique pure) : occupation des cases, pose et retrait de crops,
 * spawns possibles et conflits, effets reçus, vérificateur des effets requis (Godseed) et
 * consommation de la grille.
 *
 * Le comptage des voisins passe par neighborRule.ts (LA règle, isolée là-bas).
 */
import type { CropRef, GameData, Mutation, Placement } from '../types/game'
import { isUsableGround } from './ground'
import { cropKey, ringCropCounts, ringPlacements, type RingArea } from './neighborRule'

export interface GridInput {
  readonly width: number
  readonly height: number
  /** Sol de chaque case, rangée par rangée : surface, bloc cassé ou case verrouillée. */
  readonly ground: readonly string[]
  readonly placements: readonly Placement[]
}

/** Case → index du placement qui l'occupe, ou null si elle est vide. */
export type Occupancy = readonly (number | null)[]

export function cropSide(data: GameData, crop: CropRef): number {
  return crop.kind === 'mutation' ? (data.mutationsById.get(crop.id)?.side ?? 1) : 1
}

export function cropExists(data: GameData, crop: CropRef): boolean {
  return crop.kind === 'mutation' ? data.mutationsById.has(crop.id) : data.baseCropsByName.has(crop.name)
}

/** Cases d'une empreinte, ou null si elle sort de la grille. */
export function footprintCells(grid: GridInput, x: number, y: number, side: number): number[] | null {
  if (x < 0 || y < 0 || x + side > grid.width || y + side > grid.height) return null
  const cells: number[] = []
  for (let dy = 0; dy < side; dy += 1) {
    for (let dx = 0; dx < side; dx += 1) cells.push((y + dy) * grid.width + x + dx)
  }
  return cells
}

/**
 * Occupation des cases. Un placement invalide (crop inconnu, hors de la grille, sur un bloc
 * cassé ou verrouillé, ou qui chevauche un placement précédent) est ignoré.
 */
export function buildOccupancy(data: GameData, grid: GridInput): Occupancy {
  const occupancy = new Array<number | null>(grid.width * grid.height).fill(null)
  grid.placements.forEach((placement, index) => {
    if (!cropExists(data, placement.crop)) return
    const cells = footprintCells(grid, placement.x, placement.y, cropSide(data, placement.crop))
    if (!cells || cells.some((cell) => occupancy[cell] !== null || !isUsableGround(grid.ground[cell] ?? ''))) return
    for (const cell of cells) occupancy[cell] = index
  })
  return occupancy
}

// ---------------------------------------------------------------------------
// Modifications de la grille (pures : elles renvoient une nouvelle grille)
// ---------------------------------------------------------------------------

export type GridChange = { readonly ok: true; readonly grid: GridInput } | { readonly ok: false; readonly reason: string }

/**
 * Pose un crop (ancre en haut à gauche) ; les crops qu'il recouvre sont retirés. Une mutation met
 * ses cases à son sol (une Blastberry passe la case en Sand) ; un crop de base garde le sol.
 */
export function withCrop(data: GameData, grid: GridInput, crop: CropRef, x: number, y: number): GridChange {
  if (!cropExists(data, crop)) return { ok: false, reason: 'Crop inconnu.' }
  const cells = footprintCells(grid, x, y, cropSide(data, crop))
  if (!cells) return { ok: false, reason: 'Le crop dépasse de la grille.' }
  if (cells.some((cell) => !isUsableGround(grid.ground[cell] ?? ''))) {
    return { ok: false, reason: 'Case verrouillée ou bloc cassé.' }
  }
  const occupancy = buildOccupancy(data, grid)
  const covered = new Set(cells.map((cell) => occupancy[cell]).filter((p): p is number => p !== null))
  const placements = grid.placements.filter((_, index) => !covered.has(index) && occupancy.includes(index))
  const surface = crop.kind === 'mutation' ? data.mutationsById.get(crop.id)?.surface : undefined
  const footprint = new Set(cells)
  const ground = surface ? grid.ground.map((value, cell) => (footprint.has(cell) ? surface : value)) : grid.ground
  return { ok: true, grid: { ...grid, ground, placements: [...placements, { crop, x, y }] } }
}

/** Retire le crop qui occupe une case (rien ne change si elle est vide). */
export function withoutCropAt(data: GameData, grid: GridInput, x: number, y: number): GridInput {
  const occupancy = buildOccupancy(data, grid)
  const index = occupancy[y * grid.width + x]
  if (index === null || index === undefined) return grid
  return { ...grid, placements: grid.placements.filter((_, i) => i !== index) }
}

/** Change le sol d'une case ; un bloc cassé ou une case verrouillée retire le crop qui s'y trouve. */
export function withGround(data: GameData, grid: GridInput, x: number, y: number, ground: string): GridInput {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return grid
  const cleared = isUsableGround(ground) ? grid : withoutCropAt(data, grid, x, y)
  const target = y * grid.width + x
  return { ...cleared, ground: cleared.ground.map((value, cell) => (cell === target ? ground : value)) }
}

// ---------------------------------------------------------------------------
// Spawns possibles et conflits
// ---------------------------------------------------------------------------

export interface SpawnOption {
  readonly mutationId: string
  /** Ancre (en haut à gauche) de l'empreinte où la mutation peut spawn. */
  readonly x: number
  readonly y: number
  readonly side: number
  readonly priority: number
}

function ringArea(grid: GridInput, occupancy: Occupancy): RingArea {
  return { width: grid.width, height: grid.height, occupancy }
}

/** Toutes les cases de l'empreinte sont vides et du sol demandé par la mutation. */
function footprintReady(grid: GridInput, occupancy: Occupancy, mutation: Mutation, x: number, y: number): boolean {
  const cells = footprintCells(grid, x, y, mutation.side)
  return cells !== null && cells.every((cell) => occupancy[cell] === null && grid.ground[cell] === mutation.surface)
}

/** Effets émis par un crop (liste de la mutation, ou du crop de base). */
export function effectsOf(data: GameData, crop: CropRef | undefined): readonly string[] {
  if (!crop) return []
  if (crop.kind === 'mutation') return data.mutationsById.get(crop.id)?.effects ?? []
  return data.baseCropsByName.get(crop.name)?.effects ?? []
}

export interface RequiredEffectsCheck {
  readonly mutationId: string
  readonly x: number
  readonly y: number
  /** L'empreinte tient dans la grille. */
  readonly fits: boolean
  /** Toutes les cases de l'empreinte sont vides et utilisables. */
  readonly footprintFree: boolean
  readonly soilOk: boolean
  /** Chaque effet requis, avec les placements autour qui l'émettent. */
  readonly effects: readonly { readonly name: string; readonly sources: readonly number[] }[]
  readonly missing: readonly string[]
  /** Au moins un crop autour qui n'est pas cette mutation (règle du Godseed). */
  readonly hasOtherCrop: boolean
  readonly ready: boolean
}

/**
 * Vérificateur des effets requis (Godseed) pour une zone : chaque effet de la liste `effects`
 * de la mutation doit être émis par un crop de l'anneau autour. Hypothèse (à vérifier) : on
 * regarde les effets émis directement par les voisins, sans compter ceux relayés par Effect Spread.
 */
export function requiredEffectsCheck(
  data: GameData,
  grid: GridInput,
  occupancy: Occupancy,
  mutation: Mutation,
  x: number,
  y: number,
): RequiredEffectsCheck {
  const cells = footprintCells(grid, x, y, mutation.side)
  const crops = grid.placements.map((p) => p.crop)
  const neighbors = cells ? [...ringPlacements(ringArea(grid, occupancy), x, y, mutation.side).keys()] : []
  const effects = mutation.effects.map((name) => ({
    name,
    sources: neighbors.filter((n) => effectsOf(data, crops[n]).includes(name)),
  }))
  const missing = effects.filter((e) => e.sources.length === 0).map((e) => e.name)
  const footprintFree =
    cells !== null && cells.every((cell) => occupancy[cell] === null && isUsableGround(grid.ground[cell] ?? ''))
  const soilOk = cells !== null && cells.every((cell) => grid.ground[cell] === mutation.surface)
  const hasOtherCrop = neighbors.some((n) => {
    const crop = crops[n]
    return !(crop?.kind === 'mutation' && crop.id === mutation.id)
  })
  return {
    mutationId: mutation.id,
    x,
    y,
    fits: cells !== null,
    footprintFree,
    soilOk,
    effects,
    missing,
    hasOtherCrop,
    ready: cells !== null && footprintFree && soilOk && missing.length === 0 && hasOtherCrop,
  }
}

/** La règle de spawn de la mutation est remplie autour de cette empreinte (déjà libre). */
function spawnRuleMet(data: GameData, grid: GridInput, occupancy: Occupancy, mutation: Mutation, x: number, y: number): boolean {
  const area = ringArea(grid, occupancy)
  switch (mutation.spawnRule) {
    case 'conditions': {
      const counts = ringCropCounts(area, grid.placements.map((p) => p.crop), x, y, mutation.side)
      return mutation.conditions.every((c) => (counts.get(cropKey(c.crop)) ?? 0) >= c.count)
    }
    case 'noAdjacentCrops':
      return ringPlacements(area, x, y, mutation.side).size === 0
    case 'requiredEffectsAround':
      return requiredEffectsCheck(data, grid, occupancy, mutation, x, y).ready
    case 'manual':
      return false
  }
}

/** Toutes les empreintes où une mutation peut spawn : sol, cases libres et règle de spawn. */
export function spawnOptions(data: GameData, grid: GridInput, occupancy: Occupancy): SpawnOption[] {
  const options: SpawnOption[] = []
  for (const mutation of data.mutations) {
    if (mutation.spawnRule === 'manual') continue
    for (let y = 0; y + mutation.side <= grid.height; y += 1) {
      for (let x = 0; x + mutation.side <= grid.width; x += 1) {
        if (!footprintReady(grid, occupancy, mutation, x, y)) continue
        if (spawnRuleMet(data, grid, occupancy, mutation, x, y)) {
          options.push({ mutationId: mutation.id, x, y, side: mutation.side, priority: mutation.spawnPriority })
        }
      }
    }
  }
  return options
}

export interface CellSpawn {
  /** Empreintes possibles qui couvrent cette case. */
  readonly options: readonly SpawnOption[]
  /** Mutations distinctes qui peuvent spawn ici. */
  readonly mutationIds: readonly string[]
  /** Plusieurs mutations différentes peuvent spawn sur cette case. */
  readonly conflict: boolean
  /** Mutation prioritaire (Godseed) qui l'emporte, si la priorité départage le conflit. */
  readonly winner: string | null
}

export function cellSpawns(grid: GridInput, options: readonly SpawnOption[]): CellSpawn[] {
  const perCell: SpawnOption[][] = Array.from({ length: grid.width * grid.height }, () => [])
  for (const option of options) {
    for (const cell of footprintCells(grid, option.x, option.y, option.side) ?? []) perCell[cell]?.push(option)
  }
  return perCell.map((cellOptions) => {
    const mutationIds = [...new Set(cellOptions.map((o) => o.mutationId))]
    const conflict = mutationIds.length > 1
    let winner: string | null = null
    if (conflict) {
      const top = Math.max(...cellOptions.map((o) => o.priority))
      const topIds = [...new Set(cellOptions.filter((o) => o.priority === top).map((o) => o.mutationId))]
      if (topIds.length === 1 && cellOptions.some((o) => o.priority < top)) winner = topIds[0] ?? null
    }
    return { options: cellOptions, mutationIds, conflict, winner }
  })
}

// ---------------------------------------------------------------------------
// Effets reçus
// ---------------------------------------------------------------------------

export interface EffectContribution {
  readonly effect: string
  /** Placement qui émet l'effet. */
  readonly source: number
  /** Placement avec Effect Spread qui le relaie, ou null si l'effet arrive directement. */
  readonly via: number | null
  /** Effet négatif annulé par Immunity. */
  readonly cancelled: boolean
}

export interface ReceivedEffects {
  readonly contributions: readonly EffectContribution[]
  /** Somme des effets chiffrés en %, négatifs annulés compris. */
  readonly totals: { readonly yield: number; readonly xp: number; readonly water: number }
  readonly immunity: boolean
  readonly bonusDrops: boolean
  readonly spread: boolean
}

const NO_EFFECTS: ReceivedEffects = {
  contributions: [],
  totals: { yield: 0, xp: 0, water: 0 },
  immunity: false,
  bonusDrops: false,
  spread: false,
}

/**
 * Effets reçus par chaque case (une case occupée reçoit ceux de son crop).
 *
 * Hypothèses, non vérifiées en jeu et regroupées ici pour être corrigées facilement :
 * - on reçoit les effets de chaque crop voisin (8 cases autour, ou l'anneau d'une mutation
 *   multi-cases), une fois par crop, même s'il touche plusieurs cases ;
 * - les effets s'additionnent (deux Harvest Boost = +40 % de yield) ;
 * - Effect Spread : un voisin qui a Effect Spread relaie les effets qu'il reçoit directement
 *   (un seul niveau, pas de propagation en chaîne) ;
 * - Immunity reçue annule tous les effets négatifs.
 */
export function receivedEffects(data: GameData, grid: GridInput, occupancy: Occupancy): ReceivedEffects[] {
  const area = ringArea(grid, occupancy)
  const crops = grid.placements.map((p) => p.crop)
  const statOf = (effect: string) => data.effects.get(effect)

  // Voisins directs de chaque placement valide (son anneau).
  const neighborsOf = new Map<number, number[]>()
  grid.placements.forEach((placement, index) => {
    if (!occupancy.includes(index)) return
    neighborsOf.set(index, [...ringPlacements(area, placement.x, placement.y, cropSide(data, placement.crop)).keys()])
  })
  const spreads = (index: number) => effectsOf(data, crops[index]).some((e) => statOf(e)?.stat === 'spread')

  const resolve = (neighbors: readonly number[], self: number | null): ReceivedEffects => {
    const contributions = new Map<string, EffectContribution>()
    const add = (effect: string, source: number, via: number | null) => {
      const key = `${effect}|${source}`
      if (source !== self && !contributions.has(key)) contributions.set(key, { effect, source, via, cancelled: false })
    }
    // Effets directs d'abord : un même effet d'une même source n'est compté qu'une fois.
    for (const neighbor of neighbors) for (const effect of effectsOf(data, crops[neighbor])) add(effect, neighbor, null)
    for (const relay of neighbors) {
      if (!spreads(relay)) continue
      for (const source of neighborsOf.get(relay) ?? []) {
        for (const effect of effectsOf(data, crops[source])) add(effect, source, relay)
      }
    }

    const list = [...contributions.values()]
    const immunity = list.some((c) => statOf(c.effect)?.stat === 'immunity')
    const final = list.map((c) => ({ ...c, cancelled: immunity && statOf(c.effect)?.type === 'negative' }))
    const totals = { yield: 0, xp: 0, water: 0 }
    for (const c of final) {
      const effect = statOf(c.effect)
      if (c.cancelled || !effect || effect.amount === null) continue
      if (effect.stat === 'yield' || effect.stat === 'xp' || effect.stat === 'water') totals[effect.stat] += effect.amount
    }
    const has = (stat: string) => final.some((c) => !c.cancelled && statOf(c.effect)?.stat === stat)
    return { contributions: final, totals, immunity, bonusDrops: has('bonusDrops'), spread: has('spread') }
  }

  const perPlacement = new Map<number, ReceivedEffects>()
  for (const [index, neighbors] of neighborsOf) perPlacement.set(index, resolve(neighbors, index))

  return occupancy.map((placement, cell) => {
    if (placement !== null) return perPlacement.get(placement) ?? NO_EFFECTS
    const x = cell % grid.width
    const y = Math.floor(cell / grid.width)
    return resolve([...ringPlacements(area, x, y, 1).keys()], null)
  })
}

// ---------------------------------------------------------------------------
// Synthèse
// ---------------------------------------------------------------------------

/** Nombre de crops posés sur la grille, par mutation (id) et par crop de base (nom). */
export function gridConsumption(
  grid: GridInput,
  occupancy: Occupancy,
): { readonly mutations: ReadonlyMap<string, number>; readonly baseCrops: ReadonlyMap<string, number> } {
  const mutations = new Map<string, number>()
  const baseCrops = new Map<string, number>()
  for (const index of new Set(occupancy.filter((p): p is number => p !== null))) {
    const crop = grid.placements[index]?.crop
    if (!crop) continue
    if (crop.kind === 'mutation') mutations.set(crop.id, (mutations.get(crop.id) ?? 0) + 1)
    else baseCrops.set(crop.name, (baseCrops.get(crop.name) ?? 0) + 1)
  }
  return { mutations, baseCrops }
}

export interface GridAnalysis {
  readonly occupancy: Occupancy
  readonly options: readonly SpawnOption[]
  readonly cells: readonly CellSpawn[]
  readonly effects: readonly ReceivedEffects[]
}

/** Tout ce que l'interface affiche pour une grille. */
export function analyzeGrid(data: GameData, grid: GridInput): GridAnalysis {
  const occupancy = buildOccupancy(data, grid)
  const options = spawnOptions(data, grid, occupancy)
  return { occupancy, options, cells: cellSpawns(grid, options), effects: receivedEffects(data, grid, occupancy) }
}
