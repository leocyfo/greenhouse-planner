/**
 * Géométrie des empreintes carrées (1x1, 2x2, 3x3).
 * Utilisée par la validation des données et, plus tard, par le calcul des voisins de la grille.
 */
import type { MutationSize } from '../types/game'

/** Côté de l'empreinte en cases : '2x2' → 2. */
export function sideOf(size: MutationSize): number {
  switch (size) {
    case '1x1':
      return 1
    case '2x2':
      return 2
    case '3x3':
      return 3
  }
}

/**
 * Nombre de cases de l'anneau qui entoure une empreinte de côté `side` :
 * (side + 2)² − side² = 4 × side + 4, soit 8 (1x1), 12 (2x2) ou 16 (3x3).
 * Les conditions d'une mutation ne peuvent pas demander plus de cases que ça.
 */
export function ringCellCount(side: number): number {
  return 4 * side + 4
}
