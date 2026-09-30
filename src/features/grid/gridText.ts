/** Textes de la grille : abréviations des crops, coordonnées des cases, libellés des sols. */
import { BROKEN_GROUND, LOCKED_GROUND } from '../../logic/ground'

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
  if (ground === BROKEN_GROUND) return 'Bloc cassé'
  if (ground === LOCKED_GROUND) return 'Case verrouillée'
  return ground
}
