/** Transitions pures de la progression (testables sans React ni localStorage). */
import type { ProgressState } from './state'

/** Plafond raisonnable pour un compteur d'inventaire. */
export const MAX_OWNED = 1_000_000

/** Entier entre 0 et MAX_OWNED ; toute valeur invalide devient 0. */
export function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_OWNED, Math.max(0, Math.floor(value)))
}

/** Liste triée sans doublon, avec ou sans chacun des `ids`. */
export function withMembers(list: readonly string[], ids: readonly string[], present: boolean): string[] {
  const set = new Set(list)
  for (const id of ids) {
    if (present) set.add(id)
    else set.delete(id)
  }
  return [...set].sort()
}

/** Liste triée sans doublon, avec ou sans `id`. */
export function withMember(list: readonly string[], id: string, present: boolean): string[] {
  return withMembers(list, [id], present)
}

export function withOwned(progress: ProgressState, id: string, count: number): ProgressState {
  const inventory: Record<string, number> = { ...progress.inventory }
  const next = normalizeCount(count)
  if (next > 0) inventory[id] = next
  else delete inventory[id] // les zéros ne sont pas stockés
  return { ...progress, inventory }
}

/**
 * Stock importé d'un profil Hypixel : chaque mutation trouvée prend le total trouvé. Les autres
 * passent à 0 (le profil fait foi), sauf si on garde le stock des mutations non trouvées.
 */
export function withImportedInventory(
  progress: ProgressState,
  counts: Readonly<Record<string, number>>,
  keepMissing: boolean,
): ProgressState {
  const inventory: Record<string, number> = keepMissing ? { ...progress.inventory } : {}
  for (const [id, count] of Object.entries(counts)) {
    const next = normalizeCount(count)
    if (next > 0) inventory[id] = next
    else delete inventory[id]
  }
  return { ...progress, inventory }
}

export function withAnalyzed(progress: ProgressState, id: string, analyzed: boolean): ProgressState {
  return { ...progress, analyzed: withMember(progress.analyzed, id, analyzed) }
}

/** Coche ou décoche l'analyse de plusieurs mutations d'un coup (« tout cocher » d'une rareté). */
export function withAnalyzedMany(progress: ProgressState, ids: readonly string[], analyzed: boolean): ProgressState {
  return { ...progress, analyzed: withMembers(progress.analyzed, ids, analyzed) }
}

export function withGoalActive(progress: ProgressState, id: string, active: boolean): ProgressState {
  return { ...progress, activeGoals: withMember(progress.activeGoals, id, active) }
}
