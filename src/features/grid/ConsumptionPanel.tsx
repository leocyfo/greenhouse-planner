import { useMemo, useState } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { Panel } from '../../components/Panel'
import { SegmentedControl } from '../../components/SegmentedControl'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { buildOccupancy, gridConsumption } from '../../logic/grid'
import { vineProgress } from '../../logic/tools'
import { useAppStore } from '../../store/appStore'
import { activeLayoutOf, toGridInput } from '../../store/grids'

type Scope = 'current' | 'all'

/** Ce que la grille consomme, comparé à l'inventaire. */
export function ConsumptionPanel() {
  const data = getGameData()
  const size = data.mechanics.greenhouse
  const grids = useAppStore((s) => s.grids)
  const inventory = useAppStore((s) => s.progress.inventory)
  const vines = useAppStore((s) => s.tools.vines)
  const [scope, setScope] = useState<Scope>('current')

  const totals = useMemo(() => {
    // « Tous » = les greenhouses débloqués (le 1er, plus ceux achetés avec le Plot Limit).
    const unlocked = vineProgress(data, vines).unlockedGreenhouses
    const layouts =
      scope === 'current'
        ? [grids.greenhouses[grids.activeGreenhouse]]
        : grids.greenhouses.filter((_, index) => unlocked.includes(index))
    const mutations = new Map<string, number>()
    const baseCrops = new Map<string, number>()
    for (const greenhouse of layouts) {
      const layout = greenhouse ? activeLayoutOf(greenhouse) : undefined
      if (!layout) continue
      const grid = toGridInput(layout, size)
      const consumption = gridConsumption(grid, buildOccupancy(data, grid))
      for (const [id, count] of consumption.mutations) mutations.set(id, (mutations.get(id) ?? 0) + count)
      for (const [name, count] of consumption.baseCrops) baseCrops.set(name, (baseCrops.get(name) ?? 0) + count)
    }
    return { mutations, baseCrops }
  }, [data, grids, scope, size, vines])

  const mutations = [...totals.mutations].sort(
    ([a], [b]) => (data.mutationsById.get(a)?.name ?? a).localeCompare(data.mutationsById.get(b)?.name ?? b, 'fr'),
  )
  const baseCrops = [...totals.baseCrops].sort(([a], [b]) => a.localeCompare(b, 'fr'))

  return (
    <Panel title={tr('Ce que la grille consomme', 'What the grid uses')}>
      <SegmentedControl
        legend={tr('Grilles comptées', 'Grids counted')}
        name="consumption-scope"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'current', label: tr('Ce greenhouse', 'This greenhouse') },
          { value: 'all', label: tr('Tous les débloqués', 'All unlocked') },
        ]}
      />
      {mutations.length === 0 && baseCrops.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{tr('Aucun crop posé.', 'No crop placed.')}</p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          {mutations.length > 0 && (
            <ul className="space-y-1">
              {mutations.map(([id, placed]) => {
                const owned = inventory[id] ?? 0
                const missing = Math.max(0, placed - owned)
                return (
                  <li key={id} className="flex items-baseline justify-between gap-2">
                    <CropLabel crop={{ kind: 'mutation', id }} />
                    <span className={`text-xs tabular-nums ${missing > 0 ? 'text-warning' : 'text-ink-muted'}`}>
                      {tr(`${placed} posées / ${owned} en stock`, `${placed} placed / ${owned} in stock`)}
                      {missing > 0 ? tr(` · manque ${missing}`, ` · ${missing} missing`) : ' ✓'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {baseCrops.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-ink-muted">{tr('Crops de base', 'Base crops')}</p>
              <p className="text-xs">{baseCrops.map(([name, count]) => `${name} × ${count}`).join(' · ')}</p>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
