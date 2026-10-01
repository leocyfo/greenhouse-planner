import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
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
      <p className="text-sm text-ink-muted">
        {tr('Choisis une ou plusieurs mutations à obtenir, ou ajoute tout un objectif.', 'Choose one or more mutations to get, or add a whole goal.')}
      </p>
      {routeGoal && (
        <button
          type="button"
          onClick={() => {
            setGoal(routeGoal.id, true)
            setOptions({ mode: 'optimum' })
          }}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong"
        >
          {tr(`Calculer le ${routeGoal.name} (route AVRG)`, `Calculate the ${routeGoal.name} (AVRG route)`)}
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
      <h2 className="sr-only">{tr('Calculateur', 'Calculator')}</h2>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <TargetsPanel />

        <div className="min-w-0 space-y-4">
          {!hasTargets ? (
            <EmptyState />
          ) : (
            <>
              <ResultSummary result={result} />
              {unknown.length > 0 && (
                <p className="text-xs text-warning">
                  {tr(`⚠ Quantité inconnue dans les données, comptée 1 : ${unknown.join(', ')}.`, `⚠ Unknown quantity in the data, counted as 1: ${unknown.join(', ')}.`)}
                </p>
              )}
              <Panel title={tr('Arbre des besoins', 'Needs tree')}>
                <PlanTreeView tree={result.tree} />
              </Panel>
              <Panel title={tr("Liste de courses, dans l'ordre de farm", 'Shopping list, in farming order')}>
                <FarmOrderList result={result} />
              </Panel>
              {plan.toBuy.length > 0 && (
                <Panel title={tr('Mutations à acheter au bazar', 'Mutations to buy at the bazaar')}>
                  <BazaarList plan={plan} />
                </Panel>
              )}
              <Panel title={tr('Crops de base à acheter', 'Base crops to buy')}>
                <BaseCropList plan={plan} />
              </Panel>
              {plan.special.length > 0 && (
                <Panel title={tr('Conditions spéciales', 'Special conditions')}>
                  <SpecialList plan={plan} />
                </Panel>
              )}
              <Panel title={tr('Temps estimé', 'Estimated time')}>
                <TimeEstimatePanel result={result} />
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
