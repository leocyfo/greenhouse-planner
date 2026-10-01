/**
 * Au-dessus de l'arbre : la mutation choisie (ou survolée), sa recette et ce qu'elle permet de
 * faire ; pour la mutation choisie, le choix de la vue, sa fiche et le retour à tout l'arbre.
 * Hauteur minimale fixe : le survol ne fait jamais bouger l'arbre en dessous.
 */
import { useId } from 'react'
import { cropName } from '../../components/game/recipeText'
import { WikiIcon } from '../../components/game/WikiIcon'
import { SegmentedControl } from '../../components/SegmentedControl'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { recipeInputs, recipeLevels, recipesUsing } from '../../logic/graph'
import { rarityColor, TREE_COLORS } from '../../theme/palette'
import { amountText, chainOf, type MutationState, type TreeMode } from './graphModel'
import { STATE_INFO } from './stateInfo'

/** Les deux vues d'une mutation choisie. */
const modes = () =>
  [
    {
      value: 'neighbors',
      label: tr('Avant et après', 'Before and after'),
      description: tr("Ses ingrédients directs et les recettes qui l'utilisent.", 'Its direct ingredients and the recipes that use it.'),
    },
    {
      value: 'chain',
      label: tr('Tout le chemin', 'Whole path'),
      description: tr("Toutes les mutations à faire avant elle, jusqu'au départ.", 'Every mutation to make before it, back to the start.'),
    },
  ] as const

interface FocusBarProps {
  readonly selectedId: string | null
  readonly hoveredId: string | null
  readonly states: ReadonlyMap<string, MutationState>
  readonly mode: TreeMode
  readonly onModeChange: (mode: TreeMode) => void
  /** L'arbre affiche le total de chaque mutation pour en faire 1 (« Tout le chemin »). */
  readonly showsTotals: boolean
  readonly onOpenSheet: (mutationId: string) => void
  readonly onCalculate: (mutationId: string) => void
  /** Retour à tout l'arbre. */
  readonly onClear: () => void
}

export function FocusBar({
  selectedId,
  hoveredId,
  states,
  mode,
  onModeChange,
  showsTotals,
  onOpenSheet,
  onCalculate,
  onClear,
}: FocusBarProps) {
  const data = getGameData()
  const modeName = useId()
  const id = selectedId ?? hoveredId
  const mutation = id ? data.mutationsById.get(id) : undefined
  if (!id || !mutation) {
    return (
      <div className="flex min-h-[5.75rem] items-center rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-muted">
        <p>
          {tr(
            "Clique sur une mutation pour ne garder que ce qu'il faut pour la faire : « Avant et après » (ses ",
            'Click a mutation to keep only what it takes to make it: “Before and after” (its ',
          )}
          <span style={{ color: TREE_COLORS.path }}>{tr('ingrédients', 'ingredients')}</span>
          {tr(' et ', ' and ')}
          <span style={{ color: TREE_COLORS.use }}>{tr("ce qu'elle permet de faire", 'what it is used for')}</span>
          {tr(
            ") ou « Tout le chemin » (toutes les mutations à faire avant elle). Au survol, son chemin s'allume dans l'arbre.",
            ') or “Whole path” (every mutation to make before it). On hover, its path lights up in the tree.',
          )}
        </p>
      </div>
    )
  }

  const recipe = recipeInputs(data, mutation).map((input) => `${cropName(data, input.crop)} ${amountText(input)}`)
  const uses = recipesUsing(data, mutation.id).map((use) => `${cropName(data, { kind: 'mutation', id: use.mutationId })} ${amountText(use)}`)
  const before = chainOf(data, id).size
  const step = (recipeLevels(data).get(id) ?? 0) + 1
  const state = states.get(id)
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
          {selectedId && showsTotals && before > 0 && (
            <span className="text-ink-muted">
              · <span style={{ color: TREE_COLORS.path }}>×N</span>{' '}
              {tr('= total pour en faire 1, sans compter ton stock', '= total to make 1, not counting your stock')}
            </span>
          )}
        </p>
        {selectedId && (
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl legend={tr('Mutations gardées', 'Mutations kept')} name={modeName} options={modes()} value={mode} onChange={onModeChange} />
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
        )}
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
