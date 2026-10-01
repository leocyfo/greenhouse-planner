/**
 * Panneau à droite de l'arbre, pour la mutation ou l'objectif choisi : qui elle est, combien en
 * faire, et le calcul en liste compacte (l'ancien Calculateur). L'arbre à gauche montre déjà la
 * recette et ce qu'elle permet de faire : rien n'est répété ici.
 */
import { useId, useState, type ReactNode } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { WikiIcon } from '../../components/game/WikiIcon'
import { formatGoalType, formatNumber, formatRarity, plural } from '../../components/labels'
import { NumberStepper } from '../../components/NumberStepper'
import { getGameData } from '../../data'
import { wikiImage } from '../../data/wikiImages'
import { tr } from '../../i18n/locale'
import { recipeLevels } from '../../logic/graph'
import { rarityColor } from '../../theme/palette'
import { CalculationStats } from '../calculator/CalculationStats'
import { useCalculatorResult } from '../calculator/useCalculatorResult'
import { chainOf, type MutationState } from './graphModel'
import { STATE_INFO } from './stateInfo'

const PANEL = 'space-y-4 rounded-xl border border-line bg-panel p-4 xl:sticky xl:top-24'
const SECTION_TITLE = 'mb-1 text-[11px] font-bold tracking-wider text-ink-muted uppercase'

function Header({ icon, title, color, titleId, children }: { readonly icon: string; readonly title: string; readonly color?: string; readonly titleId: string; readonly children: ReactNode }) {
  return (
    <header className="flex items-center gap-3">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-canvas">
        <WikiIcon name={icon} size={40} />
      </span>
      <div className="min-w-0">
        <h3 id={titleId} className="truncate text-lg leading-tight font-bold" style={color ? { color } : undefined}>
          {title}
        </h3>
        <div className="mt-0.5 text-xs text-ink-muted">{children}</div>
      </div>
    </header>
  )
}

interface MutationPanelProps {
  readonly mutationId: string
  readonly state: MutationState
  /** Quantité de départ : ce que demandent les objectifs suivis, au moins 1. */
  readonly initialQuantity: number
  readonly onOpenSheet: () => void
}

/** Mutation choisie : son identité, la quantité voulue et son calcul. */
export function MutationPanel({ mutationId, state, initialQuantity, onOpenSheet }: MutationPanelProps) {
  const data = getGameData()
  const titleId = useId()
  const [quantity, setQuantity] = useState(initialQuantity)
  const result = useCalculatorResult({ kind: 'mutation', mutationId, quantity })
  const mutation = data.mutationsById.get(mutationId)
  if (!mutation) return null
  const color = rarityColor(mutation.rarity)
  const info = STATE_INFO[state]
  const step = (recipeLevels(data).get(mutationId) ?? 0) + 1
  const before = chainOf(data, mutationId).size

  return (
    <aside aria-labelledby={titleId} className={PANEL}>
      <Header icon={mutation.name} title={mutation.name} color={color} titleId={titleId}>
        <p>
          <span className="font-bold tracking-wide uppercase" style={{ color }}>
            {formatRarity(mutation.rarity)}
          </span>
          {' · '}
          <span aria-hidden="true">{info.icon}</span> {info.label} · {tr(`Étape ${step}`, `Step ${step}`)}
        </p>
        <p>
          {before === 0
            ? tr('Aucune mutation avant elle', 'No mutation before it')
            : tr(`${plural(before, 'mutation')} avant elle`, `${plural(before, 'mutation')} before it`)}
        </p>
      </Header>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-canvas/50 px-3 py-2">
        <span aria-hidden="true" className="text-sm font-medium">
          {tr('Quantité voulue', 'Wanted quantity')}
        </span>
        <NumberStepper
          value={quantity}
          onChange={setQuantity}
          name={mutation.name}
          inputLabel={tr(`Quantité de ${mutation.name} voulue`, `Wanted quantity of ${mutation.name}`)}
          min={1}
          max={999}
        />
      </div>

      <section>
        <h4 className={SECTION_TITLE}>{tr('Calcul', 'Calculation')}</h4>
        <CalculationStats result={result} />
      </section>

      <button
        type="button"
        onClick={onOpenSheet}
        className="w-full rounded-lg border border-line px-3 py-2 text-sm font-medium transition-colors hover:border-accent/60 hover:bg-panel-raised"
      >
        {tr('Voir la fiche', 'See the sheet')}
      </button>
    </aside>
  )
}

/** Objectif choisi : ce qu'il demande (mutations et autres coûts) et son calcul. */
export function GoalPanel({ goalId, targetIds }: { readonly goalId: string; readonly targetIds: readonly string[] }) {
  const data = getGameData()
  const titleId = useId()
  const result = useCalculatorResult({ kind: 'goal', goalId })
  const goal = data.goals.find((g) => g.id === goalId)
  if (!goal) return null
  const other = Object.entries(goal.other)

  return (
    <aside aria-labelledby={titleId} className={PANEL}>
      {/* Sans image du wiki pour l'objectif (Sun's Grasp), celle de sa première mutation. */}
      <Header
        icon={[goal.name, ...goal.mutations.map((r) => data.mutationsById.get(r.mutationId)?.name ?? '')].find((name) => wikiImage(name)) ?? goal.name}
        title={goal.name}
        titleId={titleId}
      >
        <p>{formatGoalType(goal.type)}</p>
      </Header>

      <section>
        <h4 className={SECTION_TITLE}>{tr('Demande', 'Needs')}</h4>
        {goal.eachMutation !== null ? (
          <p className="text-sm">
            {tr(
              `${goal.eachMutation} de chaque mutation pas encore analysée (${targetIds.length})`,
              `${goal.eachMutation} of each mutation not analyzed yet (${targetIds.length})`,
            )}
          </p>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {goal.mutations.map((requirement) => (
              <li key={requirement.mutationId} className="flex items-baseline justify-between gap-3">
                <CropLabel crop={{ kind: 'mutation', id: requirement.mutationId }} />
                <span className="tabular-nums text-ink-muted">{requirement.quantity === null ? '?' : `× ${requirement.quantity}`}</span>
              </li>
            ))}
          </ul>
        )}
        {(other.length > 0 || goal.milestones.length > 0) && (
          <p className="mt-1.5 text-xs text-ink-muted">
            {tr('Aussi : ', 'Also: ')}
            {[...other.map(([resource, amount]) => `${formatNumber(amount)} ${resource}`), ...goal.milestones].join(' · ')}
          </p>
        )}
      </section>

      <section>
        <h4 className={SECTION_TITLE}>{tr('Calcul', 'Calculation')}</h4>
        <CalculationStats result={result} />
      </section>
    </aside>
  )
}
