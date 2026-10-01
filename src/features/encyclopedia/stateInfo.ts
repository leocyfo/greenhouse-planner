/** Libellé, icône et couleur de chaque état : la couleur n'est jamais le seul indicateur. */
import { tr } from '../../i18n/locale'
import { STATE_COLORS } from '../../theme/palette'
import type { MutationState } from './graphModel'

export const STATE_INFO: Readonly<
  Record<MutationState, { readonly label: string; readonly icon: string; readonly color: string }>
> = {
  // Textes lus à chaque affichage (accesseurs) : ils suivent la langue de l'interface.
  complete: {
    get label() {
      return tr('Complétée', 'Completed')
    },
    icon: '✓',
    color: STATE_COLORS.complete,
  },
  available: {
    get label() {
      return tr('Disponible', 'Available')
    },
    icon: '▶',
    color: STATE_COLORS.available,
  },
  locked: {
    get label() {
      return tr('Verrouillée', 'Locked')
    },
    icon: '🔒',
    color: STATE_COLORS.locked,
  },
  special: {
    get label() {
      return tr('Spéciale', 'Special')
    },
    icon: '✦',
    color: STATE_COLORS.special,
  },
}
