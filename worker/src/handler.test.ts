import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleRequest, type Deps, type Env, type Fetcher, type KvStore, type RateLimiter } from './handler'

const UUID = '069a79f444e94726a5befca90e38aaf5'
const SITE = 'https://moi.github.io'
const ENV: Env = { HYPIXEL_API_KEY: 'cle-secrete', ALLOWED_ORIGINS: `${SITE}, http://localhost:5173` }
const NOW = 1_700_000_000_000
const MINUTE = 60_000

const jsonResponse = (body: unknown, status = 200, headers: Readonly<Record<string, string>> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

type Upstream = () => Response
const unavailable: Upstream = () => new Response(null, { status: 500 })

/** Réponses des services de pseudos : Notch, ou personne n'a ce pseudo. */
const notch = () =>
  jsonResponse({
    code: 'player.found',
    data: { player: { username: 'Notch', id: '069a79f4-44e9-4726-a5be-fca90e38aaf5', raw_id: UUID } },
    success: true,
  })
const nobody = () => jsonResponse({ code: 'minecraft.invalid_username', data: {}, success: false }, 400)
const mojangNotch = () => jsonResponse({ id: UUID, name: 'Notch' })
const refused = () => new Response(null, { status: 403 })

/** Hypixel : un profil avec un peu de Choconut dans les sacs, ou le quota de la clé épuisé. */
const oneProfile = () =>
  jsonResponse({
    success: true,
    profiles: [
      { profile_id: 'p1', cute_name: 'Apple', selected: true, members: { [UUID]: { inventory: { sacks_counts: { CHOCONUT: 3 } } } } },
    ],
  })
const APPLE = { id: 'p1', name: 'Apple', selected: true, gameMode: null, inventory: { sacks_counts: { CHOCONUT: 3 } } }
const throttled = () => jsonResponse({ success: false, cause: 'Key throttle' }, 429, { 'RateLimit-Reset': '42' })

/** Services de pseudos et Hypixel simulés ; garde la trace des appels. */
function upstream(responses: {
  readonly playerDb?: Upstream
  readonly mojang?: Upstream
  readonly minecraftServices?: Upstream
  readonly hypixel?: Upstream
}) {
  const routes: readonly (readonly [string, Upstream])[] = [
    ['https://playerdb.co/', responses.playerDb ?? nobody],
    ['https://api.mojang.com/', responses.mojang ?? unavailable],
    ['https://api.minecraftservices.com/', responses.minecraftServices ?? unavailable],
    ['https://api.hypixel.net/', responses.hypixel ?? unavailable],
  ]
  const calls: { url: string; init?: RequestInit }[] = []
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init })
    const route = routes.find(([prefix]) => url.startsWith(prefix))
    if (!route) throw new Error(`appel inattendu : ${url}`)
    return route[1]()
  }
  return { fetcher, calls }
}

/** Workers KV simulé, en mémoire. */
function memoryCache(): KvStore {
  const entries = new Map<string, string>()
  return {
    get: async (key) => {
      const value = entries.get(key)
      return value === undefined ? null : JSON.parse(value)
    },
    put: async (key, value) => {
      entries.set(key, value)
    },
  }
}

/** Écritures du cache lancées après les réponses ; attendues avant la requête suivante. */
const tasks: Promise<unknown>[] = []
const settle = () => Promise.all(tasks.splice(0))
const deps = (fetcher: Fetcher, now = NOW): Partial<Deps> => ({
  fetcher,
  now: () => now,
  waitUntil: (task) => {
    tasks.push(task)
  },
})

const request = (path: string, origin: string | null = SITE, method = 'GET') =>
  new Request(`https://serveur.example${path}`, { method, headers: origin ? { Origin: origin } : {} })

const hosts = (calls: readonly { url: string }[]) => calls.map((call) => new URL(call.url).host)

beforeEach(() => {
  // Journaux du serveur (quota, services en échec) : utiles avec wrangler tail, bruit dans les tests.
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(async () => {
  await settle()
  vi.restoreAllMocks()
})

describe('serveur : profils Hypixel', () => {
  it("ne renvoie que l'inventaire du joueur pour chaque profil, et envoie la clé à Hypixel", async () => {
    const { fetcher, calls } = upstream({
      playerDb: notch,
      hypixel: () =>
        jsonResponse({
          success: true,
          profiles: [
            {
              profile_id: 'p1',
              cute_name: 'Apple',
              selected: true,
              banking: { balance: 5 },
              members: {
                [UUID]: { inventory: { sacks_counts: { CHOCONUT: 3 } }, currencies: { coin_purse: 1e9 } },
                autre: { inventory: { sacks_counts: { GODSEED: 1 } } },
              },
            },
            { profile_id: 'p2', cute_name: 'Banana', game_mode: 'ironman', members: { [UUID]: {} } },
          ],
        }),
    })
    const response = await handleRequest(request('/profiles?name=notch'), ENV, deps(fetcher))
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(SITE)
    expect(await response.json()).toEqual({
      player: { uuid: UUID, name: 'Notch' },
      profiles: [APPLE, { id: 'p2', name: 'Banana', selected: false, gameMode: 'ironman', inventory: null }],
      fetchedAt: NOW,
      stale: false,
    })
    expect(calls[1]?.url).toBe(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${UUID}`)
    expect(new Headers(calls[1]?.init?.headers).get('API-Key')).toBe('cle-secrete')
  })

  it('refuse un pseudo invalide sans rien appeler, et signale un joueur introuvable', async () => {
    const invalid = upstream({})
    expect((await handleRequest(request('/profiles?name=pas%20un%20pseudo'), ENV, deps(invalid.fetcher))).status).toBe(400)
    expect(invalid.calls).toEqual([])
    const unknown = await handleRequest(request('/profiles?name=Personne'), ENV, deps(upstream({}).fetcher))
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toEqual({ error: "Aucun joueur Minecraft ne s'appelle « Personne »." })
  })

  it('passe au service de pseudos suivant quand PlayerDB ne répond pas', async () => {
    const relay = upstream({
      playerDb: () => {
        throw new TypeError('réseau coupé')
      },
      mojang: refused,
      minecraftServices: mojangNotch,
      hypixel: () => jsonResponse({ success: true, profiles: [] }),
    })
    const found = await handleRequest(request('/profiles?name=notch'), ENV, deps(relay.fetcher))
    expect(found.status).toBe(200)
    expect(await found.json()).toEqual({ player: { uuid: UUID, name: 'Notch' }, profiles: [], fetchedAt: NOW, stale: false })
    expect(hosts(relay.calls)).toEqual(['playerdb.co', 'api.mojang.com', 'api.minecraftservices.com', 'api.hypixel.net'])

    const unknown = upstream({ playerDb: unavailable, mojang: () => new Response(null, { status: 404 }) })
    expect((await handleRequest(request('/profiles?name=Personne'), ENV, deps(unknown.fetcher))).status).toBe(404)
    expect(unknown.calls).toHaveLength(2)

    const down = upstream({ playerDb: unavailable, mojang: refused, minecraftServices: refused })
    expect((await handleRequest(request('/profiles?name=Notch'), ENV, deps(down.fetcher))).status).toBe(502)
    expect(down.calls).toHaveLength(3)
  })

  it('traduit les erreurs de Hypixel : clé refusée, quota épuisé avec le temps à attendre', async () => {
    const denied = upstream({ playerDb: notch, hypixel: () => jsonResponse({ success: false }, 403) })
    expect((await handleRequest(request('/profiles?name=Notch'), ENV, deps(denied.fetcher))).status).toBe(502)
    const busy = await handleRequest(request('/profiles?name=Notch'), ENV, deps(upstream({ playerDb: notch, hypixel: throttled }).fetcher))
    expect(busy.status).toBe(429)
    expect(await busy.json()).toEqual({ error: 'Trop de demandes à Hypixel : réessaie dans 42 s.' })
  })

  it("n'accepte que les origines autorisées et répond aux requêtes préalables CORS", async () => {
    const { fetcher } = upstream({})
    expect((await handleRequest(request('/profiles?name=Notch', 'https://autre.site'), ENV, deps(fetcher))).status).toBe(403)
    const preflight = await handleRequest(request('/profiles', 'http://localhost:5173', 'OPTIONS'), ENV, deps(fetcher))
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
  })

  it('signale une clé Hypixel absente du serveur et une adresse inconnue', async () => {
    const { fetcher } = upstream({})
    expect((await handleRequest(request('/profiles?name=Notch'), { ALLOWED_ORIGINS: SITE }, deps(fetcher))).status).toBe(500)
    expect((await handleRequest(request('/autre'), ENV, deps(fetcher))).status).toBe(404)
  })
})

describe('serveur : quota de la clé Hypixel', () => {
  it('renvoie un profil lu il y a moins de 5 minutes sans rien rappeler, quelle que soit la casse', async () => {
    const env: Env = { ...ENV, PROFILE_CACHE: memoryCache() }
    await handleRequest(request('/profiles?name=Notch'), env, deps(upstream({ playerDb: notch, hypixel: oneProfile }).fetcher))
    await settle()

    const again = upstream({})
    const cached = await handleRequest(request('/profiles?name=NOTCH'), env, deps(again.fetcher, NOW + 4 * MINUTE))
    expect(await cached.json()).toEqual({ player: { uuid: UUID, name: 'Notch' }, profiles: [APPLE], fetchedAt: NOW, stale: false })
    expect(again.calls).toEqual([])

    const later = upstream({ playerDb: notch, hypixel: oneProfile })
    const reread = await handleRequest(request('/profiles?name=Notch'), env, deps(later.fetcher, NOW + 6 * MINUTE))
    expect(await reread.json()).toMatchObject({ fetchedAt: NOW + 6 * MINUTE, stale: false })
    expect(hosts(later.calls)).toEqual(['playerdb.co', 'api.hypixel.net'])
  })

  it('renvoie les dernières données connues quand Hypixel refuse, sans les laisser en cache du navigateur', async () => {
    const env: Env = { ...ENV, PROFILE_CACHE: memoryCache() }
    const twoHoursAgo = NOW - 120 * MINUTE
    await handleRequest(request('/profiles?name=Notch'), env, deps(upstream({ playerDb: notch, hypixel: oneProfile }).fetcher, twoHoursAgo))
    await settle()

    const stale = await handleRequest(request('/profiles?name=Notch'), env, deps(upstream({ playerDb: notch, hypixel: throttled }).fetcher))
    expect(stale.status).toBe(200)
    expect(stale.headers.get('Cache-Control')).toBe('no-store')
    expect(await stale.json()).toEqual({ player: { uuid: UUID, name: 'Notch' }, profiles: [APPLE], fetchedAt: twoHoursAgo, stale: true })
  })

  it('limite les recherches par visiteur, avant tout appel extérieur', async () => {
    const visitors: string[] = []
    const limiter: RateLimiter = {
      limit: async ({ key }) => {
        visitors.push(key)
        return { success: false }
      },
    }
    const { fetcher, calls } = upstream({ playerDb: notch, hypixel: oneProfile })
    const blocked = await handleRequest(
      new Request('https://serveur.example/profiles?name=Notch', { headers: { Origin: SITE, 'CF-Connecting-IP': '203.0.113.7' } }),
      { ...ENV, SEARCH_LIMITER: limiter },
      deps(fetcher),
    )
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual({ error: 'Trop de recherches depuis ta connexion : réessaie dans une minute.' })
    expect(visitors).toEqual(['203.0.113.7'])
    expect(calls).toEqual([])
  })
})
