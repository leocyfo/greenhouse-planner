import { useMemo } from 'react'
import { goToTab, tabHref } from '../../app/navigation'
import { CropLabel } from '../../components/game/CropLabel'
import { SizeBadge, SoilBadge, StagesBadge } from '../../components/game/MutationBadges'
import { recipeLines } from '../../components/game/recipeText'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { nextActions } from '../../logic/nextAction'
import { useAppStore } from '../../store/appStore'
import type { GoalStatus } from '../../store/useGoalStatuses'
import { useGoalPlan } from '../../store/useGoalPlan'

const LINK = 'text-sm text-accent-strong underline-offset-2 hover:underline'

interface NextActionCardProps {
  readonly statuses: readonly GoalStatus[]
  /** Amène aux objectifs, plus bas sur la page, quand aucun n'est coché. */
  readonly onChooseGoals: () => void
}

/** La mutation à faire pousser maintenant, et les autres déjà faisables. */
export function NextActionCard({ statuses, onChooseGoals }: NextActionCardProps) {
  const data = getGameData()
  const inventory = useAppStore((s) => s.progress.inventory)
  const calculateOnly = useAppStore((s) => s.calculateOnly)
  const { plan } = useGoalPlan()
  const actions = useMemo(() => nextActions(data, plan, inventory), [data, plan, inventory])
  const hasGoals = statuses.some((status) => status.active)
  const name = (id: string) => data.mutationsById.get(id)?.name ?? id

  if (!hasGoals) {
    return (
      <Panel title={tr('Prochaine action recommandée', 'Recommended next action')}>
        <p className="text-sm text-ink-muted">
          {tr('Coche au moins un objectif ci-dessous pour obtenir une recommandation.', 'Tick at least one goal below to get a recommendation.')}{' '}
          <button type="button" onClick={onChooseGoals} className={LINK}>
            {tr('Choisir mes objectifs', 'Choose my goals')} <span aria-hidden="true">↓</span>
          </button>
        </p>
      </Panel>
    )
  }

  const id = actions.recommended
  const mutation = id ? data.mutationsById.get(id) : undefined
  const need = id ? plan.needs.get(id) : undefined
  // Option du bazar : ces mutations s'achètent, elles ne sont donc jamais recommandées à la culture.
  const toBuy = plan.toBuy.map((item) => `${name(item.mutationId)} × ${item.quantity}`).join(', ')

  if (!id || !mutation || !need) {
    return (
      <Panel title={tr('Prochaine action recommandée', 'Recommended next action')}>
        <div className="space-y-2">
          {actions.manual.length > 0 && (
            <p className="text-sm text-ink-muted">
              {tr(
                `Il ne reste à faire pousser que des mutations à condition spéciale, à gérer à la main : ${actions.manual.map(name).join(', ')}. Leur condition est détaillée dans le Calculateur.`,
                `Only mutations with a special condition are left to grow, to handle by hand: ${actions.manual.map(name).join(', ')}. Their condition is detailed in the Calculator.`,
              )}
            </p>
          )}
          {toBuy && <p className="text-sm text-ink-muted">{tr(`À acheter au bazar : ${toBuy}.`, `To buy at the bazaar: ${toBuy}.`)}</p>}
          {actions.manual.length === 0 && !toBuy && (
            <p className="text-sm text-accent-strong">
              {tr('✓ Tout ce que demandent tes objectifs est déjà en stock.', '✓ Everything your goals need is already in stock.')}
            </p>
          )}
        </div>
      </Panel>
    )
  }

  // Objectifs actifs qui utilisent cette mutation. On ne filtre pas sur « manque pour cet
  // objectif seul » : le manque peut ne venir que de leur combinaison (ex. 36 Ashwreath pour la
  // route + 1 à analyser).
  const forGoals = statuses
    .filter((status) => status.active && status.plan.needs.has(id))
    .map((status) => status.goal.name)

  return (
    <Panel title={tr('Prochaine action recommandée', 'Recommended next action')} className="border-accent/40">
      {/* Nouvelle recommandation (objectif coché, stock modifié) : elle arrive en fondu. */}
      <div key={id} className="animate-fade-up">
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
          <span className="text-lg">
            <CropLabel crop={{ kind: 'mutation', id }} />
          </span>
          <span className="text-right text-sm">
            <strong className="text-lg tabular-nums">{need.missing}</strong> {tr('à obtenir', 'to get')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <SoilBadge surface={mutation.surface} />
            <SizeBadge size={mutation.size} />
            <StagesBadge stages={mutation.growthStages} />
          </div>
          <span className="text-right text-xs text-ink-muted">
            {tr(`besoin ${need.required} · en stock ${need.owned}`, `need ${need.required} · in stock ${need.owned}`)}
          </span>
        </div>
        <div className="mt-2 space-y-0.5">
          {recipeLines(data, mutation).map((line) => (
            <p key={line} className="text-sm text-ink-muted">
              {line}
            </p>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          {tr(
            `Pourquoi elle : ses ingrédients sont en stock, et c'est la mutation la plus basse de l'arbre qui manque${forGoals.length > 0 ? ` pour ${forGoals.join(', ')}` : ''}.`,
            `Why this one: its ingredients are in stock, and it is the lowest mutation in the tree that is missing${forGoals.length > 0 ? ` for ${forGoals.join(', ')}` : ''}.`,
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => {
              calculateOnly(id, need.required)
              goToTab('calculateur')
            }}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-canvas transition hover:bg-accent-strong motion-safe:active:scale-[0.97]"
          >
            {tr('Voir dans le calculateur', 'Open in the calculator')}
          </button>
          <a href={tabHref('inventaire')} className={LINK}>
            {tr('Mettre à jour mon inventaire', 'Update my inventory')}
          </a>
        </div>

        {actions.alsoReady.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-1.5 text-xs text-ink-muted">{tr('Aussi faisables maintenant (en parallèle) :', 'Also doable now (in parallel):')}</p>
            <ul className="flex flex-wrap gap-1.5">
              {actions.alsoReady.map((readyId) => (
                <li key={readyId} className="rounded-lg border border-line bg-canvas/40 px-2 py-0.5 text-sm">
                  <CropLabel crop={{ kind: 'mutation', id: readyId }} />{' '}
                  <span className="text-xs text-ink-muted">× {plan.needs.get(readyId)?.missing ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {actions.manual.length > 0 && (
          <p className="mt-3 text-xs text-ink-muted">
            {tr(
              `À gérer à part (condition spéciale) : ${actions.manual.map(name).join(', ')}.`,
              `To handle separately (special condition): ${actions.manual.map(name).join(', ')}.`,
            )}
          </p>
        )}
        {toBuy && <p className="mt-3 text-xs text-ink-muted">{tr(`À acheter au bazar : ${toBuy}.`, `To buy at the bazaar: ${toBuy}.`)}</p>}
      </div>
    </Panel>
  )
}
