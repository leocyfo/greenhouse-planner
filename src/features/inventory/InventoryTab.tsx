import { useMemo, useState } from 'react'
import { SegmentedControl } from '../../components/SegmentedControl'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { useGoalPlan } from '../../store/useGoalPlan'
import { InventoryFiltersBar } from './InventoryFiltersBar'
import { DEFAULT_FILTERS, filterMutations } from './inventoryFilters'
import { InventoryHeader } from './InventoryHeader'
import { InventoryStats } from './InventoryStats'
import { MutationList } from './MutationList'
import { MutationsSack } from './MutationsSack'

type View = 'sack' | 'list'

/**
 * Onglet Inventaire : le Mutations Sack (une case par mutation, fiche au clic) ou la liste par
 * rareté. Sur grand écran, affichage, chiffres et filtres forment une colonne à gauche et le sac
 * prend tout le reste de la page ; sur mobile, les réglages passent au-dessus.
 */
export function InventoryTab() {
  const data = getGameData()
  const goalPlan = useGoalPlan()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [view, setView] = useState<View>('sack')
  const { plan, analyzed } = goalPlan

  const visible = useMemo(
    () => filterMutations(data.mutations, filters, plan, analyzed),
    [data, filters, plan, analyzed],
  )
  const matches = useMemo(() => new Set(visible.map((mutation) => mutation.id)), [visible])

  return (
    <div className="space-y-6">
      <InventoryHeader goalPlan={goalPlan} />

      <div className="grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <SegmentedControl
            legend={tr('Affichage', 'View')}
            name="inventory-view"
            value={view}
            onChange={setView}
            options={[
              { value: 'sack', label: 'Mutations Sack' },
              { value: 'list', label: tr('Liste', 'List') },
            ]}
          />
          <InventoryStats goalPlan={goalPlan} />
          <InventoryFiltersBar filters={filters} onChange={setFilters} shown={visible.length} total={data.mutations.length} />
        </div>

        <div key={view} className="min-w-0 animate-fade-up">
          {view === 'sack' ? (
            <MutationsSack matches={matches} />
          ) : (
            <MutationList mutations={visible} goalPlan={goalPlan} onResetFilters={() => setFilters(DEFAULT_FILTERS)} />
          )}
        </div>

      </div>
    </div>
  )
}
