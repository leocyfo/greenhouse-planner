/**
 * Fabrique du store global (Zustand), sauvegardé automatiquement.
 * Les transitions sont dans progress.ts, la version et le nettoyage dans persistence.ts.
 */
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { tr } from '../i18n/locale'
import { withCrop, withGround, withoutCropAt } from '../logic/grid'
import type { PlanMode } from '../logic/recipes'
import type { CropRef, GameData, Placement } from '../types/game'
import {
  normalizeLonelilyCells,
  normalizeSpots,
  withAddedTarget,
  withCalculatorGoal,
  withoutTarget,
  withSingleGoal,
  withSingleTarget,
  withTargetQuantity,
} from './calculator'
import {
  emptyLayout,
  layoutFromPreset,
  nextLayoutName,
  toGridInput,
  withActiveGreenhouse,
  withActiveLayout,
  withLayoutAdded,
  withLayoutChanged,
  withLayoutRemoved,
} from './grids'
import { migratePersistedState, sanitizePersistedState, SCHEMA_VERSION, STORAGE_KEY } from './persistence'
import { withAnalyzed, withAnalyzedMany, withGoalActive, withImportedInventory, withOwned } from './progress'
import type { CalculatorState, GridState, PersistedState, PlayerSettings, SettingsState, VinesState } from './state'

export interface AppActions {
  setOwned: (mutationId: string, count: number) => void
  adjustOwned: (mutationId: string, delta: number) => void
  setAnalyzed: (mutationId: string, analyzed: boolean) => void
  /** « Tout cocher » d'une rareté dans la liste de l'Inventaire : une seule mise à jour. */
  setAnalyzedMany: (mutationIds: readonly string[], analyzed: boolean) => void
  setGoalActive: (goalId: string, active: boolean) => void
  setPlanMode: (mode: PlanMode) => void
  /** Bonus Growth Speed (menu des upgrades). */
  setGrowth: (growth: Partial<SettingsState['growth']>) => void
  /** Option « les mutations analysées s'achètent au bazar » (tous les onglets). */
  setAnalyzedBuyable: (enabled: boolean) => void
  /** Joueur Hypixel lié : pseudo, profil choisi, invitation du tableau de bord écartée. */
  setPlayer: (player: Partial<PlayerSettings>) => void
  /** Langue de l'interface (null : celle du navigateur). */
  setLocale: (locale: SettingsState['locale']) => void
  /** Stock importé d'un profil Hypixel, en une seule mise à jour (voir withImportedInventory). */
  importInventory: (counts: Readonly<Record<string, number>>, keepMissing: boolean) => void

  addCalculatorTarget: (mutationId: string, quantity: number) => void
  setCalculatorTargetQuantity: (mutationId: string, quantity: number) => void
  removeCalculatorTarget: (mutationId: string) => void
  setCalculatorGoal: (goalId: string, included: boolean) => void
  /** Options du calculateur : mode, inventaire ignoré, emplacements, cases pour les Lonelily. */
  setCalculatorOptions: (
    options: Partial<Pick<CalculatorState, 'mode' | 'ignoreInventory' | 'spots' | 'lonelilyCells'>>,
  ) => void
  /** Vide les cibles et les objectifs du calculateur (garde les options). */
  clearCalculator: () => void
  /** Calcule une seule mutation (bouton « calculer » de l'Encyclopédie ou du Tableau de bord). */
  calculateOnly: (mutationId: string, quantity?: number) => void
  /** Calcule un seul objectif (bouton « calculer » d'une carte d'objectif). */
  calculateGoal: (goalId: string, mode?: PlanMode) => void

  setActiveGreenhouse: (greenhouse: number) => void
  setActiveLayout: (greenhouse: number, layoutId: string) => void
  addLayout: (greenhouse: number) => void
  duplicateLayout: (greenhouse: number, layoutId: string) => void
  renameLayout: (greenhouse: number, layoutId: string, name: string) => void
  deleteLayout: (greenhouse: number, layoutId: string) => void
  /** Charge un plan AVRG dans un nouveau plan du greenhouse. */
  loadPreset: (greenhouse: number, presetId: string) => void
  /** Ajoute un plan tout fait (remplissage automatique) et l'affiche ; ignoré si le sol n'a pas la taille de la grille. */
  addGeneratedLayout: (greenhouse: number, name: string, ground: readonly string[], placements: readonly Placement[]) => void
  /** Pose un crop ; renvoie la raison d'un refus, ou null. */
  placeCrop: (greenhouse: number, layoutId: string, crop: CropRef, x: number, y: number) => string | null
  removeCropAt: (greenhouse: number, layoutId: string, x: number, y: number) => void
  paintGround: (greenhouse: number, layoutId: string, x: number, y: number, ground: string) => void
  /** Retire tous les crops d'un plan (le sol ne change pas). */
  clearCrops: (greenhouse: number, layoutId: string) => void

  /** Ethereal Vines dépensées par greenhouse (valeurs entières, jamais négatives). */
  setVines: (vines: Partial<VinesState>) => void
  /** Tier d'un upgrade sans autre réglage (Plant Yield) ; 0 le retire. */
  setUpgradeTier: (upgradeId: string, tier: number) => void

  /** Remplace tout l'état sauvegardé (import d'un fichier). */
  replaceState: (state: PersistedState) => void
  /** Revient aux valeurs de départ. */
  resetAll: () => void
}

export type AppState = PersistedState & AppActions

export interface StoreOptions {
  /**
   * Données du jeu, pour valider les poses sur la grille (null si mutations.json est invalide). Une
   * fonction rend celles de la langue du moment : un plan du guide chargé prend le nom traduit.
   */
  readonly data?: GameData | null | (() => GameData)
  /** Générateur d'identifiants de plans (remplaçable dans les tests). */
  readonly makeId?: () => string
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Crée un store sauvegardé dans `storage` (le localStorage du navigateur par défaut). */
export function createAppStore(defaults: PersistedState, storage?: StateStorage, options: StoreOptions = {}) {
  const source = options.data ?? null
  const currentData = (): GameData | null => (typeof source === 'function' ? source() : source)
  const data = currentData()
  const makeId = options.makeId ?? randomId
  const size = {
    width: data?.mechanics.greenhouse.width ?? 0,
    height: data?.mechanics.greenhouse.height ?? 0,
  }
  const defaultSurface = data?.surfaces[0] ?? ''
  const findLayout = (grids: GridState, greenhouse: number, layoutId: string) =>
    grids.greenhouses[greenhouse]?.layouts.find((layout) => layout.id === layoutId)

  return create<AppState>()(
    persist(
      (set, get) => ({
        ...defaults,
        setOwned: (mutationId, count) => set((s) => ({ progress: withOwned(s.progress, mutationId, count) })),
        adjustOwned: (mutationId, delta) =>
          set((s) => ({
            progress: withOwned(s.progress, mutationId, (s.progress.inventory[mutationId] ?? 0) + delta),
          })),
        setAnalyzed: (mutationId, analyzed) =>
          set((s) => ({ progress: withAnalyzed(s.progress, mutationId, analyzed) })),
        setAnalyzedMany: (mutationIds, analyzed) =>
          set((s) => ({ progress: withAnalyzedMany(s.progress, mutationIds, analyzed) })),
        setGoalActive: (goalId, active) => set((s) => ({ progress: withGoalActive(s.progress, goalId, active) })),
        setPlanMode: (planMode) => set((s) => ({ settings: { ...s.settings, planMode } })),
        setGrowth: (growth) =>
          set((s) => ({ settings: { ...s.settings, growth: { ...s.settings.growth, ...growth } } })),
        setAnalyzedBuyable: (analyzedBuyable) => set((s) => ({ settings: { ...s.settings, analyzedBuyable } })),
        setPlayer: (player) => set((s) => ({ settings: { ...s.settings, player: { ...s.settings.player, ...player } } })),
        setLocale: (locale) => set((s) => ({ settings: { ...s.settings, locale } })),
        importInventory: (counts, keepMissing) =>
          set((s) => ({ progress: withImportedInventory(s.progress, counts, keepMissing) })),

        addCalculatorTarget: (mutationId, quantity) =>
          set((s) => ({ calculator: withAddedTarget(s.calculator, mutationId, quantity) })),
        setCalculatorTargetQuantity: (mutationId, quantity) =>
          set((s) => ({ calculator: withTargetQuantity(s.calculator, mutationId, quantity) })),
        removeCalculatorTarget: (mutationId) => set((s) => ({ calculator: withoutTarget(s.calculator, mutationId) })),
        setCalculatorGoal: (goalId, included) =>
          set((s) => ({ calculator: withCalculatorGoal(s.calculator, goalId, included) })),
        setCalculatorOptions: (options) =>
          set((s) => ({
            calculator: {
              ...s.calculator,
              ...options,
              spots: normalizeSpots(options.spots ?? s.calculator.spots),
              lonelilyCells: normalizeLonelilyCells(options.lonelilyCells ?? s.calculator.lonelilyCells),
            },
          })),
        clearCalculator: () => set((s) => ({ calculator: { ...s.calculator, targets: [], goalIds: [] } })),
        calculateOnly: (mutationId, quantity) =>
          set((s) => ({ calculator: withSingleTarget(s.calculator, mutationId, quantity) })),
        calculateGoal: (goalId, mode) =>
          set((s) => {
            const calculator = withSingleGoal(s.calculator, goalId)
            return { calculator: mode ? { ...calculator, mode } : calculator }
          }),

        setActiveGreenhouse: (greenhouse) => set((s) => ({ grids: withActiveGreenhouse(s.grids, greenhouse) })),
        setActiveLayout: (greenhouse, layoutId) =>
          set((s) => ({ grids: withActiveLayout(s.grids, greenhouse, layoutId) })),
        addLayout: (greenhouse) =>
          set((s) => {
            const layouts = s.grids.greenhouses[greenhouse]?.layouts
            if (!layouts) return {}
            const layout = emptyLayout(makeId(), nextLayoutName(layouts), size, defaultSurface)
            return { grids: withLayoutAdded(s.grids, greenhouse, layout) }
          }),
        duplicateLayout: (greenhouse, layoutId) =>
          set((s) => {
            const layout = findLayout(s.grids, greenhouse, layoutId)
            if (!layout) return {}
            return { grids: withLayoutAdded(s.grids, greenhouse, { ...layout, id: makeId(), name: tr(`${layout.name} (copie)`, `${layout.name} (copy)`) }) }
          }),
        renameLayout: (greenhouse, layoutId, name) => {
          const trimmed = name.trim().slice(0, 60)
          if (!trimmed) return
          set((s) => ({ grids: withLayoutChanged(s.grids, greenhouse, layoutId, (layout) => ({ ...layout, name: trimmed })) }))
        },
        deleteLayout: (greenhouse, layoutId) =>
          set((s) => ({
            grids: withLayoutRemoved(s.grids, greenhouse, layoutId, emptyLayout(makeId(), 'Plan 1', size, defaultSurface)),
          })),
        loadPreset: (greenhouse, presetId) => {
          const preset = currentData()?.layouts.find((layout) => layout.id === presetId)
          if (!preset) return
          set((s) => ({
            grids: withLayoutAdded(s.grids, greenhouse, layoutFromPreset(makeId(), preset, size, defaultSurface)),
          }))
        },
        addGeneratedLayout: (greenhouse, name, ground, placements) => {
          if (ground.length !== size.width * size.height) return
          set((s) => ({
            grids: withLayoutAdded(s.grids, greenhouse, { id: makeId(), name, ground: [...ground], placements: [...placements] }),
          }))
        },
        placeCrop: (greenhouse, layoutId, crop, x, y) => {
          const layout = findLayout(get().grids, greenhouse, layoutId)
          if (!data || !layout) return tr('Plan introuvable.', 'Plan not found.')
          const change = withCrop(data, toGridInput(layout, size), crop, x, y)
          if (!change.ok) return change.reason
          set((s) => ({
            // Le sol change aussi : une mutation met ses cases à son sol.
            grids: withLayoutChanged(s.grids, greenhouse, layoutId, (current) => ({
              ...current,
              ground: [...change.grid.ground],
              placements: change.grid.placements,
            })),
          }))
          return null
        },
        removeCropAt: (greenhouse, layoutId, x, y) => {
          const layout = findLayout(get().grids, greenhouse, layoutId)
          if (!data || !layout) return
          const placements = withoutCropAt(data, toGridInput(layout, size), x, y).placements
          set((s) => ({ grids: withLayoutChanged(s.grids, greenhouse, layoutId, (current) => ({ ...current, placements })) }))
        },
        paintGround: (greenhouse, layoutId, x, y, ground) => {
          const layout = findLayout(get().grids, greenhouse, layoutId)
          if (!data || !layout) return
          const next = withGround(data, toGridInput(layout, size), x, y, ground)
          set((s) => ({
            grids: withLayoutChanged(s.grids, greenhouse, layoutId, (current) => ({
              ...current,
              ground: next.ground,
              placements: next.placements,
            })),
          }))
        },
        clearCrops: (greenhouse, layoutId) =>
          set((s) => ({ grids: withLayoutChanged(s.grids, greenhouse, layoutId, (layout) => ({ ...layout, placements: [] })) })),

        setVines: (vines) =>
          set((s) => {
            const next = { ...s.tools.vines, ...vines }
            const clean = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0)
            return {
              tools: { ...s.tools, vines: { first: clean(next.first), second: clean(next.second), third: clean(next.third) } },
            }
          }),
        setUpgradeTier: (upgradeId, tier) =>
          set((s) => {
            const { [upgradeId]: _previous, ...others } = s.tools.upgradeTiers
            const clean = Number.isFinite(tier) ? Math.max(0, Math.floor(tier)) : 0
            return { tools: { ...s.tools, upgradeTiers: clean > 0 ? { ...others, [upgradeId]: clean } : others } }
          }),

        replaceState: (state) =>
          set({
            progress: state.progress,
            settings: state.settings,
            calculator: state.calculator,
            grids: state.grids,
            tools: state.tools,
          }),
        resetAll: () =>
          set({
            progress: defaults.progress,
            settings: defaults.settings,
            calculator: defaults.calculator,
            grids: defaults.grids,
            tools: defaults.tools,
          }),
      }),
      {
        name: STORAGE_KEY,
        version: SCHEMA_VERSION,
        storage: createJSONStorage(() => storage ?? window.localStorage),
        partialize: (state): PersistedState => ({
          progress: state.progress,
          settings: state.settings,
          calculator: state.calculator,
          grids: state.grids,
          tools: state.tools,
        }),
        // Sauvegarde d'une ancienne version : migrée puis nettoyée.
        migrate: (persisted, version) =>
          sanitizePersistedState(migratePersistedState(persisted, version), defaults),
        // Sauvegarde de la version courante : nettoyée aussi (elle a pu être modifiée à la main).
        merge: (persisted, current) => ({ ...current, ...sanitizePersistedState(persisted, defaults) }),
      },
    ),
  )
}
