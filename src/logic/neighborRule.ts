/**
 * Règle de comptage des voisins, isolée ici pour être corrigée en UN seul endroit.
 *
 * Règle actuelle, confirmée par les plans du guide AVRG : une mutation multi-cases compte
 * UNE fois par case qu'elle occupe dans l'anneau autour de l'emplacement de spawn.
 * Exemples : l'anneau du Snoozling (16 cases) = 4 + 3 + 3 + 3 + 3 ; dans le Snoozling Complex,
 * la case du Stoplight Petal touche 2 Snoozlings et 2 Noctilumes, soit 4 cases de chaque.
 *
 * Le calculateur (conversion cases → mutations) et la grille utilisent tous deux ringCount :
 * changer cette fonction change la règle partout.
 */
import type { CropRef } from '../types/game'

/**
 * LA règle : combien compte une mutation qui occupe `cellsInRing` cases de l'anneau.
 * Règle actuelle : une fois par case. Si le jeu comptait chaque mutation une seule fois,
 * il suffirait de renvoyer `cellsInRing > 0 ? 1 : 0`.
 */
export function ringCount(cellsInRing: number): number {
  return cellsInRing
}

/**
 * Nombre maximal de cases de l'anneau qu'une mutation de côté `side` peut occuper :
 * elle ne peut longer qu'un seul côté de l'emplacement sans le recouvrir, donc `side` cases.
 */
function maxCellsInRing(side: number): number {
  return side
}

/**
 * Nombre minimal de mutations de côté `side` pour fournir `cells` cases à un emplacement.
 * Ex. « 6 Snoozling » (3x3) → 2 Snoozlings ; « 2 PlantBoy Advance » (2x2) → 1 PlantBoy.
 */
export function mutationsForCells(cells: number, side: number): number {
  return Math.ceil(cells / ringCount(maxCellsInRing(side)))
}

/** Clé d'un crop pour compter ses voisins : « mutation:<id> » ou « base:<nom> ». */
export function cropKey(crop: CropRef): string {
  return crop.kind === 'mutation' ? `mutation:${crop.id}` : `base:${crop.name}`
}

export interface RingArea {
  readonly width: number
  readonly height: number
  /** Index du placement qui occupe chaque case (rangée par rangée), ou null si vide. */
  readonly occupancy: readonly (number | null)[]
}

/**
 * Crops présents dans l'anneau autour d'une empreinte (x, y, côté) : index du placement →
 * nombre de ses cases dans l'anneau. Les cases hors de la grille sont ignorées.
 */
export function ringPlacements(area: RingArea, x: number, y: number, side: number): Map<number, number> {
  const cells = new Map<number, number>()
  for (let ry = y - 1; ry <= y + side; ry += 1) {
    for (let rx = x - 1; rx <= x + side; rx += 1) {
      const inside = rx >= x && rx < x + side && ry >= y && ry < y + side
      if (inside || rx < 0 || ry < 0 || rx >= area.width || ry >= area.height) continue
      const placement = area.occupancy[ry * area.width + rx]
      if (placement !== null && placement !== undefined) cells.set(placement, (cells.get(placement) ?? 0) + 1)
    }
  }
  return cells
}

/**
 * Voisins d'une empreinte comptés selon LA règle : clé de crop → total, chaque crop comptant
 * ringCount(nombre de ses cases dans l'anneau).
 */
export function ringCropCounts(
  area: RingArea,
  crops: readonly CropRef[],
  x: number,
  y: number,
  side: number,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const [placement, cellsInRing] of ringPlacements(area, x, y, side)) {
    const crop = crops[placement]
    if (!crop) continue
    const key = cropKey(crop)
    counts.set(key, (counts.get(key) ?? 0) + ringCount(cellsInRing))
  }
  return counts
}
