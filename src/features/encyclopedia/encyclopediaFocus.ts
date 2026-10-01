/**
 * Ouvrir l'Encyclopédie sur une mutation ou un objectif, avec son calcul sous l'arbre (boutons du
 * tableau de bord et des fiches, qui menaient au Calculateur avant sa fusion avec l'Encyclopédie).
 */
import { create } from 'zustand'
import { goToTab } from '../../app/navigation'

export type FocusRequest = { readonly mutationId: string } | { readonly goalId: string }

/** Demande en attente, lue (puis effacée) par l'Encyclopédie. */
export const useEncyclopediaFocus = create<{ readonly request: FocusRequest | null }>(() => ({ request: null }))

function request(focus: FocusRequest): void {
  useEncyclopediaFocus.setState({ request: focus })
  goToTab('encyclopedie')
}

export function showInEncyclopedia(mutationId: string): void {
  request({ mutationId })
}

export function showGoalInEncyclopedia(goalId: string): void {
  request({ goalId })
}

export function clearEncyclopediaFocus(): void {
  useEncyclopediaFocus.setState({ request: null })
}
