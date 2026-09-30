/**
 * Petit serveur (Cloudflare Worker) entre le site et les API de pseudos Minecraft et de Hypixel. Il
 * garde la clé Hypixel secrète, transforme un pseudo en UUID (PlayerDB, Mojang en secours) et ne
 * renvoie, pour chaque profil SkyBlock, que l'inventaire du joueur (sacs, inventaire, ender chest,
 * sacs à dos, coffre personnel).
 *
 * La clé Hypixel est limitée (300 requêtes par 5 minutes). Pour l'épargner, chaque profil lu est
 * gardé en cache (Workers KV) : renvoyé tel quel pendant 5 minutes, puis en secours quand Hypixel
 * refuse ou ne répond pas ; et chaque visiteur est limité à quelques recherches par minute.
 *
 *   GET /profiles?name=<pseudo>
 *   → { player: { uuid, name }, profiles: [{ id, name, selected, gameMode, inventory }], fetchedAt, stale }
 */

/** Ce que le serveur utilise de Workers KV. */
export interface KvStore {
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: string, options?: { readonly expirationTtl?: number }): Promise<void>
}

/** Ce que le serveur utilise du Rate Limiting de Cloudflare. */
export interface RateLimiter {
  limit(options: { readonly key: string }): Promise<{ readonly success: boolean }>
}

export interface Env {
  /** Clé API Hypixel (secret : `npx wrangler secret put HYPIXEL_API_KEY`). */
  readonly HYPIXEL_API_KEY?: string
  /** Adresses du site autorisées, séparées par des virgules. Vide : toutes les origines. */
  readonly ALLOWED_ORIGINS?: string
  /** Cache des profils lus. Absent : chaque recherche interroge Hypixel. */
  readonly PROFILE_CACHE?: KvStore
  /** Limite de recherches par visiteur. Absente : pas de limite. */
  readonly SEARCH_LIMITER?: RateLimiter
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

/** Accès au monde extérieur, remplaçables dans les tests. */
export interface Deps {
  readonly fetcher: Fetcher
  readonly now: () => number
  /** Laisse une tâche finir après la réponse (écriture du cache). */
  readonly waitUntil: (task: Promise<unknown>) => void
}

/** Pseudo Minecraft : lettres, chiffres et _, 16 caractères au plus (même règle que le site). */
const PLAYER_NAME = /^[A-Za-z0-9_]{1,16}$/
const UUID = /^[0-9a-f]{32}$/
/**
 * Un profil lu il y a moins de 5 minutes est renvoyé sans rappeler Hypixel : un joueur coûte au
 * plus une requête par fenêtre de quota, même cherché ou actualisé en boucle.
 */
const FRESH_MS = 5 * 60 * 1000
/** Le cache garde un profil un jour, en secours quand Hypixel refuse (quota épuisé) ou ne répond pas. */
const KEEP_SECONDS = 24 * 60 * 60
/** Préfixe des clés du cache ; à changer si la forme des profils gardés change. */
const CACHE_PREFIX = 'profiles:v1:'
/** Cache du navigateur, en secondes. */
const BROWSER_CACHE_SECONDS = 60
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

interface SlimProfile {
  readonly id: string
  readonly name: string
  readonly selected: boolean
  readonly gameMode: string | null
  readonly inventory: Record<string, unknown> | null
}

/** Ne garde de chaque profil que son nom, s'il est actif, son mode de jeu et l'inventaire du joueur. */
export function slimProfiles(body: unknown, uuid: string): SlimProfile[] {
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

const isSlimProfile = (value: unknown): value is SlimProfile =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.selected === 'boolean' &&
  (value.gameMode === null || typeof value.gameMode === 'string') &&
  (value.inventory === null || isRecord(value.inventory))

/** Profils d'un joueur tels que lus sur Hypixel à la date `fetchedAt` (ms). */
interface PlayerProfiles {
  readonly player: Player
  readonly profiles: readonly SlimProfile[]
  readonly fetchedAt: number
}

async function readCache(cache: KvStore | undefined, key: string): Promise<PlayerProfiles | null> {
  const value = cache ? await cache.get(key, 'json').catch(() => null) : null
  if (!isRecord(value) || typeof value.fetchedAt !== 'number' || !Array.isArray(value.profiles)) return null
  const player = isRecord(value.player) ? toPlayer(value.player.uuid, value.player.name) : null
  const profiles = value.profiles.filter(isSlimProfile)
  return player && profiles.length === value.profiles.length ? { player, profiles, fetchedAt: value.fetchedAt } : null
}

function writeCache(cache: KvStore | undefined, key: string, entry: PlayerProfiles, waitUntil: Deps['waitUntil']): void {
  if (!cache) return
  waitUntil(
    cache.put(key, JSON.stringify(entry), { expirationTtl: KEEP_SECONDS }).catch((error: unknown) => {
      // Offre gratuite de KV : 1 000 écritures par jour ; au-delà, les réponses partent sans cache.
      console.warn(`cache : écriture refusée (${error instanceof Error ? error.message : String(error)}).`)
    }),
  )
}

type HypixelResult =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly status: number; readonly error: string }

async function fetchHypixel(uuid: string, key: string, fetcher: Fetcher): Promise<HypixelResult> {
  const response = await fetcher(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${uuid}`, {
    headers: { 'API-Key': key, 'User-Agent': USER_AGENT },
  }).catch(() => null)
  if (!response) return { ok: false, status: 502, error: 'Hypixel est injoignable, réessaie dans un moment.' }
  // Visible avec `npx wrangler tail` : ce qu'il reste du quota de la clé sur la fenêtre de 5 minutes.
  const header = (name: string) => response.headers.get(name) ?? '?'
  console.log(`Hypixel ${response.status} · quota restant ${header('RateLimit-Remaining')}/${header('RateLimit-Limit')}`)
  if (response.status === 429) {
    // RateLimit-Reset : secondes avant le quota suivant.
    const reset = Number(response.headers.get('RateLimit-Reset'))
    const wait = Number.isFinite(reset) && reset > 0 ? `dans ${Math.ceil(reset)} s` : 'dans quelques minutes'
    return { ok: false, status: 429, error: `Trop de demandes à Hypixel : réessaie ${wait}.` }
  }
  if (response.status === 403) {
    return { ok: false, status: 502, error: 'Hypixel refuse la clé API du serveur (expirée ou invalide).' }
  }
  if (!response.ok) return { ok: false, status: 502, error: `Hypixel ne répond pas (erreur ${response.status}).` }
  const body: unknown = await response.json().catch(() => null)
  return body === null ? { ok: false, status: 502, error: 'Réponse de Hypixel illisible, réessaie dans un moment.' } : { ok: true, body }
}

function profilesResponse(entry: PlayerProfiles, stale: boolean, cors: Readonly<Record<string, string>>): Response {
  return json({ ...entry, stale }, 200, {
    ...cors,
    // Données de secours : pas gardées par le navigateur, pour relire Hypixel dès qu'il répond.
    'Cache-Control': stale ? 'no-store' : `public, max-age=${BROWSER_CACHE_SECONDS}`,
  })
}

export async function handleRequest(request: Request, env: Env, deps: Partial<Deps> = {}): Promise<Response> {
  const { fetcher = (url, init) => fetch(url, init), now = () => Date.now(), waitUntil = () => undefined } = deps
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
  const key = env.HYPIXEL_API_KEY
  if (!key) return json({ error: 'Serveur mal configuré : la clé Hypixel manque.' }, 500, cors)

  // Quelques recherches par minute et par visiteur : personne ne peut épuiser le quota à lui seul.
  const visitor = request.headers.get('CF-Connecting-IP') ?? 'inconnu'
  if (env.SEARCH_LIMITER && !(await env.SEARCH_LIMITER.limit({ key: visitor })).success) {
    return json({ error: 'Trop de recherches depuis ta connexion : réessaie dans une minute.' }, 429, cors)
  }

  // Les pseudos Minecraft ne tiennent pas compte des majuscules : « Notch » et « notch », même joueur.
  const cacheKey = `${CACHE_PREFIX}${name.toLowerCase()}`
  const cached = await readCache(env.PROFILE_CACHE, cacheKey)
  const age = cached ? now() - cached.fetchedAt : Infinity
  if (cached && age < FRESH_MS) {
    console.log(`cache : profil lu il y a ${Math.round(age / 1000)} s, Hypixel pas appelé.`)
    return profilesResponse(cached, false, cors)
  }

  const player = await lookupPlayer(name, fetcher)
  if (player === 'not-found') return json({ error: `Aucun joueur Minecraft ne s'appelle « ${name} ».` }, 404, cors)
  if (player === 'error') {
    if (cached) return profilesResponse(cached, true, cors)
    return json({ error: 'Les services de pseudos Minecraft ne répondent pas, réessaie dans un moment.' }, 502, cors)
  }

  const hypixel = await fetchHypixel(player.uuid, key, fetcher)
  if (!hypixel.ok) return cached ? profilesResponse(cached, true, cors) : json({ error: hypixel.error }, hypixel.status, cors)
  const entry: PlayerProfiles = { player, profiles: slimProfiles(hypixel.body, player.uuid), fetchedAt: now() }
  writeCache(env.PROFILE_CACHE, cacheKey, entry, waitUntil)
  return profilesResponse(entry, false, cors)
}
