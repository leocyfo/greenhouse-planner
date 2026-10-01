import { goToTab } from '../../app/navigation'
import { Badge } from '../../components/Badge'
import { CropLabel } from '../../components/game/CropLabel'
import { formatNumber } from '../../components/labels'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import type { GoalStatus } from '../../store/useGoalStatuses'

const SUBTITLE = 'mb-1 text-xs font-medium text-ink-muted'

/** Détail d'un objectif, déplié sous sa ligne : ce qu'il demande, coûts, paliers et notes. */
export function GoalDetails({ status }: { readonly status: GoalStatus }) {
  const data = getGameData()
  const inventory = useAppStore((s) => s.progress.inventory)
  const analyzed = useAppStore((s) => s.progress.analyzed)
  const calculateGoal = useAppStore((s) => s.calculateGoal)
  const { goal, completion } = status

  const remainingAnalyses = data.mutations.filter((m) => !analyzed.includes(m.id)).length
  const costs = Object.entries(goal.other)

  return (
    <div className="space-y-3 text-sm">
      {(goal.npc || goal.description) && (
        <p className="text-ink-muted">
          {goal.npc && tr(`PNJ : ${goal.npc}. `, `NPC: ${goal.npc}. `)}
          {goal.description}
        </p>
      )}

      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {(goal.mutations.length > 0 || goal.eachMutation !== null) && (
          <section>
            <h5 className={SUBTITLE}>{tr('Demande', 'Requires')}</h5>
            <ul className="space-y-1">
              {goal.mutations.map((requirement) => {
                const quantity = requirement.quantity ?? 1
                const owned = inventory[requirement.mutationId] ?? 0
                return (
                  <li key={requirement.mutationId} className="flex items-baseline justify-between gap-3">
                    <span>
                      <CropLabel crop={{ kind: 'mutation', id: requirement.mutationId }} />{' '}
                      <span className="text-ink-muted">× {requirement.quantity ?? tr('? (compté 1)', '? (counted as 1)')}</span>
                    </span>
                    <span className={`text-xs tabular-nums ${owned >= quantity ? 'text-accent-strong' : 'text-ink-muted'}`}>
                      {owned >= quantity ? tr('✓ en stock', '✓ in stock') : `${owned} / ${quantity}`}
                    </span>
                  </li>
                )
              })}
              {goal.eachMutation !== null && (
                <li className="text-ink-muted">
                  {tr(
                    `${goal.eachMutation} exemplaire de chaque mutation pas encore analysée (${remainingAnalyses} restante${remainingAnalyses > 1 ? 's' : ''})`,
                    `${goal.eachMutation} copy of each mutation not analyzed yet (${remainingAnalyses} left)`,
                  )}
                </li>
              )}
            </ul>
          </section>
        )}

        {costs.length > 0 && (
          <section>
            <h5 className={SUBTITLE}>{tr('Coûts', 'Costs')}</h5>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              {costs.map(([resource, amount]) => (
                <div key={resource} className="contents">
                  <dt>{resource}</dt>
                  <dd className="text-right font-medium tabular-nums">{formatNumber(amount)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {goal.milestones.length > 0 && (
          <section>
            <h5 className={SUBTITLE}>{tr('Paliers requis', 'Required milestones')}</h5>
            <ul className="flex flex-wrap gap-1.5">
              {goal.milestones.map((milestone) => (
                <li key={milestone}>
                  <Badge>{milestone}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {goal.notes && <p className="text-xs text-ink-muted">{goal.notes}</p>}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-xs text-ink-muted">
          {completion.measure === 'analyses'
            ? tr(`${completion.done} / ${completion.total} analysées`, `${completion.done} / ${completion.total} analyzed`)
            : tr(
                `${completion.done} / ${completion.total} exemplaire${completion.total > 1 ? 's' : ''} en stock, ingrédients compris`,
                `${completion.done} / ${completion.total} cop${completion.total !== 1 ? 'ies' : 'y'} in stock, ingredients included`,
              )}
        </span>
        <button
          type="button"
          onClick={() => {
            calculateGoal(goal.id, goal.avrgRoute ? 'optimum' : undefined)
            goToTab('calculateur')
          }}
          className="text-sm text-accent-strong underline-offset-2 hover:underline"
        >
          {tr('Calculer cet objectif', 'Calculate this goal')}
        </button>
      </div>
    </div>
  )
}
