import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleRequest, type Env, type Fetcher } from './handler'

const UUID = '069a79f444e94726a5befca90e38aaf5'
const SITE = 'https://moi.github.io'
const ENV: Env = { HYPIXEL_API_KEY: 'cle-secrete', ALLOWED_ORIGINS: `${SITE}, http://localhost:5173` }

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

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

const request = (path: string, origin: string | null = SITE, method = 'GET') =>
  new Request(`https://serveur.example${path}`, { method, headers: origin ? { Origin: origin } : {} })

afterEach(() => {
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
    const response = await handleRequest(request('/profiles?name=notch'), ENV, fetcher)
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(SITE)
    expect(await response.json()).toEqual({
      player: { uuid: UUID, name: 'Notch' },
      profiles: [
        { id: 'p1', name: 'Apple', selected: true, gameMode: null, inventory: { sacks_counts: { CHOCONUT: 3 } } },
        { id: 'p2', name: 'Banana', selected: false, gameMode: 'ironman', inventory: null },
      ],
    })
    expect(calls[1]?.url).toBe(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${UUID}`)
    expect(new Headers(calls[1]?.init?.headers).get('API-Key')).toBe('cle-secrete')
  })

  it('refuse un pseudo invalide sans rien appeler, et signale un joueur introuvable', async () => {
    const invalid = upstream({})
    expect((await handleRequest(request('/profiles?name=pas%20un%20pseudo'), ENV, invalid.fetcher)).status).toBe(400)
    expect(invalid.calls).toEqual([])
    const unknown = await handleRequest(request('/profiles?name=Personne'), ENV, upstream({}).fetcher)
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toEqual({ error: "Aucun joueur Minecraft ne s'appelle « Personne »." })
  })

  it('passe au service de pseudos suivant quand PlayerDB ne répond pas', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const relay = upstream({
      playerDb: () => {
        throw new TypeError('réseau coupé')
      },
      mojang: refused,
      minecraftServices: mojangNotch,
      hypixel: () => jsonResponse({ success: true, profiles: [] }),
    })
    const found = await handleRequest(request('/profiles?name=notch'), ENV, relay.fetcher)
    expect(found.status).toBe(200)
    expect(await found.json()).toEqual({ player: { uuid: UUID, name: 'Notch' }, profiles: [] })
    expect(relay.calls.map((call) => new URL(call.url).host)).toEqual([
      'playerdb.co',
      'api.mojang.com',
      'api.minecraftservices.com',
      'api.hypixel.net',
    ])

    const unknown = upstream({ playerDb: unavailable, mojang: () => new Response(null, { status: 404 }) })
    expect((await handleRequest(request('/profiles?name=Personne'), ENV, unknown.fetcher)).status).toBe(404)
    expect(unknown.calls).toHaveLength(2)

    const down = upstream({ playerDb: unavailable, mojang: refused, minecraftServices: refused })
    expect((await handleRequest(request('/profiles?name=Notch'), ENV, down.fetcher)).status).toBe(502)
    expect(down.calls).toHaveLength(3)
  })

  it('traduit les erreurs de Hypixel : clé refusée, trop de demandes', async () => {
    const denied = upstream({ playerDb: notch, hypixel: () => jsonResponse({ success: false }, 403) })
    expect((await handleRequest(request('/profiles?name=Notch'), ENV, denied.fetcher)).status).toBe(502)
    const busy = upstream({ playerDb: notch, hypixel: () => jsonResponse({ success: false }, 429) })
    expect((await handleRequest(request('/profiles?name=Notch'), ENV, busy.fetcher)).status).toBe(429)
  })

  it("n'accepte que les origines autorisées et répond aux requêtes préalables CORS", async () => {
    const { fetcher } = upstream({})
    expect((await handleRequest(request('/profiles?name=Notch', 'https://autre.site'), ENV, fetcher)).status).toBe(403)
    const preflight = await handleRequest(request('/profiles', 'http://localhost:5173', 'OPTIONS'), ENV, fetcher)
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
  })

  it('signale une clé Hypixel absente du serveur et une adresse inconnue', async () => {
    const { fetcher } = upstream({})
    expect((await handleRequest(request('/profiles?name=Notch'), { ALLOWED_ORIGINS: SITE }, fetcher)).status).toBe(500)
    expect((await handleRequest(request('/autre'), ENV, fetcher)).status).toBe(404)
  })
})
