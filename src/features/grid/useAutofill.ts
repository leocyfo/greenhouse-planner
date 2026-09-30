import { useCallback, useEffect, useRef } from 'react'
import type { AutofillOutcome, AutofillRequest } from '../../logic/autofill'
import type { AutofillMessage, AutofillReply } from './autofill.worker'

/**
 * Lance le remplissage automatique dans un Web Worker (créé au premier calcul, arrêté quand le
 * composant disparaît) et renvoie son résultat.
 */
export function useAutofill(): (request: AutofillRequest) => Promise<AutofillOutcome> {
  const worker = useRef<Worker | null>(null)
  const pending = useRef(new Map<number, (outcome: AutofillOutcome) => void>())
  const lastId = useRef(0)

  useEffect(
    () => () => {
      worker.current?.terminate()
      worker.current = null
    },
    [],
  )

  return useCallback((request) => {
    if (!worker.current) {
      const created = new Worker(new URL('./autofill.worker.ts', import.meta.url), { type: 'module' })
      created.onmessage = (event: MessageEvent<AutofillReply>) => {
        pending.current.get(event.data.id)?.(event.data.outcome)
        pending.current.delete(event.data.id)
      }
      created.onerror = () => {
        for (const resolve of pending.current.values()) resolve({ ok: false, reason: 'Le calcul a échoué : réessaie.' })
        pending.current.clear()
        created.terminate()
        worker.current = null
      }
      worker.current = created
    }
    lastId.current += 1
    const id = lastId.current
    const message: AutofillMessage = { id, request }
    return new Promise<AutofillOutcome>((resolve) => {
      pending.current.set(id, resolve)
      worker.current?.postMessage(message)
    })
  }, [])
}
