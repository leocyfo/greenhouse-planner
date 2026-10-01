/**
 * Langue de l'interface : français (langue d'origine du site) ou anglais.
 *
 * Chaque texte affiché est écrit dans les deux langues, côte à côte, avec tr('français', 'English') :
 * pas de clés à tenir à jour, et une phrase se relit d'un coup d'œil dans les deux langues. La langue
 * courante est un réglage de l'application ; en la changeant, l'application est redessinée en entier
 * (voir App). Les données du jeu ont leur traduction à part (data/mutations.en.json).
 */

export type Locale = 'fr' | 'en'

export const LOCALES: readonly Locale[] = ['fr', 'en']

let current: Locale = 'fr'

export function getLocale(): Locale {
  return current
}

/** Change la langue courante (et celle déclarée par la page, pour les lecteurs d'écran). */
export function setLocale(locale: Locale): void {
  current = locale
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

/** Texte dans la langue courante. */
export function tr(fr: string, en: string): string {
  return current === 'en' ? en : fr
}

/** Langue du navigateur, au premier lancement : le français pour un navigateur en français, sinon l'anglais. */
export function browserLocale(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): Locale {
  const first = languages[0] ?? 'fr'
  return first.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

/** Nombre dans le format de la langue : « 500 000 000 » en français, « 500,000,000 » en anglais. */
export function formatDecimal(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString(current === 'en' ? 'en-US' : 'fr-FR', { maximumFractionDigits })
}
