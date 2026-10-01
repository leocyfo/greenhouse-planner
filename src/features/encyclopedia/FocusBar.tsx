/**
 * Au-dessus de l'arbre, une fois une mutation choisie : sa recette, ce qu'elle permet de faire, sa
 * fiche et le retour à tout l'arbre (la bande à gauche de l'arbre passe d'une vue à l'autre). Rien sinon : le survol ne fait jamais
 * bouger l'arbre en dessous.
 */
import type { ReactNode } from 'react'
import { cropName } from '../../components/game/recipeText'
import { WikiIcon } from '../../components/game/WikiIcon'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { recipeInputs, recipeLevels, recipesUsing } from '../../logic/graph'
import { rarityColor, TREE_COLORS } from '../../theme/palette'
import { amountText, chainOf, type MutationState } from './graphModel'
import { STATE_INFO } from './stateInfo'

interface FocusBarProps {
  readonly selectedId: string | null
  /** Placé avant « Calculer » : le choix des colonnes (par rareté ou par étape). */
  readonly controls?: ReactNode
  readonly states: ReadonlyMap<string, MutationState>
  /** L'arbre affiche le total de chaque mutation pour en faire 1 (« Tout le chemin »). */
  readonly showsTotals: boolean
  readonly onOpenSheet: (mutationId: string) => void
  readonly onCalculate: (mutationId: string) => void
  /** Retour à tout l'arbre. */
  readonly onClear: () => void
}

export function FocusBar({
  selectedId,
  controls,
  states,
  showsTotals,
  onOpenSheet,
  onCalculate,
  onClear,
}: FocusBarProps) {
  const data = getGameData()
  const mutation = selectedId ? data.mutationsById.get(selectedId) : undefined
  // Rien tant qu'aucune mutation n'est choisie (le survol allume seulement son chemin dans l'arbre).
  if (!selectedId || !mutation) return null

  const recipe = recipeInputs(data, mutation).map((input) => `${cropName(data, input.crop)} ${amountText(input)}`)
  const uses = recipesUsing(data, mutation.id).map((use) => `${cropName(data, { kind: 'mutation', id: use.mutationId })} ${amountText(use)}`)
  const before = chainOf(data, selectedId).size
  const step = (recipeLevels(data).get(selectedId) ?? 0) + 1
  const state = states.get(selectedId)
  const info = state ? STATE_INFO[state] : null
  return (
    <div className="min-h-[5.75rem] rounded-lg border border-line bg-panel px-3 py-1.5 text-xs leading-[1.35rem]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5">
          <WikiIcon name={mutation.name} size={16} />
          <strong className="text-sm" style={{ color: rarityColor(mutation.rarity) }}>
            {mutation.name}
          </strong>
          {info && (
            <span className="text-ink-muted">
              · <span aria-hidden="true">{info.icon}</span> {info.label}
            </span>
          )}
          <span className="text-ink-muted">
            · {tr(`Étape ${step}`, `Step ${step}`)} ·{' '}
            {before === 0
              ? tr('aucune mutation avant elle', 'no mutation before it')
              : tr(`${before} mutation${before > 1 ? 's' : ''} avant elle`, `${before} mutation${before !== 1 ? 's' : ''} before it`)}
          </span>
          {showsTotals && before > 0 && (
            <span className="text-ink-muted">
              · <span style={{ color: TREE_COLORS.path }}>×N</span>{' '}
              {tr('= total pour en faire 1, sans compter ton stock', '= total to make 1, not counting your stock')}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <button
            type="button"
            onClick={() => onCalculate(selectedId)}
            className="h-8 rounded-lg bg-accent px-3 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong"
          >
            {tr('Calculer', 'Calculate')}
            <span className="sr-only"> {mutation.name}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenSheet(selectedId)}
            className="h-8 rounded-lg border border-line px-3 text-sm text-ink transition-colors hover:bg-panel-raised"
          >
            {tr('Fiche', 'Sheet')}
          </button>
          <button
            type="button"
            onClick={onClear}
            title={tr('Échap', 'Esc')}
            className="h-8 rounded-lg border border-line px-3 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            {tr("Tout l'arbre", 'Whole tree')}
          </button>
        </div>
      </div>
      <p className="truncate" title={recipe.join(' · ') || mutation.specialCondition || undefined}>
        <span className="font-semibold" style={{ color: TREE_COLORS.path }}>
          {tr('Recette', 'Recipe')}
        </span>
        {tr(' : ', ': ')}
        {recipe.length > 0 ? recipe.join(' · ') : (mutation.specialCondition ?? tr('condition spéciale, voir la fiche', 'special condition, see the sheet'))}
      </p>
      <p className="truncate">
        <span className="font-semibold" style={{ color: TREE_COLORS.use }}>
          {tr('Sert à', 'Used for')}
        </span>
        {tr(' : ', ': ')}
        {uses.length > 0 ? uses.join(' · ') : tr('aucune recette, dernière étape', 'no recipe, last step')}
      </p>
    </div>
  )
}
