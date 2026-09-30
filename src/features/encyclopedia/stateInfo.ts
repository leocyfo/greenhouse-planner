/** Libellé, icône et couleur de chaque état : la couleur n'est jamais le seul indicateur. */
import { STATE_COLORS } from '../../theme/palette'
import type { MutationState } from './graphModel'

export const STATE_INFO: Readonly<
  Record<MutationState, { readonly label: string; readonly icon: string; readonly color: string; readonly description: string }>
> = {
  complete: {
    label: 'Complétée',
    icon: '✓',
    color: STATE_COLORS.complete,
    description: 'Au moins un exemplaire en stock, et tout ce que demandent tes objectifs suivis.',
  },
  available: {
    label: 'Disponible',
    icon: '▶',
    color: STATE_COLORS.available,
    description: 'Faisable maintenant : ses ingrédients sont en stock.',
  },
  locked: {
    label: 'Verrouillée',
    icon: '🔒',
    color: STATE_COLORS.locked,
    description: 'Il manque des ingrédients pour la lancer.',
  },
  special: {
    label: 'Spéciale',
    icon: '✦',
    color: STATE_COLORS.special,
    description: 'Condition spéciale, à gérer à la main (Godseed, Jerryflower).',
  },
}

export const STATE_ORDER: readonly MutationState[] = ['complete', 'available', 'locked', 'special']
