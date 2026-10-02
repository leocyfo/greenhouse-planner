/** Ouvrir le Guide sur un chapitre (bandeau de la Grille quand une ferme du guide est affichée). */
import { create } from 'zustand'
import { goToTab } from '../../app/navigation'

export const useGuideFocus = create<{ readonly chapterId: string | null }>(() => ({ chapterId: null }))

export function showInGuide(chapterId: string): void {
  useGuideFocus.setState({ chapterId })
  goToTab('guide')
}

export function clearGuideFocus(): void {
  useGuideFocus.setState({ chapterId: null })
}
