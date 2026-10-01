/**
 * Point d'accès unique aux données du jeu. Les composants passent par getGameData(),
 * les fonctions de logique reçoivent GameData en paramètre (pour rester testables).
 * Les textes suivent la langue de l'interface (traduction anglaise : mutations.en.json).
 */
import { getLocale } from '../i18n/locale'
import type { GameData, GameDataLoadResult } from '../types/game'
import { loadGameData } from './load'
import { localizeRaw } from './localize'
import english from './mutations.en.json'
import raw from './mutations.json'

/** Résultat du chargement de mutations.json, calculé une seule fois au démarrage. */
export const gameDataLoad = loadGameData(raw)

let englishLoad: GameDataLoadResult | null = null

/** Données avec les textes en anglais, préparées au premier besoin. */
function englishGameData(): GameDataLoadResult {
  englishLoad ??= loadGameData(localizeRaw(raw, english))
  return englishLoad
}

/**
 * Données validées, dans la langue de l'interface. App affiche l'écran d'erreur tant que le
 * fichier est invalide : le reste de l'application peut donc appeler cette fonction sans vérifier.
 */
export function getGameData(): GameData {
  const load = getLocale() === 'en' && gameDataLoad.ok ? englishGameData() : gameDataLoad
  if (!load.ok) {
    throw new Error("mutations.json est invalide : voir l'écran d'erreur des données.")
  }
  return load.data
}
