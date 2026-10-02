/**
 * Schéma de mutations.json (structure uniquement).
 * Les vérifications croisées (noms référencés, cycles, taille des anneaux…) sont dans load.ts.
 *
 * Les objets sont stricts : une clé inconnue (souvent une faute de frappe) est signalée.
 * Pour ajouter un champ au JSON, il faut donc aussi l'ajouter ici.
 */
import { z } from 'zod'

// Messages d'erreur en français, affichés tels quels sur l'écran d'erreur des données.
z.config(z.locales.fr())

const nonNegativeInt = z.number().int().nonnegative()
const positiveInt = z.number().int().positive()

export const SIZES = ['1x1', '2x2', '3x3'] as const
export const EFFECT_STATS = ['yield', 'xp', 'water', 'immunity', 'spread', 'bonusDrops'] as const
/** Comment une mutation spawn sur la grille (voir fieldDocs.spawnRule dans le JSON). */
export const SPAWN_RULES = ['conditions', 'noAdjacentCrops', 'requiredEffectsAround', 'manual'] as const

/** Champs d'une mutation qui acceptent un drapeau `<champ>Verified`. */
export const VERIFIABLE_MUTATION_FIELDS = [
  'name',
  'rarity',
  'size',
  'surface',
  'growthStages',
  'conditions',
  'drops',
  'effects',
] as const

const conflictSchema = z.strictObject({
  field: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  source: z.string().min(1),
})

const effectSchema = z.strictObject({
  type: z.enum(['positive', 'negative']),
  value: z.string().min(1),
  stat: z.enum(EFFECT_STATS),
  amount: z.number().optional(),
})

const rangeSchema = z.strictObject({ min: z.number(), max: z.number() })

/** Ce que change un upgrade du Greenhouse (voir fieldDocs["mechanics.greenhouseUpgrades"]). */
export const UPGRADE_EFFECTS = ['growthSpeed', 'plantYield', 'plotLimit'] as const

const upgradeSchema = z.strictObject({
  id: z.string().regex(/^[a-z_]+$/, 'id attendu en minuscules et _'),
  name: z.string().min(1),
  menu: z.string().min(1),
  effect: z.enum(UPGRADE_EFFECTS),
  /** Objet Minecraft affiché dans le menu ; son image vient du wiki (src/data/wikiImages.json). */
  icon: z.string().min(1),
  description: z.string().min(1),
  unit: z.enum(['percent', 'plot']),
  tiers: z.array(z.number().positive().nullable()).min(1),
  tiersVerified: z.boolean().optional(),
  notes: z.string().optional(),
})

const tipSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  source: z.string().optional(),
})

const mechanicsSchema = z.strictObject({
  greenhouse: z.strictObject({ width: positiveInt, height: positiveInt, count: positiveInt }),
  growthStage: z.strictObject({
    baseline: z.string(),
    bonuses: z.array(z.string()),
    maxedDuration: z.string(),
    formulaGuess: z.string(),
    formula: z.strictObject({
      baseHours: z.number().positive(),
      upgradesMax: z.number().nonnegative(),
      uniqueCropsMax: nonNegativeInt,
      bonusPerUniqueCrop: z.number().nonnegative(),
      cropGrowthMax: z.number().nonnegative(),
      cropGrowthDivisor: z.number().positive(),
    }),
    verified: z.boolean(),
    avrgMeasurements: z.string(),
    tick: z.string(),
  }),
  water: z.strictObject({
    lossPerStage: z.string(),
    lossPerStageRange: rangeSchema,
    range: z.string(),
    levelRange: rangeSchema,
    rule: z.string(),
    modifiers: z.string(),
    modelVerified: z.boolean(),
  }),
  decay: z.string(),
  decayDays: z.number().positive(),
  decayAvrg: z.string(),
  lockIn: z.string(),
  harvestBounty: z.strictObject({
    description: z.string(),
    possibleDrops: z.array(z.string()),
  }),
  etherealVines: z.strictObject({
    description: z.string(),
    maxFirstGreenhouse: nonNegativeInt,
    unlockSecond: nonNegativeInt,
    unlockThird: nonNegativeInt,
    total: nonNegativeInt,
    firstGreenhouseInitialSpots: nonNegativeInt,
    avrgNotes: z.string(),
  }),
  lonelilySpawnRate: z.string(),
  lonelilyRatePerCell: z.strictObject({
    mutation: z.string().min(1),
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    note: z.string(),
  }),
  rosewaterFlask: z.string(),
  analysis: z.string(),
  analysisAvrg: z.string(),
  bazaarUnlockAfterAnalysis: z.strictObject({ text: z.string(), verified: z.boolean() }),
  greenhouseUpgrades: z.strictObject({ menu: z.string().min(1), items: z.array(upgradeSchema) }),
  tips: z.array(tipSchema),
})

const baseCropSchema = z.strictObject({
  name: z.string().min(1),
  purchasable: z.boolean().nullable(),
  surface: z.string().nullable(),
  effects: z.array(z.string()),
  effectsVerified: z.boolean().optional(),
  notes: z.string().optional(),
})

const conditionSchema = z.strictObject({
  crop: z.string().min(1),
  count: positiveInt,
})

const specialPrerequisiteSchema = z.strictObject({
  crop: z.string().min(1),
  count: positiveInt,
  role: z.enum(['consumed', 'catalyst']),
})

const harvestSchema = z.strictObject({
  firstStage: positiveInt.optional(),
  every: positiveInt.optional(),
  lastStage: positiveInt.optional(),
  recommendedStage: positiveInt.optional(),
  resetsAfterStage: positiveInt.optional(),
  fragments: z
    .strictObject({ atRecommendedStage: positiveInt, perMutation: positiveInt })
    .optional(),
})

const usageSchema = z.strictObject({
  target: z.string().min(1),
  type: z.string().min(1),
  quantity: positiveInt.nullable(),
  verified: z.boolean(),
})

const mutationSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/, 'id attendu en minuscules, chiffres et _'),
  name: z.string().min(1),
  /** Identifiant de l'objet chez Hypixel (API publique), pour lire un profil importé. */
  itemId: z.string().regex(/^[A-Z0-9_]+$/, 'identifiant Hypixel attendu en majuscules, chiffres et _'),
  rarity: z.string().min(1),
  size: z.enum(SIZES),
  surface: z.string().min(1),
  growthStages: nonNegativeInt.nullable(),
  conditions: z.array(conditionSchema),
  specialCondition: z.string().min(1).optional(),
  spawnRule: z.enum(SPAWN_RULES).optional(),
  spawnPriority: nonNegativeInt.optional(),
  specialPrerequisites: z.array(specialPrerequisiteSchema).optional(),
  drops: z.record(z.string(), nonNegativeInt),
  effects: z.array(z.string()),
  notes: z.string().optional(),
  avrgNotes: z.string().optional(),
  harvest: harvestSchema.optional(),
  roseDragonOptimum: nonNegativeInt,
  roseDragonMinimum: nonNegativeInt.nullable(),
  usages: z.array(usageSchema),
  conflicts: z.array(conflictSchema).optional(),
  nameVerified: z.boolean().optional(),
  rarityVerified: z.boolean().optional(),
  sizeVerified: z.boolean().optional(),
  surfaceVerified: z.boolean().optional(),
  growthStagesVerified: z.boolean().optional(),
  conditionsVerified: z.boolean().optional(),
  dropsVerified: z.boolean().optional(),
  effectsVerified: z.boolean().optional(),
})

const goalSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/, 'id attendu en minuscules, chiffres et _'),
  name: z.string().min(1),
  type: z.string().min(1),
  npc: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  requires: z.strictObject({
    mutations: z.record(z.string(), positiveInt.nullable()).optional(),
    other: z.record(z.string(), z.number().nonnegative()).optional(),
    eachMutation: positiveInt.optional(),
    milestones: z.array(z.string()).optional(),
  }),
  avrgRoute: z.boolean().optional(),
  verified: z.boolean(),
})

/** Entrée de légende d'un plan : crop, crop sur une surface, emplacement de spawn ou case vide. */
const layoutLegendEntrySchema = z.union([
  z.string().min(1),
  z.strictObject({ crop: z.string().min(1), surface: z.string().min(1).optional() }),
  z.strictObject({ spot: z.string().min(1), expect: z.array(z.string().min(1)).min(1) }),
  z.strictObject({ surface: z.string().min(1) }),
])

const layoutSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/, 'id attendu en minuscules, chiffres et _'),
  name: z.string().min(1),
  source: z.string().optional(),
  notes: z.string().optional(),
  defaultSurface: z.string().min(1).optional(),
  legend: z.record(z.string().length(1, 'une seule lettre par entrée de légende'), layoutLegendEntrySchema),
  rows: z.array(z.string().min(1)).min(1),
  placements: z.array(z.strictObject({ crop: z.string().min(1), x: nonNegativeInt, y: nonNegativeInt })).optional(),
})

const guideIdSchema = z.string().regex(/^[a-z0-9_]+$/, 'id attendu en minuscules, chiffres et _')

/** Guide du Rose Dragon : sections et chapitres du guide AVRG, chacun avec son plan de ferme. */
const guideSchema = z.strictObject({
  goal: z.string().min(1),
  sections: z.array(
    z.strictObject({
      id: guideIdSchema,
      title: z.string().min(1),
      text: z.string().min(1).optional(),
      chapters: z
        .array(
          z.strictObject({
            id: guideIdSchema,
            title: z.string().min(1),
            layout: z.string().min(1),
            minimumLayout: z.string().min(1).optional(),
            text: z.string().min(1).optional(),
            ownPlot: z.boolean().optional(),
          }),
        )
        .min(1),
    }),
  ),
})

const bestiarySchema = z.strictObject({
  mob: z.string().min(1),
  source: z.string().min(1),
  mutation: z.string().min(1).optional(),
  maxKills: positiveInt.optional(),
  maxKillsVerified: z.boolean().optional(),
  conflicts: z.array(conflictSchema).optional(),
})

export const gameDataSchema = z.strictObject({
  // _meta reste souple : il ne sert qu'à la documentation du fichier.
  _meta: z.looseObject({
    description: z.string(),
    dataVersion: positiveInt,
    sources: z.array(z.string()),
  }),
  surfaces: z.array(z.string().min(1)).min(1),
  rarities: z.array(z.string().min(1)).min(1),
  effects: z.record(z.string(), effectSchema),
  mechanics: mechanicsSchema,
  baseCrops: z.array(baseCropSchema),
  mutations: z.array(mutationSchema).min(1),
  goals: z.array(goalSchema),
  unmappedUsages: z.strictObject({
    description: z.string(),
    items: z.array(z.string()),
  }),
  layouts: z.array(layoutSchema),
  guide: guideSchema,
  bestiary: z.array(bestiarySchema),
  mutationsSack: z.strictObject({
    name: z.string().min(1),
    source: z.string().optional(),
    capacity: z.record(z.string(), positiveInt),
    items: z.array(z.string().min(1)).min(1),
  }),
})

export type RawGameData = z.infer<typeof gameDataSchema>
export type RawMutation = z.infer<typeof mutationSchema>
export type RawMechanics = z.infer<typeof mechanicsSchema>
export type RawUpgrade = z.infer<typeof upgradeSchema>
export type RawLayout = z.infer<typeof layoutSchema>
