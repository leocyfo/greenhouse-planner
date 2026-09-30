/** Utilitaires de test : données réelles du projet (mutations.json validé). */
import { loadGameData } from '../data/load'
import raw from '../data/mutations.json'
import type { GameData, Mutation } from '../types/game'

let cached: GameData | null = null

export function projectData(): GameData {
  if (cached) return cached
  const result = loadGameData(raw)
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.path} : ${issue.message}`).join('\n'))
  }
  cached = result.data
  return cached
}

export function mutationById(data: GameData, id: string): Mutation {
  const mutation = data.mutationsById.get(id)
  if (!mutation) throw new Error(`Mutation introuvable : ${id}`)
  return mutation
}
