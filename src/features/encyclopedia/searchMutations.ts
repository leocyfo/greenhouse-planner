import type { Mutation } from '../../types/game'
import { normalizeSearch } from '../inventory/inventoryFilters'

/**
 * Mutations dont le nom contient la recherche (sans tenir compte des majuscules, des accents ni de
 * la ponctuation) : celles qui commencent par elle d'abord, puis par rareté et par nom.
 */
export function searchMutations(mutations: readonly Mutation[], query: string): Mutation[] {
  const search = normalizeSearch(query)
  if (!search) return []
  const startsWith = (m: Mutation) => (normalizeSearch(m.name).startsWith(search) ? 0 : 1)
  return mutations
    .filter((m) => normalizeSearch(m.name).includes(search))
    .sort((a, b) => startsWith(a) - startsWith(b) || a.rarityRank - b.rarityRank || a.name.localeCompare(b.name, 'fr'))
}
