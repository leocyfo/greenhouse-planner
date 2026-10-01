/**
 * Appel au petit serveur de l'import (dossier worker/) : profils SkyBlock d'un joueur, avec
 * l'inventaire de chacun. L'adresse du serveur vient de VITE_PROFILE_API_URL, fixée au build.
 */
import { z } from 'zod'
import { getLocale, tr } from '../../i18n/locale'

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
  /** Date de la lecture sur Hypixel (ms) : le serveur garde chaque profil lu 5 minutes. */
  fetchedAt: z.number().optional(),
  /** Dernières données connues, renvoyées parce que la limite de lectures est atteinte ou que Hypixel ne répond pas. */
  stale: z.boolean().optional(),
})

export type PlayerProfiles = z.infer<typeof responseSchema>
export type PlayerProfile = PlayerProfiles['profiles'][number]

/** Erreur à montrer telle quelle au joueur. */
export class ProfileApiError extends Error {}

function errorMessage(body: unknown): string | null {
  return typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? serverErrorText(body.error) : null
}

/**
 * Messages du serveur (worker/src/handler.ts, en français) et leur traduction anglaise : le
 * serveur ne connaît pas la langue de l'interface. Un message inconnu reste tel quel.
 */
const SERVER_MESSAGES: readonly (readonly [RegExp, string])[] = [
  [/^Origine non autorisée\.$/, 'Origin not allowed.'],
  [/^Méthode non autorisée\.$/, 'Method not allowed.'],
  [/^Adresse inconnue/, 'Unknown address: use /profiles?name=<name>.'],
  [/^Pseudo invalide/, 'Invalid name: letters, digits and _, 16 characters at most.'],
  [/^Serveur mal configuré/, 'Server misconfigured: the Hypixel key is missing.'],
  [/^Trop de recherches depuis ta connexion/, 'Too many searches from your connection: try again in a minute.'],
  [/^Aucun joueur Minecraft ne s'appelle « (.+) »\.$/, 'No Minecraft player is called “$1”.'],
  [/^Les services de pseudos Minecraft ne répondent pas/, 'The Minecraft name services are not answering, try again in a moment.'],
  [/^Hypixel est injoignable/, 'Hypixel cannot be reached, try again in a moment.'],
  [/^Trop de demandes à Hypixel : réessaie dans (\d+) s\.$/, 'Too many requests to Hypixel: try again in $1 s.'],
  [/^Hypixel refuse la clé API du serveur/, "Hypixel refuses the server's API key (expired or invalid)."],
  [/^Hypixel ne répond pas \(erreur (\d+)\)\.$/, 'Hypixel is not answering (error $1).'],
  [/^Réponse de Hypixel illisible/, 'Unreadable answer from Hypixel, try again in a moment.'],
  [/^Beaucoup de recherches en ce moment.*réessaie dans (\d+) s\.$/, "Lots of searches right now: to stay under Hypixel's limit, try again in $1 s."],
  [/^Le serveur ne peut pas vérifier sa limite Hypixel/, "The server can't check its Hypixel limit right now: try again in a minute."],
]

/** Message d'erreur du serveur dans la langue de l'interface. */
export function serverErrorText(message: string): string {
  if (getLocale() !== 'en') return message
  for (const [pattern, english] of SERVER_MESSAGES) if (pattern.test(message)) return message.replace(pattern, english)
  return message
}

/** Profils SkyBlock d'un joueur ; lève ProfileApiError avec un message lisible en cas d'échec. */
export async function fetchPlayerProfiles(name: string, signal?: AbortSignal): Promise<PlayerProfiles> {
  if (!PROFILE_IMPORT_ENABLED) {
    throw new ProfileApiError(tr("L'import n'est pas encore branché : aucun serveur n'est configuré.", 'The import is not connected yet: no server is configured.'))
  }
  let response: Response
  try {
    response = await fetch(`${PROFILE_API_URL}/profiles?name=${encodeURIComponent(name)}`, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ProfileApiError(tr('Serveur injoignable : vérifie ta connexion ou réessaie plus tard.', 'Server unreachable: check your connection or try again later.'))
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new ProfileApiError(errorMessage(body) ?? tr(`Le serveur a répondu ${response.status}.`, `The server answered ${response.status}.`))
  const parsed = responseSchema.safeParse(body)
  if (!parsed.success) throw new ProfileApiError(tr('Réponse du serveur inattendue.', 'Unexpected answer from the server.'))
  return parsed.data
}
