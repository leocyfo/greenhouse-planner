import { goToTab } from '../../app/navigation'
import { getGameData } from '../../data'
import { vineProgress } from '../../logic/tools'
import { useAppStore } from '../../store/appStore'
import { activeLayoutOf, toGridInput } from '../../store/grids'
import type { LayoutPreset } from '../../types/game'
import { emptyGrid, farmsIn, farmsName, largestFirst, ownPlotOf, packFarms, type PackResult } from './farmPacking'

/** Poser des fermes du guide dans un greenhouse (ensemble quand elles tiennent), ou l'ouvrir dans la Grille. */
export function useFarmActions() {
  const grids = useAppStore((s) => s.grids)
  const vines = useAppStore((s) => s.tools.vines)
  const loadPreset = useAppStore((s) => s.loadPreset)
  const addGeneratedLayout = useAppStore((s) => s.addGeneratedLayout)
  const replaceLayoutContent = useAppStore((s) => s.replaceLayoutContent)
  const setActiveGreenhouse = useAppStore((s) => s.setActiveGreenhouse)
  const setActiveLayout = useAppStore((s) => s.setActiveLayout)
  const data = getGameData()
  const unlocked = vineProgress(data, vines).unlockedGreenhouses

  return {
    greenhouses: grids.greenhouses.map((_, index) => index),
    unlocked,
    /**
     * Pose les fermes, sans quitter le Guide : `add`, dans le plan affiché, à côté des fermes en cours
     * (voir placementFor) ; `new`, dans un nouveau plan du greenhouse, toutes ensemble tant qu'elles
     * tiennent.
     */
    place: (greenhouse: number, presets: readonly LayoutPreset[], mode: 'add' | 'new') => {
      const reuse = mode === 'add'
      const ownPlot = ownPlotOf(data)
      const active = grids.greenhouses[greenhouse] ? activeLayoutOf(grids.greenhouses[greenhouse]) : undefined
      let rest = largestFirst(data, presets)
      if (reuse && active) {
        const grid = toGridInput(active, data.mechanics.greenhouse)
        const result = packFarms(data, grid, rest, farmsIn(data, grid), ownPlot)
        if (result.added.length > 0) replaceLayoutContent(greenhouse, active.id, farmsName(result.farms), result.grid.ground, result.grid.placements)
        rest = [...result.rest]
      }
      while (rest.length > 0) {
        const result = packFarms(data, emptyGrid(data), rest, [], ownPlot)
        const [first] = rest
        if (result.added.length === 0 && first) {
          loadPreset(greenhouse, first.id)
          rest = rest.slice(1)
          continue
        }
        addGeneratedLayout(greenhouse, farmsName(result.added), result.grid.ground, result.grid.placements)
        rest = [...result.rest]
      }
    },
    /** Passe une ferme à son étape suivante : le plan affiché du greenhouse devient `result` (voir upgradeFor). */
    upgrade: (greenhouse: number, result: PackResult) => {
      const state = grids.greenhouses[greenhouse]
      const active = state ? activeLayoutOf(state) : undefined
      if (active) replaceLayoutContent(greenhouse, active.id, farmsName(result.farms), result.grid.ground, result.grid.placements)
    },
    /** Affiche ce greenhouse dans la Grille, sur le plan qui contient la ferme s'il y en a un. */
    open: (greenhouse: number, chapterId?: string) => {
      const state = grids.greenhouses[greenhouse]
      const farm = chapterId
        ? state?.layouts.find((layout) => farmsIn(data, toGridInput(layout, data.mechanics.greenhouse)).some((f) => f.chapter.id === chapterId))
        : undefined
      if (farm) setActiveLayout(greenhouse, farm.id)
      setActiveGreenhouse(greenhouse)
      goToTab('grille')
    },
  }
}
