import { describe, expect, it } from 'vitest'
import type { StateStorage } from 'zustand/middleware'
import { projectData } from '../test/projectData'
import { createAppStore } from './createAppStore'
import { SCHEMA_VERSION, STORAGE_KEY } from './persistence'
import { defaultLayoutId, defaultPersistedState } from './state'

const defaults = defaultPersistedState(projectData())

/** Stockage en mémoire à la place du localStorage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  const storage: StateStorage = {
    getItem: (name) => items.get(name) ?? null,
    setItem: (name, value) => {
      items.set(name, value)
    },
    removeItem: (name) => {
      items.delete(name)
    },
  }
  const saved = () => JSON.parse(items.get(STORAGE_KEY) ?? 'null') as unknown
  return { storage, saved }
}

function savedState(state: unknown, version = SCHEMA_VERSION): Record<string, string> {
  return { [STORAGE_KEY]: JSON.stringify({ state, version }) }
}

describe('store : sauvegarde automatique', () => {
  it('écrit chaque changement avec le numéro de version, sans les actions', () => {
    const { storage, saved } = memoryStorage()
    const store = createAppStore(defaults, storage)
    store.getState().setOwned('choconut', 5)
    store.getState().setAnalyzed('dustgrain', true)
    expect(saved()).toEqual({
      version: SCHEMA_VERSION,
      state: {
        progress: { inventory: { choconut: 5 }, analyzed: ['dustgrain'], activeGoals: ['rose_dragon'] },
        settings: defaults.settings,
        calculator: defaults.calculator,
        grids: defaults.grids,
        tools: defaults.tools,
      },
    })
  })

  it('reprend une sauvegarde v1 en ajoutant le calculateur et les grilles', () => {
    const { storage, saved } = memoryStorage(
      savedState({ progress: { inventory: { choconut: 7 }, analyzed: [], activeGoals: [] }, settings: defaults.settings }, 1),
    )
    const store = createAppStore(defaults, storage)
    expect(store.getState().progress.inventory).toEqual({ choconut: 7 })
    expect(store.getState().calculator).toEqual(defaults.calculator)
    expect(store.getState().grids).toEqual(defaults.grids)
    // La sauvegarde est réécrite au format courant au premier changement.
    store.getState().addCalculatorTarget('glasscorn', 1)
    expect(saved()).toMatchObject({
      version: SCHEMA_VERSION,
      state: { calculator: { targets: [{ mutationId: 'glasscorn', quantity: 1 }] } },
    })
  })

  it('reprend la progression sauvegardée au démarrage', () => {
    const { storage } = memoryStorage(
      savedState({
        progress: { inventory: { ashwreath: 36 }, analyzed: ['ashwreath'], activeGoals: [] },
        settings: { planMode: 'minimum', growth: defaults.settings.growth, analyzedBuyable: false },
      }),
    )
    const state = createAppStore(defaults, storage).getState()
    expect(state.progress.inventory).toEqual({ ashwreath: 36 })
    expect(state.progress.activeGoals).toEqual([])
    expect(state.settings.planMode).toBe('minimum')
  })

  it('nettoie une sauvegarde modifiée à la main', () => {
    const { storage } = memoryStorage(
      savedState({ progress: { inventory: { choconut: -2, dustgrain: 4 } }, settings: { planMode: '???' } }),
    )
    const state = createAppStore(defaults, storage).getState()
    expect(state.progress.inventory).toEqual({ dustgrain: 4 })
    expect(state.settings.planMode).toBe('optimum')
  })

  it('repart des valeurs par défaut si la sauvegarde est corrompue ou trop ancienne', () => {
    const corrupted = createAppStore(defaults, memoryStorage({ [STORAGE_KEY]: '{oups' }).storage).getState()
    expect(corrupted.progress).toEqual(defaults.progress)
    const tooOld = createAppStore(defaults, memoryStorage(savedState({ anything: 1 }, 0)).storage).getState()
    expect(tooOld.progress).toEqual(defaults.progress)
  })
})

describe('store : actions', () => {
  it("n'accepte jamais un inventaire négatif", () => {
    const store = createAppStore(defaults, memoryStorage().storage)
    store.getState().adjustOwned('choconut', 2)
    store.getState().adjustOwned('choconut', -5)
    expect(store.getState().progress.inventory).toEqual({})
  })

  it('coche les objectifs, change le mode, les réglages de croissance et l’option du bazar', () => {
    const store = createAppStore(defaults, memoryStorage().storage)
    store.getState().setGoalActive('analyze_all', true)
    store.getState().setPlanMode('minimum')
    store.getState().setGrowth({ upgrades: 0.25 })
    store.getState().setAnalyzedBuyable(true)
    const { progress, settings } = store.getState()
    expect(progress.activeGoals).toEqual(['analyze_all', 'rose_dragon'])
    expect(settings).toEqual({
      planMode: 'minimum',
      growth: { upgrades: 0.25 },
      analyzedBuyable: true,
      player: defaults.settings.player,
      locale: null,
      guide: 'rose_dragon',
    })
  })

  it('lie un joueur Hypixel et importe son stock en une seule mise à jour', () => {
    const store = createAppStore(defaults, memoryStorage().storage)
    store.getState().setOwned('glasscorn', 2)
    store.getState().setPlayer({ name: 'Notch', profileId: 'profil-1' })
    store.getState().importInventory({ choconut: 12 }, false)
    expect(store.getState().settings.player).toEqual({ name: 'Notch', profileId: 'profil-1' })
    expect(store.getState().progress.inventory).toEqual({ choconut: 12 })
  })

  it('remplace ou réinitialise tout l’état', () => {
    const store = createAppStore(defaults, memoryStorage().storage)
    store.getState().replaceState({
      progress: { inventory: { glasscorn: 1 }, analyzed: [], activeGoals: [] },
      settings: defaults.settings,
      calculator: { ...defaults.calculator, spots: 3 },
      grids: defaults.grids,
      tools: defaults.tools,
    })
    expect(store.getState().progress.inventory).toEqual({ glasscorn: 1 })
    expect(store.getState().calculator.spots).toBe(3)
    store.getState().resetAll()
    expect(store.getState().progress).toEqual(defaults.progress)
    expect(store.getState().calculator).toEqual(defaults.calculator)
  })

  it('suit les Ethereal Vines dépensées', () => {
    const store = createAppStore(defaults, memoryStorage().storage)
    store.getState().setVines({ first: 30.9 })
    store.getState().setVines({ second: -4 })
    expect(store.getState().tools.vines).toEqual({ first: 30, second: 0, third: 0 })
  })

  it("règle le tier d'un upgrade ; 0 le retire", () => {
    const store = createAppStore(defaults, memoryStorage().storage)
    store.getState().setUpgradeTier('plant_yield', 4.6)
    expect(store.getState().tools.upgradeTiers).toEqual({ plant_yield: 4 })
    store.getState().setUpgradeTier('plant_yield', 0)
    expect(store.getState().tools.upgradeTiers).toEqual({})
    expect(store.getState().tools.vines).toEqual(defaults.tools.vines)
  })

  it('gère les cibles, les objectifs et les options du calculateur', () => {
    const store = createAppStore(defaults, memoryStorage().storage)
    const state = () => store.getState()
    state().addCalculatorTarget('glasscorn', 1)
    state().addCalculatorTarget('devourer', 2)
    state().addCalculatorTarget('glasscorn', 2) // déjà présente : la quantité s'ajoute
    state().setCalculatorTargetQuantity('devourer', 0) // sous 1 : retirée
    state().setCalculatorGoal('rose_dragon', true)
    state().setCalculatorOptions({ mode: 'optimum', spots: 50, lonelilyCells: 60 })
    expect(state().calculator).toMatchObject({
      targets: [{ mutationId: 'glasscorn', quantity: 3 }],
      goalIds: ['rose_dragon'],
      mode: 'optimum',
      spots: 20,
      lonelilyCells: 60,
    })
    state().calculateOnly('snoozling')
    expect(state().calculator).toMatchObject({ targets: [{ mutationId: 'snoozling', quantity: 1 }], goalIds: [] })
    state().clearCalculator()
    expect(state().calculator).toMatchObject({ targets: [], goalIds: [], mode: 'optimum', spots: 20 })
  })
})

describe('store : grilles', () => {
  function gridStore() {
    let next = 0
    const store = createAppStore(defaults, memoryStorage().storage, {
      data: projectData(),
      makeId: () => `id-${(next += 1)}`,
    })
    const state = () => store.getState()
    const greenhouse = () => {
      const g = state().grids.greenhouses[0]
      if (!g) throw new Error('greenhouse manquant')
      return g
    }
    const active = () => greenhouse().layouts.find((layout) => layout.id === greenhouse().activeLayoutId)
    return { state, greenhouse, active }
  }

  it('ajoute un plan tout fait (plan automatique) et l’affiche ; ignore un sol de mauvaise taille', () => {
    const { state, greenhouse, active } = gridStore()
    const ground = new Array<string>(100).fill('Dirt')
    state().addGeneratedLayout(0, 'Auto : Blastberry (4)', ground, [{ crop: { kind: 'mutation', id: 'chocoberry' }, x: 0, y: 0 }])
    expect(active()).toMatchObject({ id: 'id-1', name: 'Auto : Blastberry (4)', placements: [{ x: 0, y: 0 }] })
    state().addGeneratedLayout(0, 'Trop petit', ['Dirt'], [])
    expect(greenhouse().layouts).toHaveLength(2)
  })

  it('démarre avec un plan vide par greenhouse', () => {
    const { state, active } = gridStore()
    expect(state().grids.greenhouses).toHaveLength(3)
    expect(active()).toMatchObject({ name: 'Plan 1', placements: [] })
    expect(active()?.ground).toHaveLength(100)
  })

  it('pose, remplace et retire des crops, et refuse une pose impossible', () => {
    const { state, active } = gridStore()
    const layoutId = active()?.id ?? ''
    expect(state().placeCrop(0, layoutId, { kind: 'base', name: 'Wheat' }, 0, 0)).toBeNull()
    expect(state().placeCrop(0, layoutId, { kind: 'mutation', id: 'snoozling' }, 0, 0)).toBeNull() // recouvre le Wheat
    expect(active()?.placements).toEqual([{ crop: { kind: 'mutation', id: 'snoozling' }, x: 0, y: 0 }])
    expect(state().placeCrop(0, layoutId, { kind: 'mutation', id: 'snoozling' }, 8, 8)).toBe('Le crop dépasse de la grille.')
    state().removeCropAt(0, layoutId, 2, 2)
    expect(active()?.placements).toEqual([])
  })

  it('peint le sol et gère plusieurs plans : nouveau, copie, renommage, suppression', () => {
    const { state, greenhouse, active } = gridStore()
    const first = active()?.id ?? ''
    state().paintGround(0, first, 3, 0, 'Sand')
    expect(active()?.ground[3]).toBe('Sand')
    state().addLayout(0)
    expect(active()).toMatchObject({ id: 'id-1', name: 'Plan 2' })
    state().duplicateLayout(0, first)
    expect(active()).toMatchObject({ id: 'id-2', name: 'Plan 1 (copie)' })
    expect(active()?.ground[3]).toBe('Sand')
    state().renameLayout(0, 'id-2', '  Ferme Blastberry  ')
    expect(active()?.name).toBe('Ferme Blastberry')
    state().deleteLayout(0, 'id-2')
    expect(greenhouse().layouts.map((layout) => layout.name)).toEqual(['Plan 1', 'Plan 2'])
    expect(greenhouse().activeLayoutId).toBe(first)
  })

  it('charge un plan AVRG dans un nouveau plan', () => {
    const { state, active } = gridStore()
    state().loadPreset(0, 'avrg_blastberry_min')
    expect(active()).toMatchObject({ id: 'id-1', name: 'Blastberry : minimum' })
    expect(active()?.placements).toHaveLength(21) // 9 Chocoberry + 12 Ashwreath
    expect(active()?.ground[1 * 10 + 1]).toBe('Sand') // emplacement de spawn
  })

  it('remplace le contenu d’un plan (fermes du guide ajoutées), en gardant son id', () => {
    const { state, active } = gridStore()
    const ground = new Array<string>(100).fill('Sand')
    state().replaceLayoutContent(0, defaultLayoutId(0), 'Cheesebite + Chloronite', ground, [{ crop: { kind: 'base', name: 'Wheat' }, x: 1, y: 1 }])
    expect(active()).toMatchObject({ id: defaultLayoutId(0), name: 'Cheesebite + Chloronite', placements: [{ x: 1, y: 1 }] })
    expect(active()?.ground[0]).toBe('Sand')
    state().replaceLayoutContent(0, defaultLayoutId(0), 'trop court', ['Sand'], [])
    expect(active()?.name).toBe('Cheesebite + Chloronite')
  })

  it('prend le nom du plan AVRG dans la langue du moment', () => {
    let data = projectData()
    const english = { ...data, layouts: data.layouts.map((layout) => ({ ...layout, name: `${layout.id} (en)` })) }
    const store = createAppStore(defaults, memoryStorage().storage, { data: () => data, makeId: () => 'id-1' })
    data = english
    store.getState().loadPreset(0, 'avrg_blastberry_min')
    const greenhouse = store.getState().grids.greenhouses[0]
    expect(greenhouse?.layouts.find((layout) => layout.id === 'id-1')?.name).toBe('avrg_blastberry_min (en)')
  })
})
