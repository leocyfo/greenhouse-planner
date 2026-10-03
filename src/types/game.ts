/**
 * Types du domaine, construits à partir de mutations.json une fois validé et normalisé
 * (voir src/data/load.ts). Toute l'application travaille sur ces types, jamais sur le JSON brut.
 */
import type {
  EFFECT_STATS,
  RawMechanics,
  RawUpgrade,
  SIZES,
  SPAWN_RULES,
  VERIFIABLE_MUTATION_FIELDS,
} from '../data/schema'

/** Comment une mutation spawn sur la grille : conditions de voisinage par défaut. */
export type SpawnRule = (typeof SPAWN_RULES)[number]

/** Taille d'une mutation : empreinte carrée, ancrée en haut à gauche sur la grille. */
export type MutationSize = (typeof SIZES)[number]

/** Ce que modifie un effet. Les stats chiffrées (yield, xp, water) ont un `amount` en %. */
export type EffectStat = (typeof EFFECT_STATS)[number]

export interface Effect {
  readonly name: string
  readonly type: 'positive' | 'negative'
  /** Texte d'origine, affiché tel quel. */
  readonly value: string
  readonly stat: EffectStat
  /** Valeur en % (négative pour un malus) ; null pour immunity, spread et bonusDrops. */
  readonly amount: number | null
}

/** Référence vers un crop : une mutation (par id) ou un crop de base (par nom). */
export type CropRef =
  | { readonly kind: 'mutation'; readonly id: string }
  | { readonly kind: 'base'; readonly name: string }

/**
 * Voisin requis autour d'un emplacement de spawn.
 * `count` compte des CASES : une mutation 2x2 ou 3x3 compte une fois par case occupée.
 */
export interface Condition {
  readonly crop: CropRef
  readonly count: number
}

/**
 * Mutation nécessaire en dehors des conditions de voisinage (ex. Shellfruit ← Turtlellini).
 * - consumed : `count` exemplaires consommés par mutation produite ;
 * - catalyst : doit être disponible (au moins `count`), sans s'ajouter aux autres besoins.
 */
export interface SpecialPrerequisite {
  readonly mutationId: string
  readonly count: number
  readonly role: 'consumed' | 'catalyst'
}

/** Récolte possible avant la fin de la croissance (Magic Jellybean, Glasscorn, All-in Aloe). */
export interface HarvestInfo {
  readonly firstStage: number | null
  readonly every: number | null
  readonly lastStage: number | null
  readonly recommendedStage: number | null
  readonly resetsAfterStage: number | null
  readonly fragments: { readonly atRecommendedStage: number; readonly perMutation: number } | null
}

/** Valeur différente trouvée dans une autre source. */
export interface Conflict {
  readonly field: string
  readonly value: string | number
  readonly source: string
}

/** Champs d'une mutation qui peuvent être marqués « à vérifier ». */
export type MutationField = (typeof VERIFIABLE_MUTATION_FIELDS)[number]

export interface Usage {
  readonly target: string
  readonly type: string
  /** null = quantité inconnue. */
  readonly quantity: number | null
  readonly verified: boolean
}

export interface Mutation {
  readonly id: string
  readonly name: string
  /** Identifiant de l'objet chez Hypixel (ex. CHOCONUT), pour lire un profil importé. */
  readonly itemId: string
  readonly rarity: string
  /** Position de la rareté dans `rarities` (0 = la plus commune). */
  readonly rarityRank: number
  readonly size: MutationSize
  /** Côté de l'empreinte en cases (1, 2 ou 3). */
  readonly side: number
  readonly surface: string
  /** null = inconnu (à vérifier). */
  readonly growthStages: number | null
  /** Jours avant que la mutation meure (decay). null = elle ne decay jamais. */
  readonly decayDays: number | null
  /** true = a besoin d'eau pendant sa croissance ; null = inconnu. */
  readonly needsWater: boolean | null
  readonly conditions: readonly Condition[]
  readonly specialCondition: string | null
  readonly specialPrerequisites: readonly SpecialPrerequisite[]
  readonly spawnRule: SpawnRule
  /** En cas de conflit sur la grille, la priorité la plus haute l'emporte (Godseed : 1). */
  readonly spawnPriority: number
  readonly drops: Readonly<Record<string, number>>
  readonly effects: readonly string[]
  readonly notes: string | null
  readonly avrgNotes: string | null
  readonly harvest: HarvestInfo | null
  readonly roseDragonOptimum: number
  /** null = AVRG ne donne pas de minimum explicite. */
  readonly roseDragonMinimum: number | null
  readonly usages: readonly Usage[]
  readonly conflicts: readonly Conflict[]
  /**
   * Champs à confirmer en jeu : drapeau `<champ>Verified: false`, valeur inconnue (null)
   * ou conflit entre sources.
   */
  readonly unverified: readonly MutationField[]
}

export interface BaseCrop {
  readonly name: string
  /** null = inconnu (à vérifier). */
  readonly purchasable: boolean | null
  /** null = inconnu (à vérifier). */
  readonly surface: string | null
  readonly effects: readonly string[]
  readonly effectsVerified: boolean
  readonly notes: string | null
}

export interface GoalMutationRequirement {
  readonly mutationId: string
  /** Quantité consommée par l'objectif. null = inconnue (comptée 1, à vérifier). */
  readonly quantity: number | null
}

export interface Goal {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly npc: string | null
  readonly description: string | null
  readonly notes: string | null
  readonly mutations: readonly GoalMutationRequirement[]
  /** Pour « Analyser les 40 » : exemplaires consommés par mutation. */
  readonly eachMutation: number | null
  /** Coûts hors mutations (Coins, Copper, Condensed Helianthus…). */
  readonly other: Readonly<Record<string, number>>
  readonly milestones: readonly string[]
  /** En mode Optimum, les besoins de cet objectif suivent les totaux AVRG (roseDragonOptimum). */
  readonly avrgRoute: boolean
  readonly verified: boolean
}

export interface BestiaryEntry {
  readonly mob: string
  /** Texte affiché : d'où vient le mob. */
  readonly source: string
  /** Mutation liée au mob, pour l'afficher sur sa fiche ; null si aucune. */
  readonly mutationId: string | null
  /** null = inconnu (affiché « kills max inconnus »). */
  readonly maxKills: number | null
  readonly maxKillsVerified: boolean
  readonly conflicts: readonly Conflict[]
}

/** Mécaniques du greenhouse : textes affichés et paramètres chiffrés des calculs. */
export type Mechanics = RawMechanics

/** Upgrade du menu « Greenhouse Upgrades » ; `tiers` = bonus de chaque tier (null = inconnu). */
export type Upgrade = RawUpgrade
export type UpgradeEffect = Upgrade['effect']

/** Crop posé sur la grille ; les mutations 2x2 et 3x3 sont ancrées en haut à gauche. */
export interface Placement {
  readonly crop: CropRef
  readonly x: number
  readonly y: number
}

/** Emplacement de spawn d'un plan, avec les mutations qu'il doit produire. */
export interface LayoutSpot {
  readonly x: number
  readonly y: number
  /** Ids des mutations attendues. */
  readonly expect: readonly string[]
}

/** Plan de ferme prêt à charger dans la grille (guide AVRG). */
export interface LayoutPreset {
  readonly id: string
  readonly name: string
  readonly source: string | null
  readonly notes: string | null
  readonly width: number
  readonly height: number
  /** Sol de chaque case, rangée par rangée (surface, ou bloc cassé). */
  readonly ground: readonly string[]
  readonly placements: readonly Placement[]
  readonly spots: readonly LayoutSpot[]
}

/** Chapitre du guide AVRG : une ferme (son plan), et sa version minimum s'il y en a une. */
export interface GuideChapter {
  readonly id: string
  readonly title: string
  readonly text: string | null
  readonly layout: LayoutPreset
  readonly minimumLayout: LayoutPreset | null
  /** La ferme reste seule sur son greenhouse (Chorus Fruit) ; les autres peuvent en partager un. */
  readonly ownPlot: boolean
  /**
   * Chapitre précédent dont la ferme se transforme en celle-ci, dans le même greenhouse (Snoozling
   * Complex : l'étape 2 se construit sur l'étape 1) ; null pour une ferme posée telle quelle.
   */
  readonly upgrades: GuideChapter | null
  /** Mise en garde affichée en rouge sur la ferme (Chorus Fruit : il se téléporte et détruit ce qui est posé). */
  readonly warning: string | null
}

export interface GuideSection {
  readonly id: string
  readonly title: string
  readonly text: string | null
  readonly chapters: readonly GuideChapter[]
}

/** Guide d'un objectif (le Rose Dragon), d'après le guide AVRG. */
export interface Guide {
  readonly goalId: string
  readonly sections: readonly GuideSection[]
}

export interface GameData {
  readonly meta: {
    readonly description: string
    readonly dataVersion: number
    readonly sources: readonly string[]
  }
  readonly surfaces: readonly string[]
  /** Raretés de la plus commune à la plus rare. */
  readonly rarities: readonly string[]
  readonly effects: ReadonlyMap<string, Effect>
  readonly mechanics: Mechanics
  readonly baseCrops: readonly BaseCrop[]
  readonly baseCropsByName: ReadonlyMap<string, BaseCrop>
  readonly mutations: readonly Mutation[]
  readonly mutationsById: ReadonlyMap<string, Mutation>
  readonly mutationsByName: ReadonlyMap<string, Mutation>
  readonly goals: readonly Goal[]
  readonly unmappedUsages: { readonly description: string; readonly items: readonly string[] }
  readonly layouts: readonly LayoutPreset[]
  readonly guide: Guide
  readonly bestiary: readonly BestiaryEntry[]
  readonly mutationsSack: MutationsSack
}

/** Mutations Sack du jeu : objets dans l'ordre du sac, et capacité par taille de sac. */
export interface MutationsSack {
  readonly name: string
  /** Objets du sac ; `mutationId` null pour ceux que l'application ne suit pas (fragments…). */
  readonly items: readonly { readonly name: string; readonly mutationId: string | null }[]
  readonly capacity: Readonly<Record<string, number>>
}

/** Problème trouvé dans mutations.json, avec son emplacement lisible. */
export interface DataIssue {
  readonly path: string
  readonly message: string
}

export type GameDataLoadResult =
  | { readonly ok: true; readonly data: GameData }
  | { readonly ok: false; readonly issues: readonly DataIssue[] }
