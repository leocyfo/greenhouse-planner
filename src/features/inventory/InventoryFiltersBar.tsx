import { FilterSelect } from '../../components/FilterSelect'
import { formatRarity } from '../../components/labels'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { ALL, DEFAULT_FILTERS, hasActiveFilters, type InventoryFilters } from './inventoryFilters'

interface InventoryFiltersBarProps {
  readonly filters: InventoryFilters
  readonly onChange: (filters: InventoryFilters) => void
  readonly shown: number
  readonly total: number
}

/** Recherche et filtres : rareté, sol, taille, besoin, analyse (2 colonnes à côté du sac). */
export function InventoryFiltersBar({ filters, onChange, shown, total }: InventoryFiltersBarProps) {
  const data = getGameData()
  const sizes = [...new Set(data.mutations.map((m) => m.size))].sort()
  const set = <K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]) =>
    onChange({ ...filters, [key]: value })

  return (
    <div className="space-y-2">
      <div
        role="search"
        className="grid grid-cols-2 items-end gap-3 rounded-xl border border-line bg-panel p-3 sm:grid-cols-3 lg:grid-cols-2"
      >
        <label className="col-span-2 flex flex-col gap-1 text-xs text-ink-muted sm:col-span-3 lg:col-span-2">
          {tr('Recherche', 'Search')}
          <input
            type="search"
            value={filters.search}
            onChange={(event) => set('search', event.target.value)}
            placeholder={tr('Nom de la mutation', 'Mutation name')}
            className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-muted/70"
          />
        </label>
        <FilterSelect
          label={tr('Rareté', 'Rarity')}
          value={filters.rarity}
          onChange={(value) => set('rarity', value)}
          options={[{ value: ALL, label: tr('Toutes', 'All') }, ...data.rarities.map((r) => ({ value: r, label: formatRarity(r) }))]}
        />
        <FilterSelect
          label={tr('Sol', 'Soil')}
          value={filters.surface}
          onChange={(value) => set('surface', value)}
          options={[{ value: ALL, label: tr('Tous', 'All') }, ...data.surfaces.map((s) => ({ value: s, label: s }))]}
        />
        <FilterSelect
          label={tr('Taille', 'Size')}
          value={filters.size}
          onChange={(value) => set('size', value)}
          options={[{ value: ALL, label: tr('Toutes', 'All') }, ...sizes.map((s) => ({ value: s, label: s }))]}
        />
        <FilterSelect
          label={tr('Besoin', 'Need')}
          value={filters.need}
          onChange={(value) => set('need', value)}
          options={[
            { value: ALL, label: tr('Toutes', 'All') },
            { value: 'missing', label: tr('À obtenir', 'To get') },
            { value: 'complete', label: tr('Complétées', 'Completed') },
            { value: 'unrequested', label: tr('Non demandées', 'Not requested') },
          ]}
        />
        <FilterSelect
          label={tr('Analyse', 'Analysis')}
          value={filters.analysis}
          onChange={(value) => set('analysis', value)}
          options={[
            { value: ALL, label: tr('Toutes', 'All') },
            { value: 'analyzed', label: tr('Analysées', 'Analyzed') },
            { value: 'notAnalyzed', label: tr('Non analysées', 'Not analyzed') },
          ]}
        />
        <button
          type="button"
          disabled={!hasActiveFilters(filters)}
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="h-9 rounded-lg border border-line px-3 text-sm text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {tr('Réinitialiser', 'Reset')}
        </button>
      </div>
      <p aria-live="polite" className="text-xs text-ink-muted">
        {shown === total ? `${total} mutations` : tr(`${shown} mutation${shown > 1 ? 's' : ''} sur ${total}`, `${shown} mutation${shown !== 1 ? 's' : ''} out of ${total}`)}
      </p>
    </div>
  )
}
