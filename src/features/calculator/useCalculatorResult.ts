import { useMemo } from 'react'
import { getGameData } from '../../data'
import { growthWithUpgrades } from '../../logic/growth'
import { useAppStore } from '../../store/appStore'
import { computeCalculatorResult, type CalculatorResult } from './calculatorResult'

/** Ce que calcule l'Encyclopédie : la mutation choisie (et sa quantité), ou un objectif entier. */
export type CalculationFocus =
  | { readonly kind: 'mutation'; readonly mutationId: string; readonly quantity: number }
  | { readonly kind: 'goal'; readonly goalId: string }

/**
 * Résultat du calcul, avec les réglages enregistrés du calculateur (mode, emplacements…) ; recalculé
 * quand l'inventaire ou les réglages changent. Un objectif de la route AVRG (Rose Dragon) est
 * calculé en mode Optimum, avec les totaux du guide.
 */
export function useCalculatorResult(focus: CalculationFocus): CalculatorResult {
  const calculator = useAppStore((s) => s.calculator)
  const inventory = useAppStore((s) => s.progress.inventory)
  const analyzed = useAppStore((s) => s.progress.analyzed)
  const upgrades = useAppStore((s) => s.settings.growth.upgrades)
  const analyzedBuyable = useAppStore((s) => s.settings.analyzedBuyable)
  const kind = focus.kind
  const id = focus.kind === 'mutation' ? focus.mutationId : focus.goalId
  const quantity = focus.kind === 'mutation' ? focus.quantity : 1
  return useMemo(() => {
    const data = getGameData()
    const growth = growthWithUpgrades(upgrades, data.mechanics.growthStage.formula)
    const route = kind === 'goal' && data.goals.some((goal) => goal.id === id && goal.avrgRoute)
    const state =
      kind === 'mutation'
        ? { ...calculator, targets: [{ mutationId: id, quantity }], goalIds: [] }
        : { ...calculator, targets: [], goalIds: [id], mode: route ? ('optimum' as const) : calculator.mode }
    return computeCalculatorResult(data, state, inventory, new Set(analyzed), growth, analyzedBuyable)
  }, [calculator, inventory, analyzed, upgrades, analyzedBuyable, kind, id, quantity])
}
