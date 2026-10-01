/**
 * Web Worker du remplissage automatique : la recherche (une demi-seconde environ) tourne hors du fil
 * de l'interface, qui reste fluide pendant le calcul.
 */
import { getGameData } from '../../data'
import { setLocale, type Locale } from '../../i18n/locale'
import { autofill, type AutofillOutcome, type AutofillRequest } from '../../logic/autofill'

export interface AutofillMessage {
  readonly id: number
  readonly request: AutofillRequest
  /** Langue de l'interface, pour les raisons d'un refus. */
  readonly locale: Locale
}

export interface AutofillReply {
  readonly id: number
  readonly outcome: AutofillOutcome
}

/** Ce que le worker utilise de son contexte (le type complet vient de la bibliothèque « webworker »). */
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<AutofillMessage>) => void) | null
  postMessage: (reply: AutofillReply) => void
}

scope.onmessage = (event) => {
  const { id, request, locale } = event.data
  setLocale(locale)
  scope.postMessage({ id, outcome: autofill(getGameData(), request) })
}
