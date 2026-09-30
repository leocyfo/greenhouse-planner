/**
 * Couleurs de rareté et de sol : définies ici UNE fois, réutilisées dans toute l'application.
 * Les clés sont les noms utilisés dans mutations.json (`rarities` et `surfaces`) ; un test
 * vérifie que chaque valeur du JSON a sa couleur. La couleur n'est jamais le seul indicateur :
 * elle accompagne toujours le nom de la rareté ou du sol.
 */
import { wikiTexture } from '../data/wikiImages'

/** Common gris, Uncommon vert, Rare bleu, Epic violet, Legendary or (lisibles sur fond sombre). */
export const RARITY_COLORS: Readonly<Record<string, string>> = {
  COMMON: '#a8b0bd',
  UNCOMMON: '#5fd068',
  RARE: '#5b9cff',
  EPIC: '#b77bf2',
  LEGENDARY: '#f5b841',
}

/** Code couleur Minecraft (§) de chaque rareté, comme dans les infobulles du jeu. */
export const RARITY_MC_CODES: Readonly<Record<string, string>> = {
  COMMON: 'f',
  UNCOMMON: 'a',
  RARE: '9',
  EPIC: '5',
  LEGENDARY: '6',
}

/** Couleurs de sol fixes et distinctes, inspirées des blocs Minecraft. */
export const SOIL_COLORS: Readonly<Record<string, string>> = {
  Dirt: '#8a5530',
  'Soul Sand': '#3d3230',
  Mycelium: '#8f6fa6',
  Sand: '#f0cf7a',
  'End Stone': '#d7e8a9',
}

/** État d'une mutation dans l'Encyclopédie (toujours accompagné d'une icône et d'un texte). */
export const STATE_COLORS = {
  complete: '#6cc070',
  available: '#4fd1c5',
  locked: '#6b7280',
  special: '#f2c14e',
} as const

/**
 * Grille : bordure d'un crop posé, d'un spawn possible et d'un conflit, pastilles des effets reçus
 * et gouttes d'eau. Toujours doublées d'une explication (légende, panneau Case, noms accessibles).
 */
export const GRID_COLORS = {
  placed: '#f5a524',
  spawn: '#6cc070',
  conflict: '#f07167',
  effectPositive: '#6cc070',
  effectNegative: '#f07167',
  effectMixed: '#f2c14e',
  waterOk: '#5fb4ff',
  waterShort: '#f07167',
} as const

/** Arêtes du graphe : normales et mises en évidence (couleurs concrètes pour les flèches SVG). */
export const EDGE_COLORS = {
  normal: '#3a4050',
  highlighted: '#6cc070',
} as const

/** Couleur neutre si une rareté ou un sol ajouté au JSON n'a pas encore de couleur. */
export const FALLBACK_COLOR = '#6b7280'

export function rarityColor(rarity: string): string {
  return RARITY_COLORS[rarity] ?? FALLBACK_COLOR
}

export function soilColor(surface: string): string {
  return SOIL_COLORS[surface] ?? FALLBACK_COLOR
}

/**
 * Fond CSS d'un sol : sa texture du wiki (face du dessus du bloc) sur sa couleur, ou la couleur
 * seule si le wiki n'a pas d'image. À afficher avec image-rendering: pixelated.
 */
export function soilBackground(surface: string): string {
  const texture = wikiTexture(surface)
  return texture ? `url("${texture}") center / 100% 100% no-repeat, ${soilColor(surface)}` : soilColor(surface)
}
