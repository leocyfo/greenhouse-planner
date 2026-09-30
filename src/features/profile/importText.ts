/** Textes de l'import depuis Hypixel. */
import type { InventorySource } from '../../logic/hypixel/inventory'
import { PLAYER_NAME } from '../../store/persistence'

export const SOURCE_LABELS: Readonly<Record<InventorySource, string>> = {
  sacks: 'sacs',
  inventory: 'inventaire',
  enderChest: 'ender chest',
  backpacks: 'sacs à dos',
  vault: 'coffre personnel',
}

/** « sacs 10 · ender chest 2 », dans l'ordre des sources. */
export function sourcesText(sources: Readonly<Partial<Record<InventorySource, number>>>): string {
  return (Object.keys(SOURCE_LABELS) as InventorySource[])
    .flatMap((source) => {
      const count = sources[source]
      return count ? [`${SOURCE_LABELS[source]} ${count}`] : []
    })
    .join(' · ')
}

/** Liste lisible de sources : « sacs à dos et coffre personnel ». */
export function sourceList(sources: readonly InventorySource[]): string {
  const labels = sources.map((source) => SOURCE_LABELS[source])
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`
}

/** Âge d'une lecture sur Hypixel : « à l'instant », « il y a 3 min », « il y a 2 h ». */
export function readAgeText(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 1) return "à l'instant"
  return minutes < 60 ? `il y a ${minutes} min` : `il y a ${Math.floor(minutes / 60)} h`
}

/** Pseudo accepté pour une recherche (non vide, lettres, chiffres et _). */
export function isPlayerName(name: string): boolean {
  return name !== '' && PLAYER_NAME.test(name)
}
