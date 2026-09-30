/**
 * Appel au petit serveur de l'import (dossier worker/) : profils SkyBlock d'un joueur, avec
 * l'inventaire de chacun. L'adresse du serveur vient de VITE_PROFILE_API_URL, fixée au build.
 */
import { z } from 'zod'

/** Adresse du serveur, sans « / » final ; vide quand aucun serveur n'est configuré. */
export const PROFILE_API_URL = (import.meta.env.VITE_PROFILE_API_URL ?? '').replace(/\/+$/, '')

/** Un serveur est configuré : l'import fonctionne. */
export const PROFILE_IMPORT_ENABLED = PROFILE_API_URL !== ''

/** L'import est proposé ; en développement, même sans serveur (la fenêtre explique quoi faire). */
export const PROFILE_IMPORT_VISIBLE = PROFILE_IMPORT_ENABLED || import.meta.env.DEV

const responseSchema = z.object({
  player: z.object({ uuid: z.string(), name: z.string() }),
  profiles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      selected: z.boolean(),
      gameMode: z.string().nullable(),
      // Vérifié plus finement à la lecture (logic/hypixel/inventory.ts).
      inventory: z.unknown(),
    }),
  ),
})

export type PlayerProfiles = z.infer<typeof responseSchema>
export type PlayerProfile = PlayerProfiles['profiles'][number]

/** Erreur à montrer telle quelle au joueur. */
export class ProfileApiError extends Error {}

function errorMessage(body: unknown): string | null {
  return typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : null
}

/** Profils SkyBlock d'un joueur ; lève ProfileApiError avec un message lisible en cas d'échec. */
export async function fetchPlayerProfiles(name: string, signal?: AbortSignal): Promise<PlayerProfiles> {
  if (!PROFILE_IMPORT_ENABLED) {
    throw new ProfileApiError("L'import n'est pas encore branché : aucun serveur n'est configuré.")
  }
  let response: Response
  try {
    response = await fetch(`${PROFILE_API_URL}/profiles?name=${encodeURIComponent(name)}`, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ProfileApiError('Serveur injoignable : vérifie ta connexion ou réessaie plus tard.')
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new ProfileApiError(errorMessage(body) ?? `Le serveur a répondu ${response.status}.`)
  const parsed = responseSchema.safeParse(body)
  if (!parsed.success) throw new ProfileApiError('Réponse du serveur inattendue.')
  return parsed.data
}
