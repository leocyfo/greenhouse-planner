import { useId, useState, type ReactNode } from 'react'
import { NumberStepper } from '../../components/NumberStepper'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { BazaarList } from './BazaarList'
import type { CalculatorResult } from './calculatorResult'
import { ResultSummary } from './ResultSummary'
import { TimeEstimatePanel } from './TimeEstimatePanel'
import { useCalculatorResult } from './useCalculatorResult'

/**
 * Sous l'arbre de l'Encyclopédie : les chiffres clés et le temps estimé du calcul (l'ancien onglet
 * Calculateur). L'arbre au-dessus tient lieu d'arbre des besoins.
 */
function Calculation({ title, controls, result }: { readonly title: string; readonly controls?: ReactNode; readonly result: CalculatorResult }) {
  const titleId = useId()
  const data = getGameData()
  const { plan } = result
  const unknown = result.unknownQuantities.map((u) => data.mutationsById.get(u.mutationId)?.name ?? u.mutationId)

  return (
    <section aria-labelledby={titleId} className="animate-fade-up space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={titleId} className="text-base font-semibold">
          {title}
        </h3>
        {controls}
      </div>
      <ResultSummary result={result} />
      {unknown.length > 0 && (
        <p className="text-xs text-warning">
          {tr(`⚠ Quantité inconnue dans les données, comptée 1 : ${unknown.join(', ')}.`, `⚠ Unknown quantity in the data, counted as 1: ${unknown.join(', ')}.`)}
        </p>
      )}
      {plan.toBuy.length > 0 && (
        <Panel title={tr('Mutations à acheter au bazar', 'Mutations to buy at the bazaar')}>
          <BazaarList plan={plan} />
        </Panel>
      )}
      <Panel title={tr('Temps estimé', 'Estimated time')}>
        <TimeEstimatePanel result={result} details={false} />
      </Panel>
    </section>
  )
}

interface MutationCalculationProps {
  readonly mutationId: string
  /** Quantité de départ : ce que demandent les objectifs suivis, au moins 1. */
  readonly initialQuantity: number
}

/** Calcul de la mutation choisie, pour la quantité voulue. */
export function MutationCalculation({ mutationId, initialQuantity }: MutationCalculationProps) {
  const [quantity, setQuantity] = useState(initialQuantity)
  const result = useCalculatorResult({ kind: 'mutation', mutationId, quantity })
  const name = getGameData().mutationsById.get(mutationId)?.name ?? mutationId

  return (
    <Calculation
      title={tr(`Calcul : ${name}`, `Calculation: ${name}`)}
      result={result}
      controls={
        <div className="flex items-center gap-2 text-sm">
          <span aria-hidden="true" className="text-ink-muted">
            {tr('Quantité voulue', 'Wanted quantity')}
          </span>
          <NumberStepper
            value={quantity}
            onChange={setQuantity}
            name={name}
            inputLabel={tr(`Quantité de ${name} voulue`, `Wanted quantity of ${name}`)}
            min={1}
            max={999}
          />
        </div>
      }
    />
  )
}

/** Calcul d'un objectif entier (Rose Dragon, crafts…), comme l'ancien bouton « Calculer cet objectif ». */
export function GoalCalculation({ goalId }: { readonly goalId: string }) {
  const result = useCalculatorResult({ kind: 'goal', goalId })
  const name = getGameData().goals.find((goal) => goal.id === goalId)?.name ?? goalId
  return <Calculation title={tr(`Calcul : ${name}`, `Calculation: ${name}`)} result={result} />
}
