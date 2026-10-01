import { tr } from '../i18n/locale'

/** Onglets de l'application, dans l'ordre d'affichage (noms : tabLabel). */
export const TABS = [
  // Le tableau de bord regroupe les objectifs (un ancien lien #/objectifs y mène aussi).
  { id: 'tableau-de-bord' },
  { id: 'inventaire' },
  { id: 'encyclopedie' },
  { id: 'calculateur' },
  { id: 'grille' },
  { id: 'outils' },
] as const

export type TabId = (typeof TABS)[number]['id']

export const TAB_IDS: readonly TabId[] = TABS.map((tab) => tab.id)

export const DEFAULT_TAB: TabId = 'tableau-de-bord'

/** Nom d'un onglet dans la langue de l'interface (les identifiants restent en français : liens #/…). */
export function tabLabel(id: TabId): string {
  switch (id) {
    case 'tableau-de-bord':
      return tr('Tableau de bord', 'Dashboard')
    case 'inventaire':
      return tr('Inventaire', 'Inventory')
    case 'encyclopedie':
      return tr('Encyclopédie', 'Encyclopedia')
    case 'calculateur':
      return tr('Calculateur', 'Calculator')
    case 'grille':
      return tr('Grille', 'Grid')
    case 'outils':
      return tr('Outils', 'Tools')
  }
}

/** Onglets qui utilisent toute la largeur de la page, comme un profil SkyCrypt (les autres : 1 280 px au plus). */
export const FULL_WIDTH_TABS: ReadonlySet<TabId> = new Set(['encyclopedie', 'grille'])
