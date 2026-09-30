/**
 * Télécharge depuis le Hypixel SkyBlock Wiki (Fandom, CC BY-SA) les images de ce qu'affiche
 * l'application : mutations, crops de base, sols, objectifs, drops de la Harvest Bounty, icônes
 * des upgrades et quelques objets de l'interface. Les fichiers vont dans src/assets/wiki/ et le
 * manifeste (nom affiché → fichier) dans src/data/wikiImages.json.
 *
 * Les sols sont des blocs rendus en 3D : leur face du dessus est aussi remise à plat en texture
 * 16 × 16 (fichiers *_top.png) pour le fond des cases de la grille.
 *
 * Usage : npm run images
 * À relancer après avoir ajouté une mutation ou un crop dans mutations.json.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { decodePng, encodePng, topFaceTexture } from './png.mjs'

const API = 'https://hypixel-skyblock.fandom.com/api.php'
const HEADERS = { 'User-Agent': 'GreenhousePlanner/1.0 (outil de fan non officiel ; images créditées)' }
const ROOT = new URL('../', import.meta.url)
const ASSETS = new URL('src/assets/wiki/', ROOT)
const MANIFEST = new URL('src/data/wikiImages.json', ROOT)
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// Objets de l'interface absents de mutations.json : vitres et flèche du menu des upgrades, etc.
const UI_ITEMS = [
  'Gray Stained Glass Pane',
  'Lime Stained Glass Pane',
  'Yellow Stained Glass Pane',
  'Red Stained Glass Pane',
  'Arrow',
  'Ethereal Vine',
  'Copper',
  'Plant Diagnostics Tool',
  'Rosewater Flask',
]

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`
  const response = await fetch(url, { headers: HEADERS })
  if (!response.ok) throw new Error(`${response.status} pour ${url}`)
  return response.json()
}

/**
 * Télécharge une image en PNG. Le CDN de Fandom convertit en WebP quand on accepte tout : on
 * demande le PNG, puis le format d'origine, et on vérifie la signature.
 */
async function downloadPng(url) {
  for (const candidate of [url, `${url}${url.includes('?') ? '&' : '?'}format=original`]) {
    const response = await fetch(candidate, { headers: { ...HEADERS, Accept: 'image/png' } })
    if (!response.ok) throw new Error(`${response.status} pour ${candidate}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return bytes
  }
  throw new Error(`Pas de PNG pour ${url}`)
}

const data = JSON.parse(await readFile(new URL('src/data/mutations.json', ROOT), 'utf8'))
const names = [
  ...new Set([
    ...data.mutations.map((m) => m.name),
    ...data.baseCrops.map((c) => c.name),
    ...data.surfaces,
    ...data.goals.map((g) => g.name),
    ...data.mechanics.harvestBounty.possibleDrops,
    ...data.mechanics.greenhouseUpgrades.items.map((u) => u.icon),
    ...data.mutationsSack.items,
    ...UI_ITEMS,
  ]),
]

// 1. Fichier « File:<Nom>.png » de chaque nom, en suivant les redirections du wiki
//    (ex. Moonflower → Blue Orchid, Dead Plant → Dead Bush).
const found = new Map()
for (let i = 0; i < names.length; i += 50) {
  const batch = names.slice(i, i + 50)
  const { query } = await api({
    action: 'query',
    titles: batch.map((name) => `File:${name}.png`).join('|'),
    prop: 'imageinfo',
    iiprop: 'url|mime',
    redirects: '1',
  })
  const normalized = new Map((query.normalized ?? []).map((n) => [n.from, n.to]))
  const redirects = new Map((query.redirects ?? []).map((r) => [r.from, r.to]))
  const pages = new Map(Object.values(query.pages).map((page) => [page.title, page]))
  for (const name of batch) {
    const asked = `File:${name}.png`
    const title = redirects.get(normalized.get(asked) ?? asked) ?? normalized.get(asked) ?? asked
    const info = pages.get(title)?.imageinfo?.[0]
    if (info?.mime === 'image/png') found.set(name, { file: title.slice('File:'.length).replaceAll(' ', '_'), url: info.url })
  }
}

// 2. Téléchargement (une fois par fichier, même si plusieurs noms y renvoient).
await mkdir(ASSETS, { recursive: true })
const files = new Map([...found.values()].map((entry) => [entry.file, entry.url]))
const downloaded = new Map()
for (const [file, url] of files) {
  const bytes = await downloadPng(url)
  downloaded.set(file, bytes)
  await writeFile(new URL(file, ASSETS), bytes)
}

// 3. Textures de sol : face du dessus des blocs, remise à plat.
const textures = {}
for (const surface of data.surfaces) {
  const entry = found.get(surface)
  if (!entry) continue
  const file = entry.file.replace(/\.png$/, '_top.png')
  await writeFile(new URL(file, ASSETS), encodePng(topFaceTexture(decodePng(downloaded.get(entry.file)))))
  textures[surface] = file
}

// 4. Manifeste, trié pour des différences lisibles.
const { query: site } = await api({ action: 'query', meta: 'siteinfo', siprop: 'rightsinfo' })
const sorted = (entries) => Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)))
const manifest = {
  _meta: {
    source: 'Hypixel SkyBlock Wiki (Fandom)',
    sourceUrl: 'https://hypixel-skyblock.fandom.com/',
    license: site.rightsinfo.text,
    licenseUrl: site.rightsinfo.url,
    rights: "Textures d'origine © Mojang Studios et Hypixel Inc.",
    changes: 'Textures de sol : face du dessus des blocs, remise à plat en 16 × 16.',
    fetchedAt: new Date().toISOString().slice(0, 10),
    generatedBy: 'scripts/fetch-wiki-images.mjs',
  },
  images: sorted([...found].map(([name, { file }]) => [name, file])),
  textures: sorted(Object.entries(textures)),
}
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)

const missing = names.filter((name) => !found.has(name))
console.log(`${found.size} noms illustrés, ${files.size} fichiers téléchargés, ${Object.keys(textures).length} textures de sol.`)
if (missing.length > 0) console.log(`Sans image sur le wiki : ${missing.join(', ')}`)
