/**
 * Exemple de plantation pour la fiche d'une mutation : la mutation au centre d'une petite grille
 * et ses ingrédients dans l'anneau autour (milieux des côtés d'abord, puis coins), les mutations
 * 2x2 et 3x3 posées le long de l'emplacement. Chaque exemple est vérifié par la logique de la
 * grille : s'il ne fait pas spawn la mutation, il n'est pas proposé.
 */
import type { CropRef, GameData, Mutation, Placement } from '../types/game'
import { buildOccupancy, cropSide, footprintCells, spawnOptions, type GridInput } from './grid'

interface Box {
  readonly x: number
  readonly y: number
  readonly side: number
}

export interface PlantingPreview {
  readonly width: number
  readonly height: number
  /** Empreinte de la mutation (ancre en haut à gauche). */
  readonly target: Box
  /** Ingrédients posés autour (ancres en haut à gauche). */
  readonly placements: readonly Placement[]
}

/** Ingrédient à poser : `cells` cases de l'anneau à couvrir avec un crop de côté `side`. */
interface Need {
  readonly crop: CropRef
  readonly side: number
  readonly cells: number
}

/** Ancre possible pour un ingrédient multi-cases : ses cases, dont celles de l'anneau. */
interface Candidate {
  readonly x: number
  readonly y: number
  readonly cells: readonly number[]
  readonly ringCells: number
}

const inside = (box: Box, x: number, y: number) =>
  x >= box.x && x < box.x + box.side && y >= box.y && y < box.y + box.side

/** Cases de l'anneau autour de l'emplacement : milieux des côtés (haut, gauche, droite, bas), puis coins. */
function ringOrder(target: Box, width: number): number[] {
  const { x, y, side } = target
  const cells: [number, number][] = []
  for (let i = 0; i < side; i += 1) cells.push([x + i, y - 1])
  for (let i = 0; i < side; i += 1) cells.push([x - 1, y + i])
  for (let i = 0; i < side; i += 1) cells.push([x + side, y + i])
  for (let i = 0; i < side; i += 1) cells.push([x + i, y + side])
  cells.push([x - 1, y - 1], [x + side, y - 1], [x - 1, y + side], [x + side, y + side])
  return cells.map(([cx, cy]) => cy * width + cx)
}

/** Ancres d'un crop de côté `side` qui touchent l'anneau sans chevaucher l'emplacement. */
function candidatesFor(grid: GridInput, target: Box, ring: ReadonlySet<number>, side: number): Candidate[] {
  const center = target.x + target.side / 2
  const middle = target.y + target.side / 2
  const found: (Candidate & { readonly distance: number })[] = []
  for (let y = 0; y + side <= grid.height; y += 1) {
    for (let x = 0; x + side <= grid.width; x += 1) {
      const cells = footprintCells(grid, x, y, side) ?? []
      if (cells.some((cell) => inside(target, cell % grid.width, Math.floor(cell / grid.width)))) continue
      const ringCells = cells.filter((cell) => ring.has(cell)).length
      if (ringCells === 0) continue
      const distance = Math.abs(x + side / 2 - center) + Math.abs(y + side / 2 - middle)
      found.push({ x, y, cells, ringCells, distance })
    }
  }
  return found.sort((a, b) => b.ringCells - a.ringCells || a.distance - b.distance)
}

/** Pose les ingrédients 2x2 et 3x3 pour couvrir exactement leurs cases de l'anneau (retour arrière). */
function placeLarge(
  grid: GridInput,
  target: Box,
  ring: ReadonlySet<number>,
  needs: readonly Need[],
  occupied: Set<number>,
  placed: Placement[],
): boolean {
  const candidates = new Map<number, Candidate[]>()
  const candidatesOf = (side: number) => {
    const known = candidates.get(side)
    if (known) return known
    const computed = candidatesFor(grid, target, ring, side)
    candidates.set(side, computed)
    return computed
  }

  const step = (index: number, remaining: number, first: number): boolean => {
    const need = needs[index]
    if (!need) return true
    if (remaining === 0) return step(index + 1, needs[index + 1]?.cells ?? 0, 0)
    const list = candidatesOf(need.side)
    for (let i = first; i < list.length; i += 1) {
      const candidate = list[i]
      if (!candidate || candidate.ringCells > remaining || candidate.cells.some((cell) => occupied.has(cell))) continue
      for (const cell of candidate.cells) occupied.add(cell)
      placed.push({ crop: need.crop, x: candidate.x, y: candidate.y })
      if (step(index, remaining - candidate.ringCells, i + 1)) return true
      for (const cell of candidate.cells) occupied.delete(cell)
      placed.pop()
    }
    return false
  }
  return step(0, needs[0]?.cells ?? 0, 0)
}

/** La logique de la grille fait bien spawn la mutation sur l'emplacement de l'exemple. */
function spawnsHere(data: GameData, mutation: Mutation, preview: PlantingPreview): boolean {
  const ground = new Array<string>(preview.width * preview.height).fill(mutation.surface)
  const grid: GridInput = { width: preview.width, height: preview.height, ground, placements: preview.placements }
  // Chaque mutation posée garde son sol, comme dans la grille.
  for (const placement of preview.placements) {
    const surface = placement.crop.kind === 'mutation' ? data.mutationsById.get(placement.crop.id)?.surface : undefined
    if (!surface) continue
    const cells = footprintCells(grid, placement.x, placement.y, cropSide(data, placement.crop)) ?? []
    for (const cell of cells) ground[cell] = surface
  }
  return spawnOptions(data, grid, buildOccupancy(data, grid)).some(
    (option) => option.mutationId === mutation.id && option.x === preview.target.x && option.y === preview.target.y,
  )
}

/**
 * Exemple minimal qui fait spawn la mutation, ou null si sa règle ne s'y prête pas (mutation à
 * obtenir à la main, effets requis autour) ou si aucun placement n'a été trouvé.
 */
export function plantingPreview(data: GameData, mutation: Mutation): PlantingPreview | null {
  if (mutation.spawnRule === 'manual' || mutation.spawnRule === 'requiredEffectsAround') return null

  const needs: Need[] =
    mutation.spawnRule === 'conditions'
      ? mutation.conditions.map((c) => ({ crop: c.crop, side: cropSide(data, c.crop), cells: c.count }))
      : []
  // Marge : la plus grande empreinte d'ingrédient, plus une rangée vide pour situer l'ensemble.
  const margin = Math.max(1, ...needs.map((need) => need.side)) + 1
  const size = mutation.side + 2 * margin
  const target: Box = { x: margin, y: margin, side: mutation.side }
  const grid: GridInput = { width: size, height: size, ground: [], placements: [] }
  const order = ringOrder(target, size)
  const ring = new Set(order)
  const occupied = new Set(footprintCells(grid, target.x, target.y, target.side))
  const placements: Placement[] = []

  const large = needs.filter((need) => need.side > 1).sort((a, b) => b.side - a.side)
  if (!placeLarge(grid, target, ring, large, occupied, placements)) return null
  const free = order.filter((cell) => !occupied.has(cell))
  for (const need of needs.filter((n) => n.side === 1)) {
    for (let i = 0; i < need.cells; i += 1) {
      const cell = free.shift()
      if (cell === undefined) return null
      placements.push({ crop: need.crop, x: cell % size, y: Math.floor(cell / size) })
    }
  }

  const preview = cropped(data, target, placements)
  return spawnsHere(data, mutation, preview) ? preview : null
}

/** Recadre sur l'anneau et les ingrédients posés, avec une rangée vide autour pour situer l'ensemble. */
function cropped(data: GameData, target: Box, placements: readonly Placement[]): PlantingPreview {
  const boxes: Box[] = [
    { x: target.x - 1, y: target.y - 1, side: target.side + 2 },
    ...placements.map((p) => ({ x: p.x, y: p.y, side: cropSide(data, p.crop) })),
  ]
  const left = Math.min(...boxes.map((box) => box.x)) - 1
  const top = Math.min(...boxes.map((box) => box.y)) - 1
  const right = Math.max(...boxes.map((box) => box.x + box.side))
  const bottom = Math.max(...boxes.map((box) => box.y + box.side))
  return {
    width: right - left + 1,
    height: bottom - top + 1,
    target: { ...target, x: target.x - left, y: target.y - top },
    placements: placements.map((p) => ({ ...p, x: p.x - left, y: p.y - top })),
  }
}
