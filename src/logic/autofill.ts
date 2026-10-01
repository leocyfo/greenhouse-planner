/**
 * Remplissage automatique de la grille (logique pure, déterministe) : pour une mutation cible, un
 * plan qui donne `spots` emplacements de spawn avec le moins de crops possible.
 *
 * Seuls les ingrédients de la cible sont posés. Ordre de ce qui compte (énergie à minimiser) :
 * 1. les emplacements manquants ; 2. les conflits (une autre mutation peut apparaître sur un
 * emplacement) ; 3. les apparitions indésirables sur les cases laissées vides ; 4. le coût des crops
 * posés : une mutation coûte ce qu'il faut de mutations pour en faire une (mutationCost : 1 pour
 * une Choconut, 62 pour un PlantBoy Advance), un crop de base presque rien ; 5. l'étendue du plan
 * depuis le coin haut gauche (un plan compact laisse de la place) ; 6. la tenue (TIDY).
 *
 * Recherche : recuit simulé (poser, retirer, changer un crop), le compte des voisins étant tenu à
 * jour case par case ; plusieurs essais, puis on retire les crops devenus inutiles. Le plan obtenu
 * est revérifié par la logique de la grille (analyzeGrid), qui fait foi pour le résultat.
 */
import type { CropRef, GameData, Mutation, Placement } from '../types/game'
import { tr } from '../i18n/locale'
import { analyzeGrid, cropSide, type GridInput } from './grid'
import { computePlan } from './recipes'
import { isUsableGround } from './ground'
import { cropKey, mutationsForCells } from './neighborRule'

export interface AutofillRequest {
  readonly targetId: string
  /** Emplacements voulus (au moins 1). */
  readonly spots: number
  readonly width: number
  readonly height: number
  /** Sol de départ : les cases verrouillées ou cassées restent vides, le sol est gardé ailleurs. */
  readonly ground: readonly string[]
  /** Exemplaires disponibles de chaque mutation (id → nombre) ; absent : sans limite. */
  readonly stock?: ReadonlyMap<string, number> | null
  /** Graine du hasard (même graine, même plan). */
  readonly seed?: number
  /** Itérations par essai (plus : meilleur plan, plus long). */
  readonly iterations?: number
  /** Nombre d'essais. */
  readonly restarts?: number
}

export interface AutofillResult {
  readonly placements: readonly Placement[]
  readonly ground: readonly string[]
  /** Emplacements de la cible (sans chevauchement), vérifiés par analyzeGrid. */
  readonly spots: number
  /** Cases d'emplacement où une autre mutation peut aussi apparaître. */
  readonly conflicts: number
  readonly mutations: ReadonlyMap<string, number>
  readonly baseCrops: ReadonlyMap<string, number>
}

export type AutofillOutcome = { readonly ok: true; readonly result: AutofillResult } | { readonly ok: false; readonly reason: string }

/**
 * Coût d'une mutation posée : combien de mutations il faut faire pour en obtenir une (elle comprise),
 * d'après le calcul du Calculateur en mode Minimum, sans stock. Choconut 1, Chocoberry 9 (6 Choconut
 * et 2 Gloomgourd autour), PlantBoy Advance 62.
 */
export function mutationCost(data: GameData, mutationId: string): number {
  const plan = computePlan(data, { targets: [{ mutationId, quantity: 1 }], inventory: {}, mode: 'minimum' })
  let total = 1
  for (const [id, need] of plan.needs) if (id !== mutationId) total += need.required
  return total
}

/** Mutations qu'on peut remplir automatiquement : celles qui apparaissent par leurs conditions. */
export function autofillTargets(data: GameData): Mutation[] {
  return data.mutations.filter((m) => m.spawnRule === 'conditions' && m.conditions.length > 0)
}

/**
 * Poids de l'énergie. `missing` : par voisin manquant sur les meilleurs emplacements (une case
 * d'empreinte occupée compte OCCUPIED voisins manquants) ; la recherche progresse ainsi pas à pas
 * vers un emplacement complet, même quand il en faut 12 d'un coup (Glasscorn). Il monte avec les
 * ingrédients les plus chers (MISSING_OVER_COST fois leur coût), pour qu'un voisin manquant coûte
 * toujours plus que le crop qui le fournit. `mutation` : par mutation qu'il faut faire pour en
 * obtenir une (voir mutationCost).
 */
const WEIGHTS = { missing: 1_000, conflict: 3_000, unwanted: 200, mutation: 10, base: 1, extent: 0.05 } as const
const OCCUPIED = 2
const MISSING_OVER_COST = 5
/**
 * Prix fixe (en voisins manquants) d'un emplacement incomplet : finir un emplacement vaut toujours
 * mieux qu'en avancer plusieurs (petite zone), et un emplacement complet en conflit inévitable
 * (Zombud et Witherbloom) vaut mieux qu'un emplacement presque complet.
 */
const INCOMPLETE = 4

/**
 * Tenue du plan (demande du joueur : « les mutations de la même sorte le plus proche possible,
 * connectées et symétriques »), départage entre plans de même coût. Poids assez petits pour que la
 * tenue ne justifie jamais un crop de plus : au pire, un crop gagne 0,2 × 3 + 0,05 × 4 + 0,01 × 4
 * < 1 (le prix d'un crop de base).
 * - group : par groupe séparé en trop d'une même sorte de crop (4 voisins) ;
 * - mirror : par case qui diffère de son reflet (gauche-droite, haut-bas), ou de son image par un
 *   demi-tour, dans le cadre du plan (la meilleure des deux symétries) ;
 * - touch : par paire de crops voisins de même sorte (en moins).
 */
const TIDY = { group: 0.2, mirror: 0.05, touch: 0.01 } as const
/** Codes d'une case pour la tenue : sorte de crop (0, 1…), emplacement, ou vide. */
/** Préférence des reflets sur le demi-tour (en cases de différence). */
const TURN_EXTRA = 4
const SPOT_CODE = -2
const EMPTY_CODE = -1

/** Tenue d'une grille de codes (plus bas : plus propre). `seen` et `queue` : tampons de la taille de la grille. */
function tidiness(codes: ArrayLike<number>, width: number, height: number, seen: Uint8Array, queue: Int32Array): number {
  const size = width * height
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let c = 0; c < size; c += 1) {
    if (codes[c] === EMPTY_CODE) continue
    const x = c % width
    const y = (c - x) / width
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (maxX < 0) return 0
  seen.fill(0)
  const kinds = new Set<number>()
  let groups = 0
  let touch = 0
  for (let c = 0; c < size; c += 1) {
    const code = codes[c] ?? EMPTY_CODE
    if (code < 0) continue
    if (c % width < width - 1 && codes[c + 1] === code) touch += 1
    if (c + width < size && codes[c + width] === code) touch += 1
    if (seen[c]) continue
    kinds.add(code)
    groups += 1
    let head = 0
    let tail = 0
    queue[tail++] = c
    seen[c] = 1
    while (head < tail) {
      const cell = queue[head++] ?? 0
      const x = cell % width
      for (const next of [x > 0 ? cell - 1 : -1, x < width - 1 ? cell + 1 : -1, cell - width, cell + width]) {
        if (next < 0 || next >= size || seen[next] || codes[next] !== code) continue
        seen[next] = 1
        queue[tail++] = next
      }
    }
  }
  // Symétrie : par les deux reflets (gauche-droite, haut-bas), ou par un demi-tour (moulinet, comme
  // le plan AVRG d'All-in Aloe) ; la meilleure des deux compte, les reflets d'abord (plus lisibles :
  // le demi-tour compte TURN_EXTRA cases de différence en plus).
  let mirrored = 0
  let turned = 0
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const code = codes[y * width + x]
      if (codes[y * width + (minX + maxX - x)] !== code) mirrored += 1
      if (codes[(minY + maxY - y) * width + x] !== code) mirrored += 1
      if (codes[(minY + maxY - y) * width + (minX + maxX - x)] !== code) turned += 2
    }
  }
  const mismatches = Math.min(mirrored, turned + TURN_EXTRA) / 2
  return TIDY.group * (groups - kinds.size) + TIDY.mirror * mismatches - TIDY.touch * touch
}
const DEFAULT_ITERATIONS = 30_000
/** Pas du polissage final (tenue et compacité). */
const POLISH_STEPS = 20_000
const DEFAULT_RESTARTS = 3

/** Générateur pseudo-aléatoire (mulberry32) : déterministe pour une graine donnée. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

interface Kind {
  readonly crop: CropRef
  readonly side: number
  readonly mutation: boolean
  /** Coût d'une pose dans l'énergie (voir mutationCost). */
  readonly weight: number
  /** Exemplaires disponibles (Infinity : sans limite). */
  readonly limit: number
}

/** Mutation suivie par la recherche : la cible, ou une concurrente qui pourrait apparaître avec les mêmes ingrédients. */
interface Tracked {
  readonly side: number
  readonly surface: string
  /** Voisins demandés, par sorte de crop (0 : aucun). */
  readonly need: Int32Array
  /** Ancres possibles (empreinte dans la grille, sur des cases utilisables). */
  readonly anchors: Int32Array
  readonly footprint: readonly Int32Array[]
  readonly ring: readonly Int32Array[]
  /** Par case : ancres dont l'empreinte, ou l'anneau, contient la case. */
  readonly footprintOf: readonly number[][]
  readonly ringOf: readonly number[][]
  /** Par ancre : cases vides de l'empreinte, voisins par sorte, voisins manquants, règle remplie. */
  readonly empty: Int32Array
  readonly counts: Int32Array
  readonly deficit: Int32Array
  readonly ready: Uint8Array
  /** Plus grand manque possible (tri par paquets). */
  readonly maxDeficit: number
}

function track(mutation: Mutation, kinds: readonly Kind[], width: number, height: number, usable: Uint8Array): Tracked {
  const side = mutation.side
  const need = new Int32Array(kinds.length)
  for (const condition of mutation.conditions) {
    const index = kinds.findIndex((kind) => cropKey(kind.crop) === cropKey(condition.crop))
    if (index >= 0) need[index] = condition.count
  }
  const anchors: number[] = []
  const footprint: Int32Array[] = []
  const ring: Int32Array[] = []
  const footprintOf: number[][] = Array.from({ length: width * height }, () => [])
  const ringOf: number[][] = Array.from({ length: width * height }, () => [])
  for (let y = 0; y + side <= height; y += 1) {
    for (let x = 0; x + side <= width; x += 1) {
      const cells: number[] = []
      for (let dy = 0; dy < side; dy += 1) for (let dx = 0; dx < side; dx += 1) cells.push((y + dy) * width + x + dx)
      if (cells.some((cell) => !usable[cell])) continue
      const around: number[] = []
      for (let ry = y - 1; ry <= y + side; ry += 1) {
        for (let rx = x - 1; rx <= x + side; rx += 1) {
          const inside = rx >= x && rx < x + side && ry >= y && ry < y + side
          if (!inside && rx >= 0 && ry >= 0 && rx < width && ry < height) around.push(ry * width + rx)
        }
      }
      const index = anchors.length
      anchors.push(y * width + x)
      footprint.push(Int32Array.from(cells))
      ring.push(Int32Array.from(around))
      for (const cell of cells) footprintOf[cell]?.push(index)
      for (const cell of around) ringOf[cell]?.push(index)
    }
  }
  const empty = new Int32Array(anchors.length)
  footprint.forEach((cells, index) => (empty[index] = cells.length))
  const totalNeed = need.reduce((sum, value) => sum + value, 0)
  return {
    side,
    surface: mutation.surface,
    need,
    anchors: Int32Array.from(anchors),
    footprint,
    ring,
    footprintOf,
    ringOf,
    empty,
    counts: new Int32Array(anchors.length * kinds.length),
    deficit: new Int32Array(anchors.length).fill(totalNeed),
    ready: new Uint8Array(anchors.length),
    maxDeficit: totalNeed + OCCUPIED * side * side,
  }
}

/** Une recherche : l'état de la grille, tenu à jour à chaque changement de case. */
class Search {
  private readonly cellKind: Int32Array
  private readonly cellOwner: Int32Array
  private readonly pKind: number[] = []
  private readonly pAnchor: number[] = []
  private readonly pAlive: boolean[] = []
  /** Poses vivantes, et place de chacune dans cette liste. */
  private readonly aliveList: number[] = []
  private readonly alivePos: number[] = []
  private readonly used: Int32Array
  /** Coût des crops posés (somme des poids). */
  private cost = 0
  private alive = 0
  private readonly spotMask: Uint8Array
  private readonly rivalMask: Uint8Array
  private readonly pickMask: Uint8Array
  private readonly bucketCount: Int32Array
  private readonly order: Int32Array
  /** Part de l'étendue (compacité) dans la dernière énergie calculée. */
  private lastExtent = 0
  private readonly tidyCodes: Int32Array
  private readonly tidySeen: Uint8Array
  private readonly tidyQueue: Int32Array

  private readonly kinds: readonly Kind[]
  private readonly tracked: readonly Tracked[]
  private readonly width: number
  private readonly height: number
  private readonly usable: Uint8Array
  private readonly ground: readonly string[]
  private wanted: number
  /** Prix d'un voisin manquant (voir WEIGHTS). */
  private readonly missingWeight: number

  constructor(
    kinds: readonly Kind[],
    tracked: readonly Tracked[],
    width: number,
    height: number,
    usable: Uint8Array,
    ground: readonly string[],
    wanted: number,
    missingWeight: number,
  ) {
    this.kinds = kinds
    this.tracked = tracked
    this.width = width
    this.height = height
    this.usable = usable
    this.ground = ground
    this.wanted = wanted
    this.missingWeight = missingWeight
    this.cellKind = new Int32Array(width * height).fill(-1)
    this.cellOwner = new Int32Array(width * height).fill(-1)
    this.used = new Int32Array(kinds.length)
    this.spotMask = new Uint8Array(width * height)
    this.rivalMask = new Uint8Array(width * height)
    this.pickMask = new Uint8Array(width * height)
    const target = tracked[0]
    this.bucketCount = new Int32Array((target?.maxDeficit ?? 0) + 2)
    this.order = new Int32Array(target?.anchors.length ?? 0)
    this.tidyCodes = new Int32Array(width * height)
    this.tidySeen = new Uint8Array(width * height)
    this.tidyQueue = new Int32Array(width * height)
  }

  private setCell(cell: number, kind: number): void {
    const previous = this.cellKind[cell] ?? -1
    if (previous === kind) return
    this.cellKind[cell] = kind
    const k = this.kinds.length
    for (const t of this.tracked) {
      for (const anchor of t.footprintOf[cell] ?? []) {
        if (previous === -1) t.empty[anchor] = (t.empty[anchor] ?? 0) - 1
        if (kind === -1) t.empty[anchor] = (t.empty[anchor] ?? 0) + 1
        this.refresh(t, anchor)
      }
      for (const anchor of t.ringOf[cell] ?? []) {
        if (previous >= 0) t.counts[anchor * k + previous] = (t.counts[anchor * k + previous] ?? 0) - 1
        if (kind >= 0) t.counts[anchor * k + kind] = (t.counts[anchor * k + kind] ?? 0) + 1
        this.refresh(t, anchor)
      }
    }
  }

  private refresh(t: Tracked, anchor: number): void {
    const k = this.kinds.length
    let deficit = OCCUPIED * ((t.footprint[anchor]?.length ?? 0) - (t.empty[anchor] ?? 0))
    for (let kind = 0; kind < k; kind += 1) deficit += Math.max(0, (t.need[kind] ?? 0) - (t.counts[anchor * k + kind] ?? 0))
    t.deficit[anchor] = deficit
    t.ready[anchor] = deficit === 0 ? 1 : 0
  }

  /** Cases d'une empreinte ancrée en `cell`, ou null si elle sort de la grille ou touche une case inutilisable. */
  private cellsOf(cell: number, side: number): number[] | null {
    const x = cell % this.width
    const y = Math.floor(cell / this.width)
    if (x + side > this.width || y + side > this.height) return null
    const cells: number[] = []
    for (let dy = 0; dy < side; dy += 1) {
      for (let dx = 0; dx < side; dx += 1) {
        const c = (y + dy) * this.width + x + dx
        if (!this.usable[c]) return null
        cells.push(c)
      }
    }
    return cells
  }

  canPlace(kind: number, cell: number): boolean {
    const info = this.kinds[kind]
    return info !== undefined && (this.used[kind] ?? 0) < info.limit && this.cellsOf(cell, info.side) !== null
  }

  /** Pose une sorte de crop (ancre en `cell`), en retirant ce qu'elle recouvre. Renvoie les changements, pour les défaire. */
  place(kind: number, cell: number): number[] {
    const info = this.kinds[kind]
    const cells = info ? this.cellsOf(cell, info.side) : null
    if (!info || !cells) return []
    const removed = new Set<number>()
    for (const c of cells) {
      const owner = this.cellOwner[c] ?? -1
      if (owner >= 0) removed.add(owner)
    }
    for (const id of removed) this.remove(id)
    const id = this.pKind.length
    this.pKind.push(kind)
    this.pAnchor.push(cell)
    this.pAlive.push(true)
    this.alivePos.push(this.aliveList.length)
    this.aliveList.push(id)
    this.count(kind, 1)
    for (const c of cells) {
      this.cellOwner[c] = id
      this.setCell(c, kind)
    }
    return [id, ...removed]
  }

  remove(id: number): void {
    if (!this.pAlive[id]) return
    const kind = this.pKind[id] ?? 0
    const cells = this.cellsOf(this.pAnchor[id] ?? 0, this.kinds[kind]?.side ?? 1) ?? []
    this.pAlive[id] = false
    this.unlist(id)
    this.count(kind, -1)
    for (const c of cells) {
      this.cellOwner[c] = -1
      this.setCell(c, -1)
    }
  }

  /** Remet une pose retirée (pour défaire). */
  restore(id: number): void {
    if (this.pAlive[id]) return
    const kind = this.pKind[id] ?? 0
    const cells = this.cellsOf(this.pAnchor[id] ?? 0, this.kinds[kind]?.side ?? 1) ?? []
    this.pAlive[id] = true
    this.alivePos[id] = this.aliveList.length
    this.aliveList.push(id)
    this.count(kind, 1)
    for (const c of cells) {
      this.cellOwner[c] = id
      this.setCell(c, kind)
    }
  }

  /** Retire une pose de la liste des vivantes (échange avec la dernière). */
  private unlist(id: number): void {
    const position = this.alivePos[id] ?? -1
    const last = this.aliveList.pop()
    if (last === undefined || last === id || position < 0) return
    this.aliveList[position] = last
    this.alivePos[last] = position
  }

  private count(kind: number, delta: number): void {
    this.used[kind] = (this.used[kind] ?? 0) + delta
    this.alive += delta
    this.cost += delta * (this.kinds[kind]?.weight ?? 0)
  }

  randomPlacement(rand: () => number): number {
    if (this.aliveList.length === 0) return -1
    return this.aliveList[Math.floor(rand() * this.aliveList.length)] ?? -1
  }

  kindOf(id: number): number {
    return this.pKind[id] ?? -1
  }

  anchorOf(id: number): number {
    return this.pAnchor[id] ?? -1
  }

  /** Nombre de crops posés. */
  size(): number {
    return this.alive
  }

  livePlacements(): number[] {
    return [...this.aliveList].sort((a, b) => a - b)
  }

  /**
   * Voisins manquants des `wanted` meilleurs emplacements, sans chevauchement : ancres triées par
   * manque croissant (tri par paquets), prises dans l'ordre tant qu'elles ne se chevauchent pas.
   */
  private missing(target: Tracked): number {
    const count = this.bucketCount
    count.fill(0)
    const anchors = target.anchors.length
    for (let a = 0; a < anchors; a += 1) count[(target.deficit[a] ?? 0) + 1] = (count[(target.deficit[a] ?? 0) + 1] ?? 0) + 1
    for (let d = 1; d < count.length; d += 1) count[d] = (count[d] ?? 0) + (count[d - 1] ?? 0)
    for (let a = 0; a < anchors; a += 1) {
      const d = target.deficit[a] ?? 0
      this.order[count[d] ?? 0] = a
      count[d] = (count[d] ?? 0) + 1
    }
    if (target.side > 1) this.pickMask.fill(0)
    let picked = 0
    let total = 0
    for (let i = 0; i < anchors && picked < this.wanted; i += 1) {
      const a = this.order[i] ?? 0
      if (target.side > 1) {
        const cells = target.footprint[a] ?? new Int32Array()
        if (cells.some((c) => this.pickMask[c] === 1)) continue
        for (const c of cells) this.pickMask[c] = 1
      }
      const deficit = target.deficit[a] ?? 0
      total += deficit + (deficit > 0 ? INCOMPLETE : 0)
      picked += 1
    }
    // Pas assez de place : chaque emplacement impossible compte comme entièrement manquant.
    return total + (this.wanted - picked) * (target.maxDeficit + INCOMPLETE)
  }

  /** Change le nombre d'emplacements visés (nettoyage final sur les emplacements obtenus). */
  setWanted(wanted: number): void {
    this.wanted = Math.max(1, wanted)
  }

  /** Part de l'étendue (compacité) dans la dernière énergie calculée. */
  extentCost(): number {
    return this.lastExtent
  }

  /** Tenue de l'état courant (voir TIDY) ; les emplacements sont ceux du dernier appel à energy(). */
  tidiness(): number {
    const codes = this.tidyCodes
    for (let c = 0; c < codes.length; c += 1) codes[c] = this.spotMask[c] ? SPOT_CODE : (this.cellKind[c] ?? EMPTY_CODE)
    return tidiness(codes, this.width, this.height, this.tidySeen, this.tidyQueue)
  }

  /** Emplacements complets de la cible, sans chevauchement. */
  completeSpots(): number {
    const target = this.tracked[0]
    if (!target) return 0
    this.pickMask.fill(0)
    let spots = 0
    for (let a = 0; a < target.anchors.length; a += 1) {
      if (!target.ready[a]) continue
      const cells = target.footprint[a] ?? new Int32Array()
      if (cells.some((c) => this.pickMask[c] === 1)) continue
      for (const c of cells) this.pickMask[c] = 1
      spots += 1
    }
    return spots
  }

  /** Énergie de l'état courant (voir WEIGHTS). */
  energy(): number {
    const target = this.tracked[0]
    if (!target) return Infinity
    this.spotMask.fill(0)
    let maxX = -1
    let maxY = -1
    for (let a = 0; a < target.anchors.length; a += 1) {
      if (!target.ready[a]) continue
      const cells = target.footprint[a] ?? new Int32Array()
      if (target.side > 1 && cells.some((c) => this.spotMask[c] === 1)) continue
      for (const c of cells) this.spotMask[c] = 1
    }
    const missing = this.missing(target)
    this.rivalMask.fill(0)
    for (let r = 1; r < this.tracked.length; r += 1) {
      const rival = this.tracked[r]
      if (!rival) continue
      for (let b = 0; b < rival.anchors.length; b += 1) {
        if (!rival.ready[b]) continue
        const cells = rival.footprint[b] ?? new Int32Array()
        const soil = (c: number) => (this.spotMask[c] ? target.surface : this.ground[c])
        if (cells.every((c) => soil(c) === rival.surface)) for (const c of cells) this.rivalMask[c] = 1
      }
    }
    let conflicts = 0
    let unwanted = 0
    for (let c = 0; c < this.cellKind.length; c += 1) {
      if (this.rivalMask[c]) {
        if (this.spotMask[c]) conflicts += 1
        else unwanted += 1
      }
      if (this.spotMask[c] || (this.cellKind[c] ?? -1) >= 0) {
        maxX = Math.max(maxX, c % this.width)
        maxY = Math.max(maxY, Math.floor(c / this.width))
      }
    }
    this.lastExtent = WEIGHTS.extent * (maxX + 1) * (maxY + 1)
    return (
      this.missingWeight * missing +
      WEIGHTS.conflict * conflicts +
      WEIGHTS.unwanted * unwanted +
      this.cost +
      WEIGHTS.extent * (maxX + 1) * (maxY + 1)
    )
  }
}

interface Chosen {
  readonly kind: number
  readonly anchor: number
}

/**
 * Tailles des réseaux de départ : les emplacements voulus ; avec un stock limité, aussi des réseaux
 * de plus en plus petits (moitié, quart… jusqu'à 1), car le stock peut ne suffire qu'à quelques-uns.
 */
function latticeCounts(wanted: number, limitedStock: boolean): number[] {
  const counts = [wanted]
  if (limitedStock) for (let count = Math.ceil(wanted / 2); count >= 1 && count < (counts.at(-1) ?? 0); count = Math.ceil(count / 2)) {
    counts.push(count)
    if (count === 1) break
  }
  return counts
}

/**
 * Recuit simulé : poser, retirer, décaler ou changer un crop ; un changement qui augmente
 * l'énergie est gardé avec une probabilité qui baisse avec la température. Renvoie l'énergie finale.
 */
function anneal(
  search: Search,
  rand: () => number,
  kinds: readonly Kind[],
  width: number,
  height: number,
  iterations: number,
  hot: number,
): number {
  const cold = 0.3
  let energy = search.energy()
  /** Retire `id`, pose `kind` en `anchor` ; renvoie de quoi défaire, ou null si c'est impossible. */
  const replace = (id: number, kind: number, anchor: number): (() => void) | null => {
    search.remove(id)
    if (!search.canPlace(kind, anchor)) {
      search.restore(id)
      return null
    }
    const [added, ...removed] = search.place(kind, anchor)
    return () => {
      if (added !== undefined) search.remove(added)
      for (const other of removed) search.restore(other)
      search.restore(id)
    }
  }
  for (let step = 0; step < iterations; step += 1) {
    const temperature = hot * (cold / hot) ** (step / iterations)
    const roll = rand()
    let undo: (() => void) | null = null
    if (roll < 0.5 || search.size() === 0) {
      const kind = Math.floor(rand() * kinds.length)
      const cell = Math.floor(rand() * width * height)
      if (!search.canPlace(kind, cell)) continue
      const [added, ...removed] = search.place(kind, cell)
      if (added === undefined) continue
      undo = () => {
        search.remove(added)
        for (const id of removed) search.restore(id)
      }
    } else if (roll < 0.7) {
      const id = search.randomPlacement(rand)
      if (id < 0) continue
      search.remove(id)
      undo = () => search.restore(id)
    } else if (roll < 0.85) {
      // Décaler un crop d'une case (compacte le plan, ajuste un voisinage).
      const id = search.randomPlacement(rand)
      if (id < 0) continue
      const from = search.anchorOf(id)
      const direction = Math.floor(rand() * 4)
      const x = (from % width) + (direction === 0 ? 1 : direction === 1 ? -1 : 0)
      const y = Math.floor(from / width) + (direction === 2 ? 1 : direction === 3 ? -1 : 0)
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      undo = replace(id, search.kindOf(id), y * width + x)
    } else {
      // Changer la sorte d'un crop (même taille).
      const id = search.randomPlacement(rand)
      if (id < 0) continue
      const side = kinds[search.kindOf(id)]?.side
      const others = kinds.flatMap((kind, index) => (index !== search.kindOf(id) && kind.side === side ? [index] : []))
      const kind = others[Math.floor(rand() * others.length)]
      if (kind === undefined) continue
      undo = replace(id, kind, search.anchorOf(id))
    }
    if (!undo) continue
    const next = search.energy()
    if (next <= energy || rand() < Math.exp((energy - next) / temperature)) energy = next
    else undo()
  }
  return energy
}

/**
 * Polissage final : échanger deux crops de sortes différentes, ou déplacer un crop ailleurs, pour
 * un plan plus propre (TIDY) et plus compact, sans jamais perdre sur l'essentiel : tout pas qui
 * augmente l'énergie hors étendue (emplacements, conflits, nombre de crops) est refusé.
 */
function polish(search: Search, rand: () => number, kinds: readonly Kind[], width: number, height: number): void {
  const steps = POLISH_STEPS
  let core = search.energy()
  let soft = search.extentCost() + search.tidiness()
  core -= search.extentCost()
  for (let step = 0; step < steps; step += 1) {
    const temperature = 0.3 * (0.003 / 0.3) ** (step / steps)
    const a = search.randomPlacement(rand)
    if (a < 0) return
    const kindA = search.kindOf(a)
    const anchorA = search.anchorOf(a)
    let undo: () => void
    if (rand() < 0.6) {
      const b = search.randomPlacement(rand)
      const kindB = search.kindOf(b)
      if (b === a || kindB === kindA || kinds[kindA]?.side !== kinds[kindB]?.side) continue
      const anchorB = search.anchorOf(b)
      search.remove(a)
      search.remove(b)
      const [addedB] = search.place(kindB, anchorA)
      const [addedA] = search.place(kindA, anchorB)
      undo = () => {
        if (addedA !== undefined) search.remove(addedA)
        if (addedB !== undefined) search.remove(addedB)
        search.restore(a)
        search.restore(b)
      }
    } else {
      const cell = Math.floor(rand() * width * height)
      search.remove(a)
      if (!search.canPlace(kindA, cell)) {
        search.restore(a)
        continue
      }
      const [added, ...removed] = search.place(kindA, cell)
      undo = () => {
        if (added !== undefined) search.remove(added)
        for (const other of removed) search.restore(other)
        search.restore(a)
      }
    }
    const energy = search.energy()
    const nextCore = energy - search.extentCost()
    if (nextCore > core + 1e-9) {
      undo()
      continue
    }
    const nextSoft = search.extentCost() + search.tidiness()
    const delta = nextCore - core + (nextSoft - soft)
    if (delta <= 0 || rand() < Math.exp(-delta / temperature)) {
      core = nextCore
      soft = nextSoft
    } else undo()
  }
}

/**
 * Réseaux serrés d'emplacements d'une case (une case sur deux, dans un bloc (2c+1) x (2r+1) en
 * haut à gauche de la zone utilisable), les autres cases du bloc garnies d'ingrédients : d'abord
 * chaque case, en commençant par celles qui touchent le plus d'emplacements, reçoit l'ingrédient qui
 * manque au plus grand nombre de ses emplacements voisins ; puis une petite recherche ne fait que
 * changer l'ingrédient (ou le retirer) case par case pour remplir chaque emplacement au moindre coût.
 * Le recuit général part de là.
 */
function latticeSeeds(
  kinds: readonly Kind[],
  target: Mutation,
  wanted: number,
  width: number,
  height: number,
  usable: Uint8Array,
  rand: () => number,
  missingWeight: number,
): Chosen[][] {
  const need = kinds.map((kind) => target.conditions.find((c) => cropKey(c.crop) === cropKey(kind.crop))?.count ?? 0)
  const seeds: Chosen[][] = []
  // Le réseau voulu, ou le plus grand qui tient dans la zone utilisable.
  for (let count = wanted; count >= 1 && seeds.length === 0; count -= 1) {
    const shapes: { readonly columns: number; readonly rows: number }[] = []
    for (let columns = 1; columns <= count; columns += 1) {
      const rows = Math.ceil(count / columns)
      if (2 * columns + 1 <= width && 2 * rows + 1 <= height) shapes.push({ columns, rows })
    }
    shapes.sort((a, b) => (2 * a.columns + 1) * (2 * a.rows + 1) - (2 * b.columns + 1) * (2 * b.rows + 1) || b.columns - a.columns)
    for (const { columns, rows } of shapes.slice(0, 2)) {
      const seed = latticeSeed(columns, rows, count)
      if (seed) seeds.push(seed)
    }
  }
  return seeds

  /** Un réseau `columns` x `rows` de `count` emplacements, garni, ou null s'il ne tient nulle part. */
  function latticeSeed(columns: number, rows: number, count: number): Chosen[] | null {
    const blockWidth = 2 * columns + 1
    const blockHeight = 2 * rows + 1
    let origin: number | null = null
    for (let y = 0; origin === null && y + blockHeight <= height; y += 1) {
      for (let x = 0; origin === null && x + blockWidth <= width; x += 1) {
        let free = true
        for (let dy = 0; free && dy < blockHeight; dy += 1) for (let dx = 0; free && dx < blockWidth; dx += 1) free = usable[(y + dy) * width + x + dx] === 1
        if (free) origin = y * width + x
      }
    }
    if (origin === null) return null
    const ox = origin % width
    const oy = Math.floor(origin / width)
    const spots: number[] = []
    for (let j = 0; j < rows; j += 1) for (let i = 0; i < columns; i += 1) if (spots.length < count) spots.push((oy + 1 + 2 * j) * width + ox + 1 + 2 * i)
    const cells: number[] = []
    for (let dy = 0; dy < blockHeight; dy += 1) for (let dx = 0; dx < blockWidth; dx += 1) cells.push((oy + dy) * width + ox + dx)
    const assigned = fillAround(cells, spots, need, new Map(), kinds, rand, width, height, missingWeight)
    return [...assigned].map(([anchor, kind]) => ({ kind, anchor }))
  }
}

/**
 * Garnit les cases `cells` autour des emplacements d'une case `spots` avec les ingrédients d'une
 * case : d'abord chaque case, en commençant par celles qui touchent le plus d'emplacements, reçoit
 * l'ingrédient qui manque au plus grand nombre de ses emplacements voisins (à égalité, une mutation
 * plutôt qu'un crop de base : les mutations vont sur les cases les plus partagées), puis
 * refineAssignment corrige. `fixed` : cases déjà prises (gros ingrédient), pour la tenue.
 */
function fillAround(
  cells: readonly number[],
  spots: readonly number[],
  need: readonly number[],
  fixed: ReadonlyMap<number, number>,
  kinds: readonly Kind[],
  rand: () => number,
  width: number,
  height: number,
  missingWeight: number,
): Map<number, number> {
  const spotSet = new Set(spots)
  const remaining = spots.map(() => [...need])
  const neighbors = (cell: number) =>
    spots.flatMap((spot, index) => {
      const dx = Math.abs((spot % width) - (cell % width))
      const dy = Math.abs(Math.floor(spot / width) - Math.floor(cell / width))
      return dx <= 1 && dy <= 1 ? [index] : []
    })
  const order = cells
    .filter((cell) => !spotSet.has(cell) && !fixed.has(cell))
    .sort((a, b) => neighbors(b).length - neighbors(a).length || a - b)
  const assigned = new Map<number, number>()
  for (const cell of order) {
    const around = neighbors(cell)
    let bestKind = -1
    let bestScore = 0
    kinds.forEach((kind, index) => {
      if (kind.side !== 1) return
      const score = around.filter((spot) => (remaining[spot]?.[index] ?? 0) > 0).length * 2 + (kind.mutation ? 1 : 0)
      if (score > 1 && score > bestScore) {
        bestScore = score
        bestKind = index
      }
    })
    if (bestKind < 0) continue
    assigned.set(cell, bestKind)
    for (const spot of around) {
      const left = remaining[spot]
      if (left && (left[bestKind] ?? 0) > 0) left[bestKind] = (left[bestKind] ?? 0) - 1
    }
  }
  refineAssignment(order, neighbors, spots, need, kinds, assigned, rand, width, height, missingWeight, fixed)
  return assigned
}

/**
 * Moyeux : pour une cible d'une case dont un seul ingrédient fait plusieurs cases, et qui en demande
 * au plus autant de cases qu'il a de côté (All-in Aloe : 2 cases de PlantBoy Advance, Puffercloud :
 * 2 cases de Snoozling), ce gros ingrédient au centre et un emplacement contre chacun de ses côtés,
 * en moulinet, comme le plan AVRG d'All-in Aloe : un seul exemplaire sert quatre emplacements. Un
 * moyeu par groupe de quatre emplacements ; les autres cases de chaque moyeu sont garnies par
 * fillAround.
 */
function hubSeeds(
  kinds: readonly Kind[],
  target: Mutation,
  wanted: number,
  width: number,
  height: number,
  usable: Uint8Array,
  rand: () => number,
  missingWeight: number,
): Chosen[][] {
  const big = kinds.flatMap((kind, index) => (kind.side > 1 ? [index] : []))
  const hubKind = big[0]
  const side = hubKind === undefined ? 0 : (kinds[hubKind]?.side ?? 0)
  const need = kinds.map((kind) => target.conditions.find((c) => cropKey(c.crop) === cropKey(kind.crop))?.count ?? 0)
  if (target.side !== 1 || big.length !== 1 || hubKind === undefined || (need[hubKind] ?? 0) > side) return []
  // Chaque moyeu tient dans un carré : le gros ingrédient, ses emplacements et leurs voisins.
  const zone = side + 4
  const hubs = Math.ceil(wanted / 4)
  const perRow = Math.floor(width / zone)
  if (perRow === 0 || Math.ceil(hubs / perRow) * zone > height) return []
  const zoneRows = Math.ceil(hubs / perRow)
  const zoneColumns = Math.min(hubs, perRow)
  let origin: number | null = null
  for (let y = 0; origin === null && y + zoneRows * zone <= height; y += 1) {
    for (let x = 0; origin === null && x + zoneColumns * zone <= width; x += 1) {
      let free = true
      for (let dy = 0; free && dy < zoneRows * zone; dy += 1) for (let dx = 0; free && dx < zoneColumns * zone; dx += 1) free = usable[(y + dy) * width + x + dx] === 1
      if (free) origin = y * width + x
    }
  }
  if (origin === null) return []
  const ox = origin % width
  const oy = Math.floor(origin / width)
  const cells: number[] = []
  for (let dy = 0; dy < zoneRows * zone; dy += 1) for (let dx = 0; dx < zoneColumns * zone; dx += 1) cells.push((oy + dy) * width + ox + dx)
  const blocks: Chosen[] = []
  const fixed = new Map<number, number>()
  const spots: number[] = []
  for (let hub = 0; hub < hubs; hub += 1) {
    const bx = ox + (hub % perRow) * zone + 2
    const by = oy + Math.floor(hub / perRow) * zone + 2
    blocks.push({ kind: hubKind, anchor: by * width + bx })
    for (let dy = 0; dy < side; dy += 1) for (let dx = 0; dx < side; dx += 1) fixed.set((by + dy) * width + bx + dx, hubKind)
    // Un emplacement contre chaque côté, en moulinet : haut à droite, droite en bas, bas à gauche,
    // gauche en haut ; chacun touche `side` cases du gros ingrédient (2 au moins).
    const pinwheel = [
      (by - 1) * width + bx + side - 1,
      (by + side - 1) * width + bx + side,
      (by + side) * width + bx,
      by * width + bx - 1,
    ]
    spots.push(...pinwheel.slice(0, Math.min(4, wanted - 4 * hub)))
  }
  // Le gros ingrédient fournit sa part à chaque emplacement : il ne reste que les autres.
  const rest = need.map((count, index) => (index === hubKind ? 0 : count))
  const assigned = fillAround(cells, spots, rest, fixed, kinds, rand, width, height, missingWeight)
  return [[...blocks, ...[...assigned].map(([anchor, kind]) => ({ kind, anchor }))]]
}

/**
 * Répartition des ingrédients sur les cases d'un réseau, en deux temps.
 * 1. Coût : recuit où un pas change l'ingrédient d'une case (ou la vide), ou échange ceux de deux
 *    cases ; voisins manquants, puis mutations et crops de base posés (mêmes poids que la recherche
 *    générale). Le prix d'un voisin manquant part bas et monte jusqu'à `missingWeight` : la
 *    recherche explore d'abord librement les répartitions économes, puis revient à des emplacements
 *    complets. Plusieurs essais ; les stocks limités sont respectés.
 * 2. Tenue : échanges de cases (crop contre crop, ou crop contre case vide du bloc) qui ne
 *    retirent aucun voisin nécessaire ; le nombre de poses ne change pas, seule la tenue (TIDY)
 *    compte : sortes regroupées, plan symétrique.
 */
function refineAssignment(
  cells: readonly number[],
  neighbors: (cell: number) => number[],
  spotCells: readonly number[],
  need: readonly number[],
  kinds: readonly Kind[],
  assigned: Map<number, number>,
  rand: () => number,
  width: number,
  height: number,
  missingWeight: number,
  fixed: ReadonlyMap<number, number> = new Map(),
): void {
  const k = kinds.length
  const spotCount = spotCells.length
  const around = cells.map(neighbors)
  const options = [-1, ...kinds.flatMap((kind, index) => (kind.side === 1 ? [index] : []))]
  const cost = (kind: number) => (kind < 0 ? 0 : (kinds[kind]?.weight ?? 0))
  // Températures à l'échelle des ingrédients (un Chocoberry pèse 90, une Choconut 10).
  const scale = Math.max(1, ...kinds.map((kind) => kind.weight / WEIGHTS.mutation))
  const initial = cells.map((cell) => assigned.get(cell) ?? -1)
  // Effort proportionnel à la taille du réseau (21 cases pour 4 emplacements, 37 pour 8).
  const steps = 1_500 * cells.length
  const runs = 8

  /** Une répartition en cours : sorte par case, voisins par emplacement et sorte, poses par sorte. */
  const assignment = (start: readonly number[]) => {
    const choice = [...start]
    const counts = new Int32Array(spotCount * k)
    const used = new Int32Array(k)
    choice.forEach((kind, index) => {
      if (kind < 0) return
      used[kind] = (used[kind] ?? 0) + 1
      for (const spot of around[index] ?? []) counts[spot * k + kind] = (counts[spot * k + kind] ?? 0) + 1
    })
    /** Variation des voisins manquants (au prix `price`) si la case `index` passe de `from` à `to`. */
    const lack = (index: number, from: number, to: number, price: number) => {
      let delta = 0
      for (const spot of around[index] ?? []) {
        for (const [kind, step] of [
          [from, -1],
          [to, 1],
        ] as const) {
          if (kind < 0) continue
          const count = counts[spot * k + kind] ?? 0
          const needed = need[kind] ?? 0
          delta += price * (Math.max(0, needed - count - step) - Math.max(0, needed - count))
        }
      }
      return delta
    }
    const apply = (index: number, from: number, to: number) => {
      choice[index] = to
      if (from >= 0) used[from] = (used[from] ?? 0) - 1
      if (to >= 0) used[to] = (used[to] ?? 0) + 1
      for (const spot of around[index] ?? []) {
        if (from >= 0) counts[spot * k + from] = (counts[spot * k + from] ?? 0) - 1
        if (to >= 0) counts[spot * k + to] = (counts[spot * k + to] ?? 0) + 1
      }
    }
    const missing = () => {
      let sum = 0
      for (let spot = 0; spot < spotCount; spot += 1) {
        for (let kind = 0; kind < k; kind += 1) sum += Math.max(0, (need[kind] ?? 0) - (counts[spot * k + kind] ?? 0))
      }
      return sum
    }
    return { choice, used, lack, apply, missing }
  }
  const total = (start: readonly number[]) => {
    const state = assignment(start)
    return state.missing() * missingWeight + start.reduce((sum, kind) => sum + cost(kind), 0)
  }

  // 1. Coût.
  let best = initial
  let bestCost = total(initial)
  for (let run = 0; run < runs; run += 1) {
    const { choice, used, lack, apply } = assignment(initial)
    for (let step = 0; step < steps; step += 1) {
      const progress = step / steps
      const price = 2 * scale * (missingWeight / (2 * scale)) ** progress
      const temperature = 20 * scale * (0.1 / (20 * scale)) ** progress
      const a = Math.floor(rand() * cells.length)
      const from = choice[a] ?? -1
      if (rand() < 0.5) {
        const to = options[Math.floor(rand() * options.length)] ?? -1
        if (to === from || (to >= 0 && (used[to] ?? 0) >= (kinds[to]?.limit ?? Infinity))) continue
        const delta = cost(to) - cost(from) + lack(a, from, to, price)
        if (delta > 0 && rand() >= Math.exp(-delta / temperature)) continue
        apply(a, from, to)
      } else {
        // Échange de deux cases : les totaux par sorte ne changent pas.
        const b = Math.floor(rand() * cells.length)
        const other = choice[b] ?? -1
        if (a === b || other === from) continue
        let delta = lack(a, from, other, price)
        apply(a, from, other)
        delta += lack(b, other, from, price)
        if (delta > 0 && rand() >= Math.exp(-delta / temperature)) {
          apply(a, other, from)
          continue
        }
        apply(b, other, from)
      }
    }
    const runCost = total(choice)
    if (runCost < bestCost) {
      bestCost = runCost
      best = choice
    }
  }

  // 2. Tenue : échanges qui ne retirent aucun voisin nécessaire ; deux essais, le plus propre gagne.
  const seen = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  const tidySteps = 1_000 * cells.length
  let tidiest: { readonly score: number; readonly choice: readonly number[] } | null = null
  for (let run = 0; run < 2; run += 1) {
    const { choice, lack, apply } = assignment(best)
    const codes = new Int32Array(width * height).fill(EMPTY_CODE)
    for (const spot of spotCells) codes[spot] = SPOT_CODE
    for (const [cell, kind] of fixed) codes[cell] = kind
    choice.forEach((kind, index) => (codes[cells[index] ?? 0] = kind))
    let tidy = tidiness(codes, width, height, seen, queue)
    const swap = (a: number, b: number) => {
      const from = choice[a] ?? -1
      const other = choice[b] ?? -1
      apply(a, from, other)
      apply(b, other, from)
      codes[cells[a] ?? 0] = other
      codes[cells[b] ?? 0] = from
    }
    for (let step = 0; step < tidySteps; step += 1) {
      const temperature = 0.3 * (0.003 / 0.3) ** (step / tidySteps)
      const a = Math.floor(rand() * cells.length)
      const b = Math.floor(rand() * cells.length)
      const from = choice[a] ?? -1
      const other = choice[b] ?? -1
      if (a === b || from === other) continue
      let lost = lack(a, from, other, 1)
      apply(a, from, other)
      lost += lack(b, other, from, 1)
      apply(a, other, from)
      if (lost > 0) continue
      swap(a, b)
      const next = tidiness(codes, width, height, seen, queue)
      if (next <= tidy || rand() < Math.exp((tidy - next) / temperature)) tidy = next
      else swap(a, b)
    }
    if (!tidiest || tidy < tidiest.score) tidiest = { score: tidy, choice: [...choice] }
  }
  const choice = tidiest?.choice ?? best

  assigned.clear()
  choice.forEach((kind, index) => {
    const cell = cells[index]
    if (kind >= 0 && cell !== undefined) assigned.set(cell, kind)
  })
}

export function autofill(data: GameData, request: AutofillRequest): AutofillOutcome {
  const target = data.mutationsById.get(request.targetId)
  if (!target || target.spawnRule !== 'conditions' || target.conditions.length === 0) {
    return {
      ok: false,
      reason: tr(
        'Cette mutation n’apparaît pas par des conditions de voisinage : rien à remplir.',
        'This mutation does not appear through neighbor conditions: nothing to fill.',
      ),
    }
  }
  const { width, height } = request
  const usable = Uint8Array.from(request.ground, (ground) => (isUsableGround(ground) ? 1 : 0))
  const kinds: Kind[] = target.conditions.map((condition) => ({
    crop: condition.crop,
    side: cropSide(data, condition.crop),
    mutation: condition.crop.kind === 'mutation',
    weight: condition.crop.kind === 'mutation' ? WEIGHTS.mutation * mutationCost(data, condition.crop.id) : WEIGHTS.base,
    limit: condition.crop.kind === 'mutation' ? (request.stock?.get(condition.crop.id) ?? Infinity) : Infinity,
  }))
  const keys = new Set(kinds.map((kind) => cropKey(kind.crop)))
  // Concurrentes : les mutations qui pourraient apparaître avec les seuls ingrédients posés.
  const rivals = data.mutations.filter(
    (m) =>
      m.id !== target.id &&
      m.spawnRule === 'conditions' &&
      m.conditions.length > 0 &&
      m.conditions.every((condition) => keys.has(cropKey(condition.crop))),
  )
  const wanted = Math.max(1, Math.floor(request.spots))
  const missingWeight = Math.max(WEIGHTS.missing, MISSING_OVER_COST * Math.max(...kinds.map((kind) => kind.weight)))
  const iterations = request.iterations ?? DEFAULT_ITERATIONS
  const restarts = request.restarts ?? DEFAULT_RESTARTS

  const fresh = () =>
    new Search(
      kinds,
      [target, ...rivals].map((m) => track(m, kinds, width, height, usable)),
      width,
      height,
      usable,
      request.ground,
      wanted,
      missingWeight,
    )
  // Départs : la grille vide (au hasard), et pour une cible d'une case, des réseaux serrés
  // d'emplacements (une case sur deux) déjà garnis, comme les plans du guide AVRG.
  const starts: { readonly seed: readonly Chosen[]; readonly hot: number }[] = [
    ...Array.from({ length: restarts }, () => ({ seed: [], hot: missingWeight * 2 })),
    ...latticeCounts(wanted, Boolean(request.stock))
      .flatMap((count) =>
        target.side === 1
          ? [
              ...latticeSeeds(kinds, target, count, width, height, usable, random((request.seed ?? 1) * 31 + count), missingWeight),
              ...hubSeeds(kinds, target, count, width, height, usable, random((request.seed ?? 1) * 37 + count), missingWeight),
            ]
          : [],
      )
      .flatMap((seed) => [
        { seed, hot: 0 },
        { seed, hot: 3 * Math.min(...kinds.map((kind) => kind.weight)) },
      ]),
  ]
  let best: { complete: number; energy: number; placements: Chosen[] } | null = null
  for (const [attempt, start] of starts.entries()) {
    const rand = random((request.seed ?? 1) * 7919 + attempt * 104_729)
    const search = fresh()
    for (const { kind, anchor } of start.seed) if (search.canPlace(kind, anchor)) search.place(kind, anchor)
    if (start.hot > 0) anneal(search, rand, kinds, width, height, iterations, start.hot)
    // Nettoyage sur les emplacements obtenus : un crop qui n'aide qu'un emplacement impossible
    // (petite zone) ne sert à rien.
    const complete = search.completeSpots()
    search.setWanted(Math.min(wanted, complete))
    let energy = search.energy()
    for (const id of search.livePlacements()) {
      search.remove(id)
      const next = search.energy()
      if (next <= energy) energy = next
      else search.restore(id)
    }
    // À coût égal, le plan le plus propre (sortes regroupées, symétrie).
    const score = search.energy() + search.tidiness()
    if (!best || complete > best.complete || (complete === best.complete && score < best.energy)) {
      const placements = search.livePlacements().map((id) => ({ kind: search.kindOf(id), anchor: search.anchorOf(id) }))
      best = { complete, energy: score, placements }
    }
  }
  if (best) {
    const final = fresh()
    for (const { kind, anchor } of best.placements) if (final.canPlace(kind, anchor)) final.place(kind, anchor)
    final.setWanted(Math.min(wanted, best.complete))
    polish(final, random((request.seed ?? 1) * 13), kinds, width, height)
    best = { ...best, placements: final.livePlacements().map((id) => ({ kind: final.kindOf(id), anchor: final.anchorOf(id) })) }
  }

  const result = finalize(data, target, kinds, request, best?.placements ?? [])
  if (result.spots === 0) return { ok: false, reason: noSpotReason(data, target, request.stock ?? null) }
  return { ok: true, result }
}

/**
 * Pourquoi aucun emplacement : le stock ne couvre même pas un emplacement (mutations nécessaires
 * pour ses conditions, une mutation multi-cases fournissant plusieurs cases), sinon la place.
 */
function noSpotReason(data: GameData, target: Mutation, stock: ReadonlyMap<string, number> | null): string {
  const short = stock
    ? target.conditions.flatMap((condition) => {
        if (condition.crop.kind !== 'mutation') return []
        const ingredient = data.mutationsById.get(condition.crop.id)
        const needed = mutationsForCells(condition.count, ingredient?.side ?? 1)
        // Absente du stock : sans limite, comme pour la recherche.
        const owned = stock.get(condition.crop.id)
        return owned !== undefined && owned < needed
          ? [tr(`${needed} ${ingredient?.name ?? condition.crop.id} (tu en as ${owned})`, `${needed} ${ingredient?.name ?? condition.crop.id} (you have ${owned})`)]
          : []
      })
    : []
  if (short.length > 0) {
    return tr(
      `Pas assez de stock pour un emplacement de ${target.name} : il faut au moins ${short.join(', ')}.`,
      `Not enough stock for a ${target.name} spot: you need at least ${short.join(', ')}.`,
    )
  }
  return tr(
    `Pas assez de place pour un emplacement de ${target.name} sur les cases libres de ce plan.`,
    `Not enough room for a ${target.name} spot on the free cells of this plan.`,
  )
}

/** Plan final : sols peints, puis vérification par la logique de la grille. */
function finalize(
  data: GameData,
  target: Mutation,
  kinds: readonly Kind[],
  request: AutofillRequest,
  chosen: readonly { readonly kind: number; readonly anchor: number }[],
): AutofillResult {
  const { width, height } = request
  const ground = [...request.ground]
  const placements: Placement[] = []
  for (const { kind, anchor } of chosen) {
    const info = kinds[kind]
    if (!info) continue
    const x = anchor % width
    const y = Math.floor(anchor / width)
    placements.push({ crop: info.crop, x, y })
    const surface = info.crop.kind === 'mutation' ? data.mutationsById.get(info.crop.id)?.surface : undefined
    if (!surface) continue
    for (let dy = 0; dy < info.side; dy += 1) for (let dx = 0; dx < info.side; dx += 1) ground[(y + dy) * width + x + dx] = surface
  }
  // Emplacements : les empreintes où la cible peut apparaître une fois leur sol mis à celui de la cible.
  const painted: GridInput = { width, height, placements, ground: ground.map((g) => (isUsableGround(g) ? target.surface : g)) }
  const occupied = new Set<number>()
  const analysisForSpots = analyzeGrid(data, painted)
  for (const option of analysisForSpots.options) {
    if (option.mutationId !== target.id) continue
    const cells: number[] = []
    for (let dy = 0; dy < option.side; dy += 1) for (let dx = 0; dx < option.side; dx += 1) cells.push((option.y + dy) * width + option.x + dx)
    if (cells.some((c) => occupied.has(c))) continue
    for (const c of cells) {
      occupied.add(c)
      ground[c] = target.surface
    }
  }
  const grid: GridInput = { width, height, placements, ground }
  const analysis = analyzeGrid(data, grid)
  const taken = new Set<number>()
  let spots = 0
  let conflicts = 0
  for (const option of analysis.options) {
    if (option.mutationId !== target.id) continue
    const cells: number[] = []
    for (let dy = 0; dy < option.side; dy += 1) for (let dx = 0; dx < option.side; dx += 1) cells.push((option.y + dy) * width + option.x + dx)
    if (cells.some((c) => taken.has(c))) continue
    for (const c of cells) taken.add(c)
    spots += 1
    if (cells.some((c) => analysis.cells[c]?.conflict)) conflicts += cells.filter((c) => analysis.cells[c]?.conflict).length
  }
  const mutations = new Map<string, number>()
  const baseCrops = new Map<string, number>()
  for (const placement of placements) {
    const { crop } = placement
    if (crop.kind === 'mutation') mutations.set(crop.id, (mutations.get(crop.id) ?? 0) + 1)
    else baseCrops.set(crop.name, (baseCrops.get(crop.name) ?? 0) + 1)
  }
  return { placements, ground, spots, conflicts, mutations, baseCrops }
}
