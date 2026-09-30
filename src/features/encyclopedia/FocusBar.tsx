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
import { recipeInputs, recipeLevels, recipesUsing } from '../../logic/graph'
import { rarityColor, TREE_COLORS } from '../../theme/palette'
import { amountText, chainOf, type MutationState, type TreeMode } from './graphModel'
import { STATE_INFO } from './stateInfo'

const MODES = [
  { value: 'neighbors', label: 'Avant et après', description: "Ses ingrédients directs et les recettes qui l'utilisent." },
  { value: 'chain', label: 'Tout le chemin', description: "Toutes les mutations à faire avant elle, jusqu'au départ." },
] as const

interface FocusBarProps {
  readonly selectedId: string | null
  readonly hoveredId: string | null
  readonly states: ReadonlyMap<string, MutationState>
  readonly mode: TreeMode
  readonly onModeChange: (mode: TreeMode) => void
  readonly onOpenSheet: (mutationId: string) => void
  /** Retour à tout l'arbre. */
  readonly onClear: () => void
}

export function FocusBar({ selectedId, hoveredId, states, mode, onModeChange, onOpenSheet, onClear }: FocusBarProps) {
  const data = getGameData()
  const modeName = useId()
  const id = selectedId ?? hoveredId
  const mutation = id ? data.mutationsById.get(id) : undefined
  if (!id || !mutation) {
    return (
      <div className="flex min-h-[5.75rem] items-center rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-muted">
        <p>
          Clique sur une mutation pour ne garder que ce qu&apos;il faut pour la faire : « Avant et après » (ses{' '}
          <span style={{ color: TREE_COLORS.path }}>ingrédients</span> et{' '}
          <span style={{ color: TREE_COLORS.use }}>ce qu&apos;elle permet de faire</span>) ou « Tout le chemin » (toutes les
          mutations à faire avant elle). Au survol, son chemin s&apos;allume dans l&apos;arbre.
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
            · Étape {step} · {before === 0 ? 'aucune mutation avant elle' : `${before} mutation${before > 1 ? 's' : ''} avant elle`}
          </span>
        </p>
        {selectedId && (
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl legend="Mutations gardées" name={modeName} options={MODES} value={mode} onChange={onModeChange} />
            <button
              type="button"
              onClick={() => onOpenSheet(selectedId)}
              className="h-8 rounded-lg bg-accent px-3 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong"
            >
              Fiche
            </button>
            <button
              type="button"
              onClick={onClear}
              title="Échap"
              className="h-8 rounded-lg border border-line px-3 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Tout l&apos;arbre
            </button>
          </div>
        )}
      </div>
      <p className="truncate" title={recipe.join(' · ') || mutation.specialCondition || undefined}>
        <span className="font-semibold" style={{ color: TREE_COLORS.path }}>
          Recette
        </span>{' '}
        : {recipe.length > 0 ? recipe.join(' · ') : (mutation.specialCondition ?? 'condition spéciale, voir la fiche')}
      </p>
      <p className="truncate">
        <span className="font-semibold" style={{ color: TREE_COLORS.use }}>
          Sert à
        </span>{' '}
        : {uses.length > 0 ? uses.join(' · ') : 'aucune recette, dernière étape'}
      </p>
    </div>
  )
}
