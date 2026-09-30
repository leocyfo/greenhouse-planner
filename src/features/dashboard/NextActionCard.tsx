import { useMemo } from 'react'
import { goToTab, tabHref } from '../../app/navigation'
import { CropLabel } from '../../components/game/CropLabel'
import { SizeBadge, SoilBadge, StagesBadge } from '../../components/game/MutationBadges'
import { recipeLines } from '../../components/game/recipeText'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
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
      <Panel title="Prochaine action recommandée">
        <p className="text-sm text-ink-muted">
          Coche au moins un objectif ci-dessous pour obtenir une recommandation.{' '}
          <button type="button" onClick={onChooseGoals} className={LINK}>
            Choisir mes objectifs <span aria-hidden="true">↓</span>
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
      <Panel title="Prochaine action recommandée">
        <div className="space-y-2">
          {actions.manual.length > 0 && (
            <p className="text-sm text-ink-muted">
              Il ne reste à faire pousser que des mutations à condition spéciale, à gérer à la main :{' '}
              {actions.manual.map(name).join(', ')}. Leur condition est détaillée dans le Calculateur.
            </p>
          )}
          {toBuy && <p className="text-sm text-ink-muted">À acheter au bazar : {toBuy}.</p>}
          {actions.manual.length === 0 && !toBuy && (
            <p className="text-sm text-accent-strong">✓ Tout ce que demandent tes objectifs est déjà en stock.</p>
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
    <Panel title="Prochaine action recommandée" className="border-accent/40">
      {/* Nouvelle recommandation (objectif coché, stock modifié) : elle arrive en fondu. */}
      <div key={id} className="animate-fade-up">
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
          <span className="text-lg">
            <CropLabel crop={{ kind: 'mutation', id }} />
          </span>
          <span className="text-right text-sm">
            <strong className="text-lg tabular-nums">{need.missing}</strong> à obtenir
          </span>
          <div className="flex flex-wrap gap-1.5">
            <SoilBadge surface={mutation.surface} />
            <SizeBadge size={mutation.size} />
            <StagesBadge stages={mutation.growthStages} />
          </div>
          <span className="text-right text-xs text-ink-muted">
            besoin {need.required} · en stock {need.owned}
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
          Pourquoi elle : ses ingrédients sont en stock, et c&apos;est la mutation la plus basse de l&apos;arbre qui
          manque{forGoals.length > 0 ? ` pour ${forGoals.join(', ')}` : ''}.
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
            Voir dans le calculateur
          </button>
          <a href={tabHref('inventaire')} className={LINK}>
            Mettre à jour mon inventaire
          </a>
        </div>

        {actions.alsoReady.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-1.5 text-xs text-ink-muted">Aussi faisables maintenant (en parallèle) :</p>
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
            À gérer à part (condition spéciale) : {actions.manual.map(name).join(', ')}.
          </p>
        )}
        {toBuy && <p className="mt-3 text-xs text-ink-muted">À acheter au bazar : {toBuy}.</p>}
      </div>
    </Panel>
  )
}
