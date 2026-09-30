import { FilterSelect } from '../../components/FilterSelect'
import { formatRarity } from '../../components/labels'
import { getGameData } from '../../data'
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
          Recherche
          <input
            type="search"
            value={filters.search}
            onChange={(event) => set('search', event.target.value)}
            placeholder="Nom de la mutation"
            className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-muted/70"
          />
        </label>
        <FilterSelect
          label="Rareté"
          value={filters.rarity}
          onChange={(value) => set('rarity', value)}
          options={[{ value: ALL, label: 'Toutes' }, ...data.rarities.map((r) => ({ value: r, label: formatRarity(r) }))]}
        />
        <FilterSelect
          label="Sol"
          value={filters.surface}
          onChange={(value) => set('surface', value)}
          options={[{ value: ALL, label: 'Tous' }, ...data.surfaces.map((s) => ({ value: s, label: s }))]}
        />
        <FilterSelect
          label="Taille"
          value={filters.size}
          onChange={(value) => set('size', value)}
          options={[{ value: ALL, label: 'Toutes' }, ...sizes.map((s) => ({ value: s, label: s }))]}
        />
        <FilterSelect
          label="Besoin"
          value={filters.need}
          onChange={(value) => set('need', value)}
          options={[
            { value: ALL, label: 'Toutes' },
            { value: 'missing', label: 'À obtenir' },
            { value: 'complete', label: 'Complétées' },
            { value: 'unrequested', label: 'Non demandées' },
          ]}
        />
        <FilterSelect
          label="Analyse"
          value={filters.analysis}
          onChange={(value) => set('analysis', value)}
          options={[
            { value: ALL, label: 'Toutes' },
            { value: 'analyzed', label: 'Analysées' },
            { value: 'notAnalyzed', label: 'Non analysées' },
          ]}
        />
        <button
          type="button"
          disabled={!hasActiveFilters(filters)}
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="h-9 rounded-lg border border-line px-3 text-sm text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Réinitialiser
        </button>
      </div>
      <p aria-live="polite" className="text-xs text-ink-muted">
        {shown === total ? `${total} mutations` : `${shown} mutation${shown > 1 ? 's' : ''} sur ${total}`}
      </p>
    </div>
  )
}
