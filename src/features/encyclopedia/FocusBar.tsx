/**
 * Résumé écrit de la mutation mise en avant : recette, ce qu'elle permet de faire et longueur de
 * son chemin. Hauteur fixe : le survol ne fait jamais bouger l'arbre en dessous.
 */
import { cropName } from '../../components/game/recipeText'
import { WikiIcon } from '../../components/game/WikiIcon'
import { getGameData } from '../../data'
import { recipeInputs, recipesUsing } from '../../logic/graph'
import { rarityColor, TREE_COLORS } from '../../theme/palette'
import { amountText, type MutationState, type TreeFocus } from './graphModel'
import { STATE_INFO } from './stateInfo'

interface FocusBarProps {
  readonly focus: TreeFocus | null
  readonly state: MutationState | undefined
}

export function FocusBar({ focus, state }: FocusBarProps) {
  const data = getGameData()
  const mutation = focus ? data.mutationsById.get(focus.id) : undefined
  if (!focus || !mutation) {
    return (
      <div className="flex h-[4.75rem] items-center rounded-lg border border-line bg-panel px-3 text-sm text-ink-muted">
        <p>
          Survole une mutation pour voir tout son <span style={{ color: TREE_COLORS.path }}>chemin</span> (ses ingrédients,
          jusqu&apos;au départ) et <span style={{ color: TREE_COLORS.use }}>ce qu&apos;elle permet de faire</span>. Clic : sa
          fiche, et elle reste en avant (Échap pour l&apos;enlever).
        </p>
      </div>
    )
  }

  const recipe = recipeInputs(data, mutation).map((input) => `${cropName(data, input.crop)} ${amountText(input)}`)
  const uses = recipesUsing(data, mutation.id).map((use) => `${cropName(data, { kind: 'mutation', id: use.mutationId })} ${amountText(use)}`)
  const before = [...focus.path].filter((id) => !id.startsWith('base:')).length
  const info = state ? STATE_INFO[state] : null
  return (
    <div className="h-[4.75rem] overflow-hidden rounded-lg border border-line bg-panel px-3 py-1.5 text-xs leading-[1.35rem]">
      <p className="flex min-w-0 items-center gap-1.5 truncate">
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
          · {before === 0 ? 'aucune mutation avant elle' : `${before} mutation${before > 1 ? 's' : ''} sur son chemin`}
        </span>
      </p>
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
