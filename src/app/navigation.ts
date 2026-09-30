import type { TabId } from './tabs'

/** Lien vers un onglet (l'onglet courant est stocké dans l'URL). */
export function tabHref(id: TabId): string {
  return `#/${id}`
}

/** Ouvre un onglet depuis du code (ex. après avoir préparé le calculateur). */
export function goToTab(id: TabId): void {
  window.location.hash = `/${id}`
}
