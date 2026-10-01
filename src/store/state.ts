/**
 * État sauvegardé de l'application (progression, réglages, calculateur, grilles) et ses
 * valeurs par défaut.
 */
import type { Locale } from '../i18n/locale'
import type { Inventory, PlanMode, Target } from '../logic/recipes'
import type { GameData, Placement } from '../types/game'

export interface ProgressState {
  /** Exemplaires possédés par id de mutation (les zéros ne sont pas stockés). */
  readonly inventory: Inventory
  /** Ids des mutations analysées, triés. */
  readonly analyzed: readonly string[]
  /** Ids des objectifs cochés, triés. */
  readonly activeGoals: readonly string[]
}

export interface SettingsState {
  /** Mode de calcul des besoins des objectifs (Inventaire, Tableau de bord…). */
  readonly planMode: PlanMode
  /**
   * Bonus des upgrades Growth Speed (0,5 = +50 %), réglé dans le menu des upgrades. Crops
   * uniques et Crop Growth sont comptés au maximum (voir growthWithUpgrades).
   */
  readonly growth: { readonly upgrades: number }
  /**
   * Option « les mutations analysées s'achètent au bazar » (dit par AVRG pour Dustgrain et
   * Gloomgourd seulement) : désactivée par défaut. Vaut pour tous les onglets.
   */
  readonly analyzedBuyable: boolean
  /** Joueur Hypixel dont on importe le stock (pseudo, profil choisi) ; invitation au 1er lancement. */
  readonly player: PlayerSettings
  /** Langue de l'interface ; null : pas encore choisie, le site est en anglais (DEFAULT_LOCALE). */
  readonly locale: Locale | null
}

export interface PlayerSettings {
  /** Pseudo Minecraft ; vide tant qu'aucun profil n'a été importé. */
  readonly name: string
  /** Profil SkyBlock choisi à la dernière importation (null : le profil actif du joueur). */
  readonly profileId: string | null
}

export interface CalculatorState {
  /** Mutations demandées à la main, dans l'ordre d'ajout (quantité ≥ 1). */
  readonly targets: readonly Target[]
  /** Objectifs ajoutés comme cibles (ex. Rose Dragon : ses légendaires et la route AVRG). */
  readonly goalIds: readonly string[]
  readonly mode: PlanMode
  readonly ignoreInventory: boolean
  /** Emplacements de spawn par recette, pour l'estimation du temps. */
  readonly spots: number
  /** Cases de Dirt vides où les Lonelily peuvent spawn, pour l'estimation du temps. */
  readonly lonelilyCells: number
}

/** Un plan de grille : sol de chaque case et crops posés. */
export interface GridLayoutState {
  readonly id: string
  readonly name: string
  /** Sol de chaque case, rangée par rangée (surface, bloc cassé ou case verrouillée). */
  readonly ground: readonly string[]
  readonly placements: readonly Placement[]
}

export interface GreenhouseState {
  /** Au moins un plan. */
  readonly layouts: readonly GridLayoutState[]
  readonly activeLayoutId: string
}

export interface GridState {
  readonly greenhouses: readonly GreenhouseState[]
  readonly activeGreenhouse: number
}

/** Ethereal Vines dépensées pour chaque greenhouse. */
export interface VinesState {
  /** 1er greenhouse : 1 vine par case débloquée. */
  readonly first: number
  /** 2e et 3e : prix payé au NPC en une fois (0 tant qu'ils ne sont pas achetés). */
  readonly second: number
  readonly third: number
}

export interface ToolsState {
  readonly vines: VinesState
  /**
   * Tier des upgrades du Greenhouse qui n'ont pas d'autre réglage, par id (Plant Yield).
   * Growth Speed suit settings.growth.upgrades et Plot Limit les greenhouses achetés.
   */
  readonly upgradeTiers: Readonly<Record<string, number>>
}

export interface PersistedState {
  readonly progress: ProgressState
  readonly settings: SettingsState
  readonly calculator: CalculatorState
  readonly grids: GridState
  readonly tools: ToolsState
}

/** Plan vide par défaut d'un greenhouse (identifiant stable). */
export function defaultLayoutId(greenhouse: number): string {
  return `serre-${greenhouse + 1}-plan-1`
}

/**
 * Valeurs de départ : l'objectif de la route AVRG (Rose Dragon) est coché, le mode Optimum
 * est celui que recommande AVRG, les upgrades du Greenhouse sont à 0 (demande du joueur). Le calculateur part
 * vide, en mode Minimum, avec un greenhouse vide pour les Lonelily.
 * `data` peut être null si mutations.json est invalide (l'app affiche alors l'écran d'erreur).
 */
export function defaultPersistedState(data: GameData | null): PersistedState {
  const greenhouse = data?.mechanics.greenhouse
  return {
    progress: {
      inventory: {},
      analyzed: [],
      activeGoals: data ? data.goals.filter((goal) => goal.avrgRoute).map((goal) => goal.id).sort() : [],
    },
    settings: {
      planMode: 'optimum',
      growth: { upgrades: 0 },
      analyzedBuyable: false,
      player: { name: '', profileId: null },
      locale: null,
    },
    calculator: {
      targets: [],
      goalIds: [],
      mode: 'minimum',
      ignoreInventory: false,
      spots: 1,
      lonelilyCells: greenhouse ? greenhouse.width * greenhouse.height : 0,
    },
    grids: {
      greenhouses: Array.from({ length: greenhouse?.count ?? 0 }, (_, index) => ({
        layouts: [
          {
            id: defaultLayoutId(index),
            name: 'Plan 1',
            ground: new Array<string>((greenhouse?.width ?? 0) * (greenhouse?.height ?? 0)).fill(data?.surfaces[0] ?? ''),
            placements: [],
          },
        ],
        activeLayoutId: defaultLayoutId(index),
      })),
      activeGreenhouse: 0,
    },
    tools: { vines: { first: 0, second: 0, third: 0 }, upgradeTiers: {} },
  }
}
