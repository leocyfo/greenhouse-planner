/** Store de l'application, sauvegardé dans le localStorage du navigateur. */
import { gameDataLoad } from '../data'
import { createAppStore } from './createAppStore'
import { defaultPersistedState } from './state'

// Pas de getGameData() ici : ce module est chargé même quand mutations.json est invalide.
const data = gameDataLoad.ok ? gameDataLoad.data : null

export const DEFAULT_STATE = defaultPersistedState(data)

export const useAppStore = createAppStore(DEFAULT_STATE, undefined, { data })
