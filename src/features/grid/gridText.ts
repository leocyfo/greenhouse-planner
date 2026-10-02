/** Textes de la grille : abréviations des crops, coordonnées des cases, libellés des sols. */
import { plural } from '../../components/labels'
import { BROKEN_GROUND, LOCKED_GROUND } from '../../logic/ground'
import { tr } from '../../i18n/locale'
import type { GridAnalysis, GridInput } from '../../logic/grid'
import type { GameData } from '../../types/game'

/**
 * Abréviations uniques pour afficher un crop dans une case de 44 px :
 * initiales pour un nom en plusieurs mots (« Nether Wart » → « NW »), sinon le début du nom,
 * rallongé jusqu'à ne plus ressembler à aucun autre (« Duskbloom » → « Dusk », « Dustgrain » → « Dust »).
 */
export function buildShortLabels(names: readonly string[]): Map<string, string> {
  const words = (name: string) => name.split(/[\s-]+/).filter(Boolean)
  const candidate = (name: string, length: number) => {
    const parts = words(name)
    if (parts.length > 1) {
      const initials = parts.map((part) => part.charAt(0).toUpperCase()).join('')
      // En cas de doublon, on complète avec la suite du dernier mot.
      return length <= 3 ? initials : initials + (parts.at(-1) ?? '').slice(1, length - 2)
    }
    return name.slice(0, length)
  }
  const labels = new Map<string, string>()
  for (const name of names) {
    let length = 3
    let label = candidate(name, length)
    while (
      length < name.length &&
      names.some((other) => other !== name && candidate(other, length) === label)
    ) {
      length += 1
      label = candidate(name, length)
    }
    labels.set(name, label)
  }
  return labels
}

const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Coordonnées façon tableur : colonne en lettre, rangée en chiffre (A1 en haut à gauche). */
export function cellName(x: number, y: number): string {
  return `${COLUMNS[x] ?? String(x + 1)}${y + 1}`
}

export function groundLabel(ground: string): string {
  if (ground === BROKEN_GROUND) return tr('Bloc cassé', 'Broken block')
  if (ground === LOCKED_GROUND) return tr('Case verrouillée', 'Locked cell')
  return ground
}

export interface GridSummary {
  readonly crops: number
  /** Emplacements où une mutation peut spawn (sans les spawns au hasard, Lonelily). */
  readonly spots: number
  /** Mutations différentes qui peuvent spawn. */
  readonly kinds: number
  /** Cases où plusieurs mutations peuvent spawn. */
  readonly conflicts: number
}

/** Bilan affiché sous la grille. */
export function gridSummary(data: GameData, grid: GridInput, analysis: GridAnalysis): GridSummary {
  const drawn = analysis.options.filter((option) => data.mutationsById.get(option.mutationId)?.spawnRule !== 'noAdjacentCrops')
  return {
    crops: grid.placements.length,
    spots: drawn.length,
    kinds: new Set(drawn.map((option) => option.mutationId)).size,
    conflicts: analysis.cells.filter((cell) => cell.conflict).length,
  }
}

/** « 12 crops posés · 4 emplacements de spawn (2 mutations) · 1 case en conflit ». */
export function gridSummaryText(summary: GridSummary): string {
  const parts = [
    tr(`${plural(summary.crops, 'crop')} posé${summary.crops > 1 ? 's' : ''}`, `${plural(summary.crops, 'crop')} placed`),
    summary.spots === 0
      ? tr('aucun emplacement de spawn', 'no spawn spot')
      : tr(
          `${plural(summary.spots, 'emplacement')} de spawn (${plural(summary.kinds, 'mutation')})`,
          `${plural(summary.spots, 'spawn spot')} (${plural(summary.kinds, 'mutation')})`,
        ),
  ]
  if (summary.conflicts > 0) parts.push(tr(`${plural(summary.conflicts, 'case')} en conflit`, `${plural(summary.conflicts, 'conflict cell')}`))
  return parts.join(' · ')
}
