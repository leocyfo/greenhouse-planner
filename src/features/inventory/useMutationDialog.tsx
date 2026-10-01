import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MutationDialog } from './MutationDialog'

interface MutationDialogApi {
  /** Ouvre la fiche ; à la fermeture, le focus revient sur le déclencheur de cette mutation. */
  readonly open: (mutationId: string) => void
  /** Ferme la fiche (le focus revient sur son déclencheur). */
  readonly close: () => void
  /** Ref à poser sur l'élément qui ouvre la fiche de `mutationId`. */
  readonly triggerRef: (mutationId: string) => (element: HTMLElement | null) => void
  /** La fenêtre, à placer dans le rendu (rien quand elle est fermée). */
  readonly dialog: ReactNode
}

/** Fiche d'une mutation ouverte depuis une case du sac ou une carte de la liste. */
export function useMutationDialog(): MutationDialogApi {
  const [openId, setOpenId] = useState<string | null>(null)
  const triggers = useRef(new Map<string, HTMLElement>())
  const lastOpened = useRef<string | null>(null)

  useEffect(() => {
    if (openId === null && lastOpened.current) triggers.current.get(lastOpened.current)?.focus()
  }, [openId])

  return {
    open: (mutationId) => {
      lastOpened.current = mutationId
      setOpenId(mutationId)
    },
    close: () => setOpenId(null),
    triggerRef: (mutationId) => (element) => {
      if (element) triggers.current.set(mutationId, element)
      else triggers.current.delete(mutationId)
    },
    dialog: openId ? <MutationDialog mutationId={openId} onClose={() => setOpenId(null)} onSelect={setOpenId} /> : null,
  }
}
