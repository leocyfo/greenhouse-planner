/** Textes de l'import depuis Hypixel. */
import type { InventorySource } from '../../logic/hypixel/inventory'
import { tr } from '../../i18n/locale'
import { PLAYER_NAME } from '../../store/persistence'

/** Ordre d'affichage des sources lues. */
const SOURCES: readonly InventorySource[] = ['sacks', 'inventory', 'enderChest', 'backpacks', 'vault']

/** Nom d'une source dans la langue de l'interface. */
export function sourceLabel(source: InventorySource): string {
  switch (source) {
    case 'sacks':
      return tr('sacs', 'sacks')
    case 'inventory':
      return tr('inventaire', 'inventory')
    case 'enderChest':
      return 'ender chest'
    case 'backpacks':
      return tr('sacs à dos', 'backpacks')
    case 'vault':
      return tr('coffre personnel', 'personal vault')
  }
}

/** « sacs 10 · ender chest 2 », dans l'ordre des sources. */
export function sourcesText(sources: Readonly<Partial<Record<InventorySource, number>>>): string {
  return SOURCES.flatMap((source) => {
    const count = sources[source]
    return count ? [`${sourceLabel(source)} ${count}`] : []
  })
    .join(' · ')
}

/** Liste lisible de sources : « sacs à dos et coffre personnel ». */
export function sourceList(sources: readonly InventorySource[]): string {
  const labels = sources.map(sourceLabel)
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} ${tr('et', 'and')} ${labels[labels.length - 1]}`
}

/** Âge d'une lecture sur Hypixel : « à l'instant », « il y a 3 min », « il y a 2 h ». */
export function readAgeText(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 1) return tr("à l'instant", 'just now')
  return minutes < 60 ? tr(`il y a ${minutes} min`, `${minutes} min ago`) : tr(`il y a ${Math.floor(minutes / 60)} h`, `${Math.floor(minutes / 60)} h ago`)
}

/** Pseudo accepté pour une recherche (non vide, lettres, chiffres et _). */
export function isPlayerName(name: string): boolean {
  return name !== '' && PLAYER_NAME.test(name)
}
