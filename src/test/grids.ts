/** Utilitaires de test : construire une grille à partir de rangées de texte (même format que les plans). */
import { parseLayout, type LayoutContext } from '../data/layouts'
import type { RawLayout } from '../data/schema'
import { cropSide, type GridInput } from '../logic/grid'
import type { GameData, LayoutPreset } from '../types/game'

export function layoutContext(data: GameData): LayoutContext {
  return {
    surfaces: new Set(data.surfaces),
    defaultSurface: data.surfaces[0] ?? 'Dirt',
    maxWidth: data.mechanics.greenhouse.width,
    maxHeight: data.mechanics.greenhouse.height,
    resolveCrop: (name) => {
      const mutation = data.mutationsByName.get(name)
      if (mutation) return { kind: 'mutation', id: mutation.id }
      return data.baseCropsByName.has(name) ? { kind: 'base', name } : null
    },
    sideOf: (crop) => cropSide(data, crop),
  }
}

/** Grille de test : légende { lettre: crop ou entrée de plan }, rangées, mutations multi-cases. */
export function gridFrom(
  data: GameData,
  rows: readonly string[],
  legend: RawLayout['legend'] = {},
  placements?: RawLayout['placements'],
): LayoutPreset {
  const { preset, issues } = parseLayout({ id: 'test', name: 'test', rows: [...rows], legend, placements }, 0, layoutContext(data))
  if (!preset) throw new Error(issues.map((issue) => issue.message).join('\n'))
  return preset
}

export function presetById(data: GameData, id: string): LayoutPreset {
  const preset = data.layouts.find((layout) => layout.id === id)
  if (!preset) throw new Error(`Plan introuvable : ${id}`)
  return preset
}

export function cell(grid: GridInput, x: number, y: number): number {
  return y * grid.width + x
}
