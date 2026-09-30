/** Fenêtre d'import (état d'interface, non sauvegardé) : ouverte depuis l'en-tête ou le tableau de bord. */
import { create } from 'zustand'

interface ImportDialogState {
  readonly open: boolean
  /** Recherche à lancer dès l'ouverture (pseudo tapé ailleurs, ou « actualiser »). */
  readonly request: { readonly name: string; readonly id: number } | null
  readonly show: () => void
  readonly search: (name: string) => void
  readonly hide: () => void
}

let requestCount = 0

export const useImportDialog = create<ImportDialogState>()((set) => ({
  open: false,
  request: null,
  show: () => set({ open: true, request: null }),
  search: (name) => {
    requestCount += 1
    set({ open: true, request: { name, id: requestCount } })
  },
  hide: () => set({ open: false, request: null }),
}))
