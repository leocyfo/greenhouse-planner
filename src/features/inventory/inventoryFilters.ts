/** Filtres de l'inventaire (logique pure, testée). */
import type { MutationNeed, Plan } from '../../logic/recipes'
import type { Mutation } from '../../types/game'

export const ALL = 'all'

/** Statut d'une mutation par rapport aux objectifs cochés. */
export type NeedStatus = 'missing' | 'complete' | 'unrequested'

export interface InventoryFilters {
  readonly search: string
  readonly rarity: string
  readonly surface: string
  readonly size: string
  readonly need: typeof ALL | NeedStatus
  readonly analysis: typeof ALL | 'analyzed' | 'notAnalyzed'
}

export const DEFAULT_FILTERS: InventoryFilters = {
  search: '',
  rarity: ALL,
  surface: ALL,
  size: ALL,
  need: ALL,
  analysis: ALL,
}

export function needStatus(need: MutationNeed | undefined): NeedStatus {
  if (!need) return 'unrequested'
  return need.missing > 0 ? 'missing' : 'complete'
}

/** Minuscules, sans accents ni ponctuation : « Do-not-eat-shroom » → « do not eat shroom ». */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function hasActiveFilters(filters: InventoryFilters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof InventoryFilters)[]).some(
    (key) => filters[key] !== DEFAULT_FILTERS[key],
  )
}

export function filterMutations(
  mutations: readonly Mutation[],
  filters: InventoryFilters,
  plan: Plan,
  analyzed: ReadonlySet<string>,
): Mutation[] {
  const search = normalizeSearch(filters.search)
  return mutations.filter((mutation) => {
    if (search && !normalizeSearch(mutation.name).includes(search)) return false
    if (filters.rarity !== ALL && mutation.rarity !== filters.rarity) return false
    if (filters.surface !== ALL && mutation.surface !== filters.surface) return false
    if (filters.size !== ALL && mutation.size !== filters.size) return false
    if (filters.need !== ALL && needStatus(plan.needs.get(mutation.id)) !== filters.need) return false
    if (filters.analysis === 'analyzed' && !analyzed.has(mutation.id)) return false
    if (filters.analysis === 'notAnalyzed' && analyzed.has(mutation.id)) return false
    return true
  })
}
