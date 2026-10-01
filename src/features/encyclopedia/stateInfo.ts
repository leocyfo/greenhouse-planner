/** Libellé, icône et couleur de chaque état : la couleur n'est jamais le seul indicateur. */
import { tr } from '../../i18n/locale'
import { STATE_COLORS } from '../../theme/palette'
import type { MutationState } from './graphModel'

export const STATE_INFO: Readonly<
  Record<MutationState, { readonly label: string; readonly icon: string; readonly color: string; readonly description: string }>
> = {
  // Textes lus à chaque affichage (accesseurs) : ils suivent la langue de l'interface.
  complete: {
    get label() {
      return tr('Complétée', 'Completed')
    },
    icon: '✓',
    color: STATE_COLORS.complete,
    get description() {
      return tr(
        'Au moins un exemplaire en stock, et tout ce que demandent tes objectifs suivis.',
        'At least one copy in stock, and everything your followed goals need.',
      )
    },
  },
  available: {
    get label() {
      return tr('Disponible', 'Available')
    },
    icon: '▶',
    color: STATE_COLORS.available,
    get description() {
      return tr('Faisable maintenant : ses ingrédients sont en stock.', 'Doable now: its ingredients are in stock.')
    },
  },
  locked: {
    get label() {
      return tr('Verrouillée', 'Locked')
    },
    icon: '🔒',
    color: STATE_COLORS.locked,
    get description() {
      return tr('Il manque des ingrédients pour la lancer.', 'Ingredients are missing to start it.')
    },
  },
  special: {
    get label() {
      return tr('Spéciale', 'Special')
    },
    icon: '✦',
    color: STATE_COLORS.special,
    get description() {
      return tr('Condition spéciale, à gérer à la main (Godseed, Jerryflower).', 'Special condition, handled by hand (Godseed, Jerryflower).')
    },
  },
}

export const STATE_ORDER: readonly MutationState[] = ['complete', 'available', 'locked', 'special']
