import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { useAppStore } from '../../store/appStore'
import { BaseCropList } from './BaseCropList'
import { BazaarList } from './BazaarList'
import { FarmOrderList } from './FarmOrderList'
import { PlanTreeView } from './PlanTreeView'
import { ResultSummary } from './ResultSummary'
import { SpecialList } from './SpecialList'
import { TargetsPanel } from './TargetsPanel'
import { TimeEstimatePanel } from './TimeEstimatePanel'
import { useCalculatorResult } from './useCalculatorResult'

/** Proposition de départ quand aucune cible n'est choisie : la route AVRG (Rose Dragon). */
function EmptyState() {
  const routeGoal = getGameData().goals.find((goal) => goal.avrgRoute)
  const setGoal = useAppStore((s) => s.setCalculatorGoal)
  const setOptions = useAppStore((s) => s.setCalculatorOptions)
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="text-sm text-ink-muted">Choisis une ou plusieurs mutations à obtenir, ou ajoute tout un objectif.</p>
      {routeGoal && (
        <button
          type="button"
          onClick={() => {
            setGoal(routeGoal.id, true)
            setOptions({ mode: 'optimum' })
          }}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong"
        >
          Calculer le {routeGoal.name} (route AVRG)
        </button>
      )}
    </div>
  )
}

/** Onglet Calculateur : cibles à gauche, résultat à droite. */
export function CalculatorTab() {
  const data = getGameData()
  const result = useCalculatorResult()
  const { plan } = result
  const hasTargets = plan.targets.length > 0
  const unknown = result.unknownQuantities.map((u) => {
    const goal = data.goals.find((g) => g.id === u.goalId)?.name ?? u.goalId
    return `${data.mutationsById.get(u.mutationId)?.name ?? u.mutationId} (${goal})`
  })

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Calculateur</h2>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <TargetsPanel />

        <div className="min-w-0 space-y-4">
          {!hasTargets ? (
            <EmptyState />
          ) : (
            <>
              <ResultSummary result={result} />
              {unknown.length > 0 && (
                <p className="text-xs text-warning">⚠ Quantité inconnue dans les données, comptée 1 : {unknown.join(', ')}.</p>
              )}
              <Panel title="Arbre des besoins">
                <PlanTreeView tree={result.tree} />
              </Panel>
              <Panel title="Liste de courses, dans l'ordre de farm">
                <FarmOrderList result={result} />
              </Panel>
              {plan.toBuy.length > 0 && (
                <Panel title="Mutations à acheter au bazar">
                  <BazaarList plan={plan} />
                </Panel>
              )}
              <Panel title="Crops de base à acheter">
                <BaseCropList plan={plan} />
              </Panel>
              {plan.special.length > 0 && (
                <Panel title="Conditions spéciales">
                  <SpecialList plan={plan} />
                </Panel>
              )}
              <Panel title="Temps estimé">
                <TimeEstimatePanel result={result} />
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
