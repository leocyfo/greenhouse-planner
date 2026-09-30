/**
 * Sauvegarde : version du schéma, migrations, nettoyage d'une sauvegarde abîmée et format du
 * fichier d'export. Une sauvegarde n'est jamais rejetée en bloc : chaque champ invalide
 * reprend sa valeur par défaut, le reste est conservé.
 */
import { z } from 'zod'
import { normalizeLonelilyCells, normalizeSpots, normalizeTargetQuantity } from './calculator'
import { normalizeCount } from './progress'
import type {
  CalculatorState,
  GreenhouseState,
  GridLayoutState,
  GridState,
  PersistedState,
  ToolsState,
} from './state'

export const STORAGE_KEY = 'greenhouse-planner'

/** Pseudo Minecraft : lettres, chiffres et _, 16 caractères au plus (vide : aucun joueur). */
export const PLAYER_NAME = /^[A-Za-z0-9_]{0,16}$/

/** À incrémenter à chaque changement de forme de PersistedState, avec une migration. */
export const SCHEMA_VERSION = 9

/**
 * Migrations successives : MIGRATIONS[n] transforme un état de version n en version n + 1.
 * Le nettoyage (sanitizePersistedState) passe ensuite et complète les champs absents.
 */
const MIGRATIONS: Readonly<Record<number, (state: unknown) => unknown>> = {
  // v2 ajoute `calculator` : absent d'une sauvegarde v1, il reçoit ses valeurs par défaut
  // au nettoyage. La progression et les réglages ne changent pas.
  1: (state) => state,
  // v3 ajoute `grids` (un plan vide par greenhouse), de la même façon.
  2: (state) => state,
  // v4 ajoute `tools` (suivi des Ethereal Vines), de la même façon.
  3: (state) => state,
  // v5 ajoute `settings.analyzedBuyable` (option du bazar), désactivée par défaut.
  4: (state) => state,
  // v6 ajoute `tools.upgradeTiers` (tier Plant Yield), vide par défaut.
  5: (state) => state,
  // v7 ne garde que `settings.growth.upgrades` : crops uniques et Crop Growth, qui ne se règlent
  // plus, sont comptés au maximum. Le nettoyage ignore les anciennes valeurs.
  6: (state) => state,
  // v8 : Farmland et Dirt sont le même sol, seul Dirt reste dans les données. Les cases Farmland
  // des grilles deviennent Dirt (sinon plus rien n'y spawnerait).
  7: (state) => renameGround(state, 'Farmland', 'Dirt'),
  // v9 ajoute `settings.player` (import depuis Hypixel) : pseudo vide, invitation à afficher.
  8: (state) => state,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Renomme un sol dans toutes les grilles sauvegardées ; le reste de l'état est gardé tel quel. */
function renameGround(state: unknown, from: string, to: string): unknown {
  if (!isRecord(state) || !isRecord(state.grids) || !Array.isArray(state.grids.greenhouses)) return state
  const renameLayout = (layout: unknown) =>
    isRecord(layout) && Array.isArray(layout.ground)
      ? { ...layout, ground: layout.ground.map((ground: unknown) => (ground === from ? to : ground)) }
      : layout
  return {
    ...state,
    grids: {
      ...state.grids,
      greenhouses: state.grids.greenhouses.map((greenhouse: unknown) =>
        isRecord(greenhouse) && Array.isArray(greenhouse.layouts)
          ? { ...greenhouse, layouts: greenhouse.layouts.map(renameLayout) }
          : greenhouse,
      ),
    },
  }
}

/** Compteur de vines : entier positif, plafonné (l'interface limite aux maximums des données). */
function vineCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(10_000, Math.max(0, Math.floor(value))) : fallback
}

/** Tiers d'upgrades : entiers de 0 à 99 ; les zéros ne sont pas gardés. */
function upgradeTiers(raw: Record<string, unknown>): Record<string, number> {
  const tiers: Record<string, number> = {}
  for (const [id, value] of Object.entries(raw)) {
    const tier = typeof value === 'number' && Number.isFinite(value) ? Math.min(99, Math.max(0, Math.floor(value))) : 0
    if (tier > 0) tiers[id] = tier
  }
  return tiers
}

function sanitizeTools(raw: unknown, defaults: ToolsState): ToolsState {
  const parsed = z.object({ vines: z.unknown(), upgradeTiers: z.unknown() }).partial().safeParse(raw).data
  const vines = z.object({ first: z.unknown(), second: z.unknown(), third: z.unknown() }).safeParse(parsed?.vines)
  const tiers = z.record(z.string(), z.unknown()).safeParse(parsed?.upgradeTiers)
  return {
    vines: vines.success
      ? {
          first: vineCount(vines.data.first, defaults.vines.first),
          second: vineCount(vines.data.second, defaults.vines.second),
          third: vineCount(vines.data.third, defaults.vines.third),
        }
      : defaults.vines,
    upgradeTiers: tiers.success ? upgradeTiers(tiers.data) : defaults.upgradeTiers,
  }
}

const cropRefSchema = z.union([
  z.object({ kind: z.literal('mutation'), id: z.string().min(1) }),
  z.object({ kind: z.literal('base'), name: z.string().min(1) }),
])
const placementSchema = z.object({ crop: cropRefSchema, x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })

/** Plan valide ou null ; un sol de mauvaise taille reprend celui du plan par défaut. */
function sanitizeLayout(raw: unknown, fallback: GridLayoutState): GridLayoutState | null {
  const parsed = z
    .object({
      id: z.string().min(1),
      name: z.string(),
      ground: z.array(z.string()).catch([]),
      placements: z.array(z.unknown()).catch([]),
    })
    .safeParse(raw)
  if (!parsed.success) return null
  const { id, name, ground, placements } = parsed.data
  return {
    id,
    name: name.trim() || 'Plan',
    ground: ground.length === fallback.ground.length ? ground : [...fallback.ground],
    placements: placements.flatMap((p) => {
      const placement = placementSchema.safeParse(p)
      return placement.success ? [placement.data] : []
    }),
  }
}

function sanitizeGreenhouse(raw: unknown, fallback: GreenhouseState): GreenhouseState {
  const parsed = z.object({ layouts: z.array(z.unknown()), activeLayoutId: z.string() }).safeParse(raw)
  const defaultLayout = fallback.layouts[0]
  if (!parsed.success || !defaultLayout) return fallback
  const seen = new Set<string>()
  const layouts = parsed.data.layouts.flatMap((layout) => {
    const clean = sanitizeLayout(layout, defaultLayout)
    if (!clean || seen.has(clean.id)) return []
    seen.add(clean.id)
    return [clean]
  })
  const first = layouts[0]
  if (!first) return fallback
  return {
    layouts,
    activeLayoutId: seen.has(parsed.data.activeLayoutId) ? parsed.data.activeLayoutId : first.id,
  }
}

function sanitizeGrids(raw: unknown, defaults: GridState): GridState {
  const parsed = z
    .object({ greenhouses: z.array(z.unknown()).catch([]), activeGreenhouse: z.number().int().catch(0) })
    .catch({ greenhouses: [], activeGreenhouse: 0 })
    .parse(raw)
  const greenhouses = defaults.greenhouses.map((fallback, index) => sanitizeGreenhouse(parsed.greenhouses[index], fallback))
  return {
    greenhouses,
    activeGreenhouse: Math.min(Math.max(parsed.activeGreenhouse, 0), Math.max(greenhouses.length - 1, 0)),
  }
}

/**
 * Amène un état sauvegardé à la version courante. Renvoie null si une migration manque
 * (version trop ancienne ou inconnue) : on repartira des valeurs par défaut.
 * Un état d'une version plus récente est gardé tel quel, puis nettoyé au mieux.
 */
export function migratePersistedState(state: unknown, fromVersion: number): unknown {
  let current = state
  for (let version = fromVersion; version < SCHEMA_VERSION; version += 1) {
    const migrate = MIGRATIONS[version]
    if (!migrate) return null
    current = migrate(current)
  }
  return current
}

function uniqueSortedStrings(values: readonly unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string'))].sort()
}

/** Cibles valides du calculateur : { mutationId, quantity }, sans doublon, dans l'ordre. */
function sanitizeTargets(values: readonly unknown[]): CalculatorState['targets'] {
  const seen = new Set<string>()
  const targets: { mutationId: string; quantity: number }[] = []
  for (const value of values) {
    const parsed = z.object({ mutationId: z.string(), quantity: z.number() }).safeParse(value)
    if (!parsed.success || seen.has(parsed.data.mutationId)) continue
    seen.add(parsed.data.mutationId)
    targets.push({ mutationId: parsed.data.mutationId, quantity: normalizeTargetQuantity(parsed.data.quantity) })
  }
  return targets
}

function sanitizeCalculator(raw: unknown, defaults: CalculatorState): CalculatorState {
  const parsed = z
    .object({
      targets: z.array(z.unknown()).catch([]),
      goalIds: z.array(z.unknown()).catch([]),
      mode: z.enum(['minimum', 'optimum']).catch(defaults.mode),
      ignoreInventory: z.boolean().catch(defaults.ignoreInventory),
      spots: z.number().catch(defaults.spots),
      lonelilyCells: z.number().catch(defaults.lonelilyCells),
    })
    .catch(() => ({ ...defaults, targets: [], goalIds: [] }))
    .parse(raw)
  return {
    targets: sanitizeTargets(parsed.targets),
    goalIds: [...new Set(parsed.goalIds.filter((id): id is string => typeof id === 'string'))],
    mode: parsed.mode,
    ignoreInventory: parsed.ignoreInventory,
    spots: normalizeSpots(parsed.spots),
    lonelilyCells: normalizeLonelilyCells(parsed.lonelilyCells),
  }
}

/** Nettoie un état venu du localStorage ou d'un fichier : chaque champ invalide reprend son défaut. */
export function sanitizePersistedState(raw: unknown, defaults: PersistedState): PersistedState {
  const { progress: defaultProgress, settings: defaultSettings } = defaults
  const field = (key: string): unknown =>
    typeof raw === 'object' && raw !== null && key in raw ? (raw as Record<string, unknown>)[key] : undefined
  const calculator = sanitizeCalculator(field('calculator'), defaults.calculator)
  const grids = sanitizeGrids(field('grids'), defaults.grids)
  const tools = sanitizeTools(field('tools'), defaults.tools)
  const schema = z
    .object({
      progress: z
        .object({
          inventory: z.record(z.string(), z.unknown()).catch({}),
          analyzed: z.array(z.unknown()).catch([]),
          activeGoals: z.array(z.unknown()).catch(() => [...defaultProgress.activeGoals]),
        })
        .catch(() => ({ inventory: {}, analyzed: [], activeGoals: [...defaultProgress.activeGoals] })),
      settings: z
        .object({
          planMode: z.enum(['minimum', 'optimum']).catch(defaultSettings.planMode),
          // z.object laisse de côté les clés inconnues (uniqueCrops, cropGrowth des anciennes sauvegardes).
          growth: z
            .object({ upgrades: z.number().catch(defaultSettings.growth.upgrades) })
            .catch(() => ({ ...defaultSettings.growth })),
          analyzedBuyable: z.boolean().catch(defaultSettings.analyzedBuyable),
          player: z
            .object({
              name: z.string().regex(PLAYER_NAME).catch(''),
              profileId: z.string().min(1).nullable().catch(null),
              promptDismissed: z.boolean().catch(false),
            })
            .catch(() => ({ ...defaultSettings.player })),
        })
        .catch(() => ({ ...defaultSettings, growth: { ...defaultSettings.growth }, player: { ...defaultSettings.player } })),
    })
    .catch(() => ({
      progress: { inventory: {}, analyzed: [], activeGoals: [...defaultProgress.activeGoals] },
      settings: { ...defaultSettings, growth: { ...defaultSettings.growth }, player: { ...defaultSettings.player } },
    }))

  const parsed = schema.parse(raw)
  const inventory: Record<string, number> = {}
  for (const [id, value] of Object.entries(parsed.progress.inventory)) {
    const count = typeof value === 'number' ? normalizeCount(value) : 0
    if (count > 0) inventory[id] = count
  }
  return {
    progress: {
      inventory,
      analyzed: uniqueSortedStrings(parsed.progress.analyzed),
      activeGoals: uniqueSortedStrings(parsed.progress.activeGoals),
    },
    settings: parsed.settings,
    calculator,
    grids,
    tools,
  }
}

// ---------------------------------------------------------------------------
// Fichier d'export / import de la progression
// ---------------------------------------------------------------------------

const APP_ID = 'greenhouse-planner'

export interface ProgressFile {
  readonly app: typeof APP_ID
  readonly schemaVersion: number
  readonly exportedAt: string
  readonly state: PersistedState
}

/** Nom du fichier d'export, daté : greenhouse-planner-2026-09-29.json. */
export function exportFileName(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${APP_ID}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

export function serializeProgressFile(state: PersistedState, now: Date = new Date()): string {
  const file: ProgressFile = { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), state }
  return JSON.stringify(file, null, 2)
}

export type ImportResult =
  | { readonly ok: true; readonly state: PersistedState }
  | { readonly ok: false; readonly error: string }

export function parseProgressFile(text: string, defaults: PersistedState): ImportResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: "Le fichier n'est pas du JSON valide." }
  }
  const envelope = z
    .object({ app: z.literal(APP_ID), schemaVersion: z.number().int().positive(), state: z.unknown() })
    .safeParse(json)
  if (!envelope.success) {
    return { ok: false, error: "Ce fichier n'est pas une sauvegarde de Greenhouse Planner." }
  }
  if (envelope.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: "Cette sauvegarde vient d'une version plus récente de l'application." }
  }
  const migrated = migratePersistedState(envelope.data.state, envelope.data.schemaVersion)
  if (migrated === null) return { ok: false, error: 'Cette version de sauvegarde ne peut pas être relue.' }
  return { ok: true, state: sanitizePersistedState(migrated, defaults) }
}
