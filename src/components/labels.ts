/** Libellés d'interface partagés (textes de l'app, pas des données de jeu). */

/** 'LEGENDARY' → 'Legendary', comme dans le jeu. */
export function formatRarity(rarity: string): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase()
}

/** Types d'objectif du JSON ; un type inconnu est affiché tel quel. */
const GOAL_TYPE_LABELS: Readonly<Record<string, string>> = {
  pet: 'Pet',
  milestone: 'Palier',
  craft: 'Craft',
  shard: 'Shard',
}

export function formatGoalType(type: string): string {
  return GOAL_TYPE_LABELS[type] ?? type
}

/** Nombre avec séparateurs de milliers : 500000000 → « 500 000 000 ». */
export function formatNumber(value: number): string {
  return value.toLocaleString('fr-FR')
}

/** Pourcentage entier, arrondi vers le bas pour ne jamais afficher 100 % trop tôt. */
export function formatPercent(done: number, total: number): string {
  return `${total > 0 ? Math.floor((done / total) * 100) : 100} %`
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** « 1 stage », « 3 stages ». */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}
