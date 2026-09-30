/** Outils et superpositions de l'onglet Grille. */

export type GridTool = 'place' | 'erase' | 'ground' | 'inspect' | 'godseed'

export interface Overlays {
  readonly spawns: boolean
  readonly conflicts: boolean
  readonly effects: boolean
  readonly water: boolean
}

export const DEFAULT_OVERLAYS: Overlays = { spawns: true, conflicts: true, effects: false, water: false }

/** Glisser-déposer : un crop est transmis sous la forme « mutation:<id> » ou « base:<nom> ». */
export const DRAG_TYPE = 'text/plain'
