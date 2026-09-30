/** Onglets de l'application, dans l'ordre d'affichage. */
export const TABS = [
  // Le tableau de bord regroupe les objectifs (un ancien lien #/objectifs y mène aussi).
  { id: 'tableau-de-bord', label: 'Tableau de bord' },
  { id: 'inventaire', label: 'Inventaire' },
  { id: 'encyclopedie', label: 'Encyclopédie' },
  { id: 'calculateur', label: 'Calculateur' },
  { id: 'grille', label: 'Grille' },
  { id: 'outils', label: 'Outils' },
] as const

export type TabId = (typeof TABS)[number]['id']

export const TAB_IDS: readonly TabId[] = TABS.map((tab) => tab.id)

export const DEFAULT_TAB: TabId = 'tableau-de-bord'
