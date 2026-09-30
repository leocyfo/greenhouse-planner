/**
 * Point d'accès unique aux données du jeu. Les composants passent par getGameData(),
 * les fonctions de logique reçoivent GameData en paramètre (pour rester testables).
 */
import type { GameData } from '../types/game'
import { loadGameData } from './load'
import raw from './mutations.json'

/** Résultat du chargement de mutations.json, calculé une seule fois au démarrage. */
export const gameDataLoad = loadGameData(raw)

/**
 * Données validées. App affiche l'écran d'erreur tant que le fichier est invalide :
 * le reste de l'application peut donc appeler cette fonction sans vérifier.
 */
export function getGameData(): GameData {
  if (!gameDataLoad.ok) {
    throw new Error("mutations.json est invalide : voir l'écran d'erreur des données.")
  }
  return gameDataLoad.data
}
