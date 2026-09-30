/**
 * Petit serveur (Cloudflare Worker) entre le site et les API de pseudos Minecraft et de Hypixel. Il
 * garde la clé Hypixel secrète, transforme un pseudo en UUID (PlayerDB, Mojang en secours) et ne
 * renvoie, pour chaque profil SkyBlock, que l'inventaire du joueur (sacs, inventaire, ender chest,
 * sacs à dos, coffre personnel).
 *
 *   GET /profiles?name=<pseudo>
 *   → { player: { uuid, name }, profiles: [{ id, name, selected, gameMode, inventory }] }
 */

export interface Env {
  /** Clé API Hypixel (secret : `npx wrangler secret put HYPIXEL_API_KEY`). */
  readonly HYPIXEL_API_KEY?: string
  /** Adresses du site autorisées, séparées par des virgules. Vide : toutes les origines. */
  readonly ALLOWED_ORIGINS?: string
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

/** Pseudo Minecraft : lettres, chiffres et _, 16 caractères au plus (même règle que le site). */
const PLAYER_NAME = /^[A-Za-z0-9_]{1,16}$/
const UUID = /^[0-9a-f]{32}$/
/** Durée de cache des réponses de Hypixel, en secondes : ses données ne bougent pas plus vite. */
const CACHE_SECONDS = 60
/** Présente le serveur aux API appelées (certaines refusent les appels anonymes). */
const USER_AGENT = 'greenhouse-planner (+https://github.com/leocyfo/greenhouse-planner)'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function json(body: unknown, status: number, headers: Readonly<Record<string, string>>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

/** En-têtes CORS pour l'origine qui appelle, ou null si elle n'est pas autorisée. */
export function corsHeaders(origin: string | null, env: Env): Record<string, string> | null {
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const base = { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
  if (allowed.length === 0) return { ...base, 'Access-Control-Allow-Origin': '*' }
  // Appel hors navigateur (curl…) : pas d'origine, pas d'en-tête CORS nécessaire.
  if (origin === null) return base
  return allowed.includes(origin) ? { ...base, 'Access-Control-Allow-Origin': origin } : null
}

type Player = { readonly uuid: string; readonly name: string }
type PlayerLookup = Player | 'not-found' | 'error'
/** Réponse d'un service de pseudos : le joueur, « introuvable » (définitif) ou null (indisponible). */
type SourceAnswer = Player | 'not-found' | null

interface NameSource {
  readonly url: (name: string) => string
  readonly read: (response: Response) => Promise<SourceAnswer>
}

const toPlayer = (uuid: unknown, name: unknown): Player | null =>
  typeof uuid === 'string' && UUID.test(uuid) && typeof name === 'string' ? { uuid, name } : null

/** Format de Mojang ({ id, name }), commun à ses deux adresses ; 404 (ou 204) : personne n'a ce pseudo. */
async function readMojang(response: Response): Promise<SourceAnswer> {
  if (response.status === 404 || response.status === 204) return 'not-found'
  if (!response.ok) return null
  const body: unknown = await response.json().catch(() => null)
  return isRecord(body) ? toPlayer(body.id, body.name) : null
}

/** Format de PlayerDB ({ code, data: { player: { raw_id, username } } }). */
async function readPlayerDb(response: Response): Promise<SourceAnswer> {
  const body: unknown = await response.json().catch(() => null)
  if (!isRecord(body)) return null
  if (body.code === 'minecraft.invalid_username') return 'not-found'
  const found = response.ok && body.code === 'player.found' && isRecord(body.data) ? body.data.player : null
  return isRecord(found) ? toPlayer(found.raw_id, found.username) : null
}

/**
 * Services qui transforment un pseudo en UUID, essayés dans l'ordre jusqu'à une réponse nette.
 * Mojang refuse les appels venus de Cloudflare (403) : PlayerDB, service public qui l'interroge
 * pour nous, passe en premier ; les deux adresses de Mojang restent en secours.
 */
const NAME_SOURCES: readonly NameSource[] = [
  { url: (name) => `https://playerdb.co/api/player/minecraft/${name}`, read: readPlayerDb },
  { url: (name) => `https://api.mojang.com/users/profiles/minecraft/${name}`, read: readMojang },
  { url: (name) => `https://api.minecraftservices.com/minecraft/profile/lookup/name/${name}`, read: readMojang },
]

async function lookupPlayer(name: string, fetcher: Fetcher): Promise<PlayerLookup> {
  for (const source of NAME_SOURCES) {
    const url = source.url(encodeURIComponent(name))
    const host = new URL(url).host
    try {
      const response = await fetcher(url, { headers: { 'User-Agent': USER_AGENT } })
      const answer = await source.read(response)
      if (answer !== null) return answer
      // Visible avec `npx wrangler tail` : quel service échoue, et comment.
      console.warn(`pseudo → UUID : ${host} a répondu ${response.status}, service suivant.`)
    } catch {
      console.warn(`pseudo → UUID : ${host} injoignable, service suivant.`)
    }
  }
  return 'error'
}

/** Ne garde de chaque profil que son nom, s'il est actif, son mode de jeu et l'inventaire du joueur. */
export function slimProfiles(body: unknown, uuid: string) {
  const profiles = isRecord(body) && Array.isArray(body.profiles) ? body.profiles : []
  return profiles.filter(isRecord).map((profile) => {
    const members = isRecord(profile.members) ? profile.members : {}
    const member = members[uuid]
    return {
      id: typeof profile.profile_id === 'string' ? profile.profile_id : '',
      name: typeof profile.cute_name === 'string' ? profile.cute_name : 'Profil',
      selected: profile.selected === true,
      gameMode: typeof profile.game_mode === 'string' ? profile.game_mode : null,
      inventory: isRecord(member) && isRecord(member.inventory) ? member.inventory : null,
    }
  })
}

export async function handleRequest(
  request: Request,
  env: Env,
  fetcher: Fetcher = (url, init) => fetch(url, init),
): Promise<Response> {
  const cors = corsHeaders(request.headers.get('Origin'), env)
  if (cors === null) return json({ error: 'Origine non autorisée.' }, 403, {})
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405, cors)

  const url = new URL(request.url)
  if (url.pathname !== '/profiles') return json({ error: 'Adresse inconnue : utilise /profiles?name=<pseudo>.' }, 404, cors)
  const name = url.searchParams.get('name') ?? ''
  if (!PLAYER_NAME.test(name)) {
    return json({ error: 'Pseudo invalide : lettres, chiffres et _, 16 caractères au plus.' }, 400, cors)
  }
  if (!env.HYPIXEL_API_KEY) return json({ error: 'Serveur mal configuré : la clé Hypixel manque.' }, 500, cors)

  const player = await lookupPlayer(name, fetcher)
  if (player === 'not-found') return json({ error: `Aucun joueur Minecraft ne s'appelle « ${name} ».` }, 404, cors)
  if (player === 'error') {
    return json({ error: 'Les services de pseudos Minecraft ne répondent pas, réessaie dans un moment.' }, 502, cors)
  }

  const init: RequestInit & { cf?: { cacheTtl: number; cacheEverything: boolean } } = {
    headers: { 'API-Key': env.HYPIXEL_API_KEY, 'User-Agent': USER_AGENT },
    // Cache de Cloudflare (clé : l'adresse, la clé API n'en fait pas partie) : moins d'appels à Hypixel.
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
  }
  const hypixel = await fetcher(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${player.uuid}`, init)
  if (hypixel.status === 429) return json({ error: 'Trop de demandes à Hypixel, réessaie dans une minute.' }, 429, cors)
  if (hypixel.status === 403) {
    return json({ error: 'Hypixel refuse la clé API du serveur (expirée ou invalide).' }, 502, cors)
  }
  if (!hypixel.ok) return json({ error: `Hypixel ne répond pas (erreur ${hypixel.status}).` }, 502, cors)
  const body: unknown = await hypixel.json().catch(() => null)
  return json({ player, profiles: slimProfiles(body, player.uuid) }, 200, {
    ...cors,
    'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
  })
}
