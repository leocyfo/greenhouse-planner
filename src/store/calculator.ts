/** Transitions pures de l'état du calculateur. */
import type { CalculatorState } from './state'

export const MAX_TARGET_QUANTITY = 999
export const MAX_SPOTS = 20
/** Plafond technique ; l'interface limite au nombre de cases des greenhouses. */
export const MAX_LONELILY_CELLS = 10_000

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

export function normalizeTargetQuantity(quantity: number): number {
  return clampInt(quantity, 1, MAX_TARGET_QUANTITY, 1)
}

export function normalizeSpots(spots: number): number {
  return clampInt(spots, 1, MAX_SPOTS, 1)
}

export function normalizeLonelilyCells(cells: number): number {
  return clampInt(cells, 0, MAX_LONELILY_CELLS, 0)
}

/** Ajoute une cible ; si elle y est déjà, sa quantité augmente. */
export function withAddedTarget(calculator: CalculatorState, mutationId: string, quantity: number): CalculatorState {
  const existing = calculator.targets.find((t) => t.mutationId === mutationId)
  if (existing) return withTargetQuantity(calculator, mutationId, existing.quantity + quantity)
  return {
    ...calculator,
    targets: [...calculator.targets, { mutationId, quantity: normalizeTargetQuantity(quantity) }],
  }
}

/** Change la quantité d'une cible ; en dessous de 1, la cible est retirée. */
export function withTargetQuantity(calculator: CalculatorState, mutationId: string, quantity: number): CalculatorState {
  if (!Number.isFinite(quantity) || quantity < 1) return withoutTarget(calculator, mutationId)
  return {
    ...calculator,
    targets: calculator.targets.map((t) =>
      t.mutationId === mutationId ? { mutationId, quantity: normalizeTargetQuantity(quantity) } : t,
    ),
  }
}

export function withoutTarget(calculator: CalculatorState, mutationId: string): CalculatorState {
  return { ...calculator, targets: calculator.targets.filter((t) => t.mutationId !== mutationId) }
}

export function withCalculatorGoal(calculator: CalculatorState, goalId: string, included: boolean): CalculatorState {
  const others = calculator.goalIds.filter((id) => id !== goalId)
  return { ...calculator, goalIds: included ? [...others, goalId] : others }
}

/** Calcul d'une seule mutation (bouton « calculer » de l'Encyclopédie ou du Tableau de bord). */
export function withSingleTarget(calculator: CalculatorState, mutationId: string, quantity = 1): CalculatorState {
  return { ...calculator, targets: [{ mutationId, quantity: normalizeTargetQuantity(quantity) }], goalIds: [] }
}

/** Calcul d'un seul objectif (bouton « calculer » d'une carte d'objectif). */
export function withSingleGoal(calculator: CalculatorState, goalId: string): CalculatorState {
  return { ...calculator, targets: [], goalIds: [goalId] }
}
