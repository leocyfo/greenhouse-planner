/** Transitions pures des grilles : plans de chaque greenhouse et plan actif. */
import type { GridInput } from '../logic/grid'
import type { LayoutPreset } from '../types/game'
import type { GreenhouseState, GridLayoutState, GridState } from './state'

export interface GridSize {
  readonly width: number
  readonly height: number
}

export function emptyLayout(id: string, name: string, size: GridSize, surface: string): GridLayoutState {
  return { id, name, ground: new Array<string>(size.width * size.height).fill(surface), placements: [] }
}

/** Plan AVRG recopié dans une grille complète (ancré en haut à gauche). */
export function layoutFromPreset(id: string, preset: LayoutPreset, size: GridSize, surface: string): GridLayoutState {
  const ground = new Array<string>(size.width * size.height).fill(surface)
  for (let y = 0; y < Math.min(preset.height, size.height); y += 1) {
    for (let x = 0; x < Math.min(preset.width, size.width); x += 1) {
      ground[y * size.width + x] = preset.ground[y * preset.width + x] ?? surface
    }
  }
  return { id, name: preset.name, ground, placements: preset.placements }
}

export function toGridInput(layout: GridLayoutState, size: GridSize): GridInput {
  return { width: size.width, height: size.height, ground: layout.ground, placements: layout.placements }
}

/** Premier nom libre « Plan N ». */
export function nextLayoutName(layouts: readonly GridLayoutState[]): string {
  const names = new Set(layouts.map((layout) => layout.name))
  let n = layouts.length + 1
  while (names.has(`Plan ${n}`)) n += 1
  return `Plan ${n}`
}

function mapGreenhouse(state: GridState, index: number, change: (greenhouse: GreenhouseState) => GreenhouseState): GridState {
  return { ...state, greenhouses: state.greenhouses.map((g, i) => (i === index ? change(g) : g)) }
}

export function activeLayoutOf(greenhouse: GreenhouseState): GridLayoutState | undefined {
  return greenhouse.layouts.find((layout) => layout.id === greenhouse.activeLayoutId) ?? greenhouse.layouts[0]
}

export function withActiveGreenhouse(state: GridState, index: number): GridState {
  return index >= 0 && index < state.greenhouses.length ? { ...state, activeGreenhouse: index } : state
}

export function withActiveLayout(state: GridState, greenhouse: number, layoutId: string): GridState {
  return mapGreenhouse(state, greenhouse, (g) =>
    g.layouts.some((layout) => layout.id === layoutId) ? { ...g, activeLayoutId: layoutId } : g,
  )
}

/** Ajoute un plan au greenhouse et l'active. */
export function withLayoutAdded(state: GridState, greenhouse: number, layout: GridLayoutState): GridState {
  return mapGreenhouse(state, greenhouse, (g) => ({ layouts: [...g.layouts, layout], activeLayoutId: layout.id }))
}

/** Supprime un plan ; le dernier plan d'un greenhouse est remplacé par `fallback` (vide). */
export function withLayoutRemoved(
  state: GridState,
  greenhouse: number,
  layoutId: string,
  fallback: GridLayoutState,
): GridState {
  return mapGreenhouse(state, greenhouse, (g) => {
    const layouts = g.layouts.filter((layout) => layout.id !== layoutId)
    if (layouts.length === 0) return { layouts: [fallback], activeLayoutId: fallback.id }
    const activeLayoutId = g.activeLayoutId === layoutId ? (layouts[0]?.id ?? fallback.id) : g.activeLayoutId
    return { layouts, activeLayoutId }
  })
}

export function withLayoutChanged(
  state: GridState,
  greenhouse: number,
  layoutId: string,
  change: (layout: GridLayoutState) => GridLayoutState,
): GridState {
  return mapGreenhouse(state, greenhouse, (g) => ({
    ...g,
    layouts: g.layouts.map((layout) => (layout.id === layoutId ? change(layout) : layout)),
  }))
}
