/**
 * Lecture des plans de ferme (section `layouts` du JSON) : légende + rangées → sol, crops
 * posés et emplacements de spawn attendus. Utilisé au chargement des données et par les tests.
 *
 * Caractères réservés dans les rangées :
 *   .  case vide (surface par défaut du plan)
 *   #  case couverte par une mutation multi-cases listée dans `placements`
 *   x  bloc cassé
 */
import { BROKEN_GROUND } from '../logic/ground'
import type { CropRef, LayoutPreset, LayoutSpot, Placement } from '../types/game'
import type { RawLayout } from './schema'

const EMPTY = '.'
const COVERED = '#'
const BROKEN = 'x'
const RESERVED = new Set([EMPTY, COVERED, BROKEN])

export interface LayoutContext {
  readonly surfaces: ReadonlySet<string>
  readonly defaultSurface: string
  readonly maxWidth: number
  readonly maxHeight: number
  /** Nom de crop → référence (mutation par id, crop de base par nom), ou null s'il est inconnu. */
  readonly resolveCrop: (name: string) => CropRef | null
  /** Côté de l'empreinte d'un crop (1 pour un crop de base). */
  readonly sideOf: (crop: CropRef) => number
}

export interface LayoutIssue {
  readonly path: readonly PropertyKey[]
  readonly message: string
}

type LegendCell =
  | { readonly kind: 'crop'; readonly crop: CropRef; readonly surface: string }
  | { readonly kind: 'spot'; readonly surface: string; readonly expect: readonly string[] }
  | { readonly kind: 'empty'; readonly surface: string }

export function parseLayout(
  raw: RawLayout,
  index: number,
  ctx: LayoutContext,
): { preset: LayoutPreset | null; issues: LayoutIssue[] } {
  const issues: LayoutIssue[] = []
  const at = (...rest: PropertyKey[]): PropertyKey[] => ['layouts', index, ...rest]
  const issue = (path: PropertyKey[], message: string) => issues.push({ path, message })

  const height = raw.rows.length
  const width = raw.rows[0]?.length ?? 0
  raw.rows.forEach((row, r) => {
    if (row.length !== width) issue(at('rows', r), `rangée de ${row.length} cases, ${width} attendues`)
  })
  if (width > ctx.maxWidth || height > ctx.maxHeight) {
    issue(at('rows'), `plan de ${width} x ${height}, plus grand qu'un greenhouse (${ctx.maxWidth} x ${ctx.maxHeight})`)
  }
  const defaultSurface = raw.defaultSurface ?? ctx.defaultSurface
  if (!ctx.surfaces.has(defaultSurface)) issue(at('defaultSurface'), `surface inconnue : « ${defaultSurface} »`)

  const checkSurface = (surface: string, path: PropertyKey[]) => {
    if (!ctx.surfaces.has(surface)) issue(path, `surface inconnue : « ${surface} »`)
  }

  // --- Légende ---
  const legend = new Map<string, LegendCell>()
  for (const [char, entry] of Object.entries(raw.legend)) {
    const path = at('legend', char)
    if (RESERVED.has(char)) {
      issue(path, `caractère réservé : « ${char} » (. # et x ont un sens fixe)`)
      continue
    }
    if (typeof entry === 'string' || 'crop' in entry) {
      const name = typeof entry === 'string' ? entry : entry.crop
      const surface = typeof entry === 'string' ? defaultSurface : (entry.surface ?? defaultSurface)
      checkSurface(surface, path)
      const crop = ctx.resolveCrop(name)
      if (!crop) issue(path, `crop inconnu : « ${name} »`)
      else if (ctx.sideOf(crop) > 1) issue(path, `« ${name} » occupe plusieurs cases : la lister dans placements`)
      else legend.set(char, { kind: 'crop', crop, surface })
    } else if ('spot' in entry) {
      checkSurface(entry.spot, path)
      const expect: string[] = []
      for (const name of entry.expect) {
        const crop = ctx.resolveCrop(name)
        if (crop?.kind === 'mutation') expect.push(crop.id)
        else issue(path, `mutation attendue inconnue : « ${name} »`)
      }
      legend.set(char, { kind: 'spot', surface: entry.spot, expect })
    } else {
      checkSurface(entry.surface, path)
      legend.set(char, { kind: 'empty', surface: entry.surface })
    }
  }

  // --- Mutations multi-cases (ancre en haut à gauche) ---
  const ground: string[] = new Array<string>(width * height).fill(defaultSurface)
  const placements: Placement[] = []
  const spots: LayoutSpot[] = []
  const covered = new Set<number>()
  ;(raw.placements ?? []).forEach((placement, pi) => {
    const path = at('placements', pi)
    const crop = ctx.resolveCrop(placement.crop)
    if (!crop) {
      issue(path, `crop inconnu : « ${placement.crop} »`)
      return
    }
    const side = ctx.sideOf(crop)
    if (placement.x + side > width || placement.y + side > height) {
      issue(path, `« ${placement.crop} » dépasse du plan`)
      return
    }
    for (let dy = 0; dy < side; dy += 1) {
      for (let dx = 0; dx < side; dx += 1) {
        const cell = (placement.y + dy) * width + placement.x + dx
        if (covered.has(cell)) issue(path, `« ${placement.crop} » chevauche une autre mutation`)
        covered.add(cell)
      }
    }
    placements.push({ crop, x: placement.x, y: placement.y })
  })

  // --- Rangées ---
  raw.rows.forEach((row, y) => {
    ;[...row].forEach((char, x) => {
      const cell = y * width + x
      const path = at('rows', y)
      if (char === COVERED) {
        if (!covered.has(cell)) issue(path, `colonne ${x} : « # » sans mutation multi-cases dans placements`)
        return
      }
      if (covered.has(cell)) {
        issue(path, `colonne ${x} : case couverte par une mutation de placements, « # » attendu`)
        return
      }
      if (char === EMPTY) return
      if (char === BROKEN) {
        ground[cell] = BROKEN_GROUND
        return
      }
      const entry = legend.get(char)
      if (!entry) {
        if (!(char in raw.legend)) issue(path, `colonne ${x} : caractère « ${char} » absent de la légende`)
        return
      }
      ground[cell] = entry.surface
      if (entry.kind === 'crop') placements.push({ crop: entry.crop, x, y })
      else if (entry.kind === 'spot') spots.push({ x, y, expect: entry.expect })
    })
  })

  if (issues.length > 0) return { preset: null, issues }
  return {
    preset: {
      id: raw.id,
      name: raw.name,
      source: raw.source ?? null,
      notes: raw.notes ?? null,
      width,
      height,
      ground,
      placements,
      spots,
    },
    issues,
  }
}
