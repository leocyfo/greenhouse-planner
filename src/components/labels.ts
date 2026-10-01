/** Libellés d'interface partagés (textes de l'app, pas des données de jeu). */
import { formatDecimal, getLocale, tr } from '../i18n/locale'

/** 'LEGENDARY' → 'Legendary', comme dans le jeu. */
export function formatRarity(rarity: string): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase()
}

/** Types d'objectif du JSON ; un type inconnu est affiché tel quel. */
export function formatGoalType(type: string): string {
  switch (type) {
    case 'pet':
      return 'Pet'
    case 'milestone':
      return tr('Palier', 'Milestone')
    case 'craft':
      return 'Craft'
    case 'shard':
      return 'Shard'
    default:
      return type
  }
}

/** Nombre avec séparateurs de milliers : 500000000 → « 500 000 000 » (« 500,000,000 » en anglais). */
export function formatNumber(value: number): string {
  return formatDecimal(value, 3)
}

/** Pourcentage entier, arrondi vers le bas pour ne jamais afficher 100 % trop tôt. */
export function formatPercent(done: number, total: number): string {
  const percent = total > 0 ? Math.floor((done / total) * 100) : 100
  return tr(`${percent} %`, `${percent}%`)
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** « 1 stage », « 3 stages ». Le pluriel commence à 2 en français, à 0 en anglais (« 0 stages »). */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  const many = getLocale() === 'en' ? count !== 1 : count > 1
  return `${count} ${many ? pluralForm : singular}`
}
