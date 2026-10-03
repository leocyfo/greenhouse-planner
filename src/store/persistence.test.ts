import { describe, expect, it } from 'vitest'
import { projectData } from '../test/projectData'
import {
  exportFileName,
  migratePersistedState,
  parseProgressFile,
  sanitizePersistedState,
  SCHEMA_VERSION,
  serializeProgressFile,
} from './persistence'
import { defaultPersistedState, type PersistedState } from './state'

const defaults = defaultPersistedState(projectData())

const SAVED: PersistedState = {
  progress: { inventory: { choconut: 12, dustgrain: 3 }, analyzed: ['dustgrain'], activeGoals: ['rose_dragon'] },
  settings: {
    planMode: 'minimum',
    growth: { upgrades: 0.25 },
    analyzedBuyable: true,
    player: { name: 'Notch', profileId: 'profil-1' },
    locale: 'en',
    guide: 'cocoa_leech_shards',
  },
  calculator: {
    targets: [{ mutationId: 'glasscorn', quantity: 2 }],
    goalIds: ['rose_dragon'],
    mode: 'optimum',
    ignoreInventory: true,
    spots: 4,
    lonelilyCells: 60,
  },
  grids: defaults.grids,
  tools: { vines: { first: 40, second: 100, third: 0 }, upgradeTiers: { plant_yield: 4 } },
}

describe('sauvegarde : valeurs par défaut', () => {
  it("coche l'objectif de la route AVRG, en mode Optimum, upgrades à 0, sans achat au bazar ni joueur lié", () => {
    expect(defaults.progress).toEqual({ inventory: {}, analyzed: [], activeGoals: ['rose_dragon'] })
    expect(defaults.settings).toEqual({
      planMode: 'optimum',
      growth: { upgrades: 0 },
      analyzedBuyable: false,
      player: { name: '', profileId: null },
      locale: null,
      guide: 'rose_dragon',
    })
  })

  it('démarre le calculateur vide, en mode Minimum, avec un greenhouse vide pour les Lonelily', () => {
    expect(defaults.calculator).toEqual({
      targets: [],
      goalIds: [],
      mode: 'minimum',
      ignoreInventory: false,
      spots: 1,
      lonelilyCells: 100,
    })
  })
})

describe('sauvegarde : nettoyage', () => {
  it('garde une sauvegarde valide telle quelle', () => {
    expect(sanitizePersistedState(SAVED, defaults)).toEqual(SAVED)
  })

  it('remplace une sauvegarde illisible par les valeurs par défaut', () => {
    for (const garbage of [null, 42, 'texte', [], { autre: true }]) {
      expect(sanitizePersistedState(garbage, defaults)).toEqual(defaults)
    }
  })

  it('ne remplace que les champs invalides', () => {
    const cleaned = sanitizePersistedState(
      {
        progress: {
          inventory: { choconut: -3, dustgrain: 2.7, ashwreath: 'beaucoup', lonelily: 4 },
          analyzed: ['b', 'a', 'a', 7],
          activeGoals: 'rose_dragon',
        },
        settings: {
          planMode: 'maximum',
          growth: { upgrades: 0.1, uniqueCrops: 'douze', cropGrowth: 50 },
          analyzedBuyable: 'oui',
          player: { name: 'pas un pseudo !', profileId: 42 },
        },
      },
      defaults,
    )
    expect(cleaned).toEqual({
      progress: { inventory: { dustgrain: 2, lonelily: 4 }, analyzed: ['a', 'b'], activeGoals: ['rose_dragon'] },
      settings: {
        planMode: 'optimum',
        growth: { upgrades: 0.1 },
        analyzedBuyable: false,
        player: { name: '', profileId: null },
        locale: null,
        guide: 'rose_dragon',
      },
      calculator: defaults.calculator,
      grids: defaults.grids,
      tools: defaults.tools,
    })
  })

  it('nettoie les grilles : taille du sol, crops mal formés, plan actif, greenhouse actif', () => {
    const defaultLayout = defaults.grids.greenhouses[0]?.layouts[0]
    if (!defaultLayout) throw new Error('plan par défaut manquant')
    const cleaned = sanitizePersistedState(
      {
        ...SAVED,
        grids: {
          activeGreenhouse: 9,
          greenhouses: [
            {
              activeLayoutId: 'inconnu',
              layouts: [
                {
                  id: 'a',
                  name: '  ',
                  ground: ['Dirt'], // mauvaise taille
                  placements: [
                    { crop: { kind: 'mutation', id: 'snoozling' }, x: 1, y: 1 },
                    { crop: { kind: 'mutation' }, x: 1, y: 1 },
                    { crop: { kind: 'base', name: 'Wheat' }, x: -1, y: 0 },
                  ],
                },
                { id: 'a', name: 'doublon', ground: [], placements: [] },
              ],
            },
            'pas un greenhouse',
          ],
        },
      },
      defaults,
    )
    const [first, second, third] = cleaned.grids.greenhouses
    expect(first).toEqual({
      activeLayoutId: 'a',
      layouts: [
        {
          id: 'a',
          name: 'Plan',
          ground: defaultLayout.ground,
          placements: [{ crop: { kind: 'mutation', id: 'snoozling' }, x: 1, y: 1 }],
        },
      ],
    })
    expect(second).toEqual(defaults.grids.greenhouses[1])
    expect(third).toEqual(defaults.grids.greenhouses[2])
    expect(cleaned.grids.activeGreenhouse).toBe(2)
  })

  it('nettoie les cibles du calculateur : format, doublons, quantités, bornes', () => {
    const cleaned = sanitizePersistedState(
      {
        ...SAVED,
        calculator: {
          targets: [
            { mutationId: 'glasscorn', quantity: 0 },
            { mutationId: 'glasscorn', quantity: 5 },
            { mutationId: 'devourer', quantity: 2.8 },
            { quantity: 3 },
            'timestalk',
          ],
          goalIds: ['rose_dragon', 'rose_dragon', 4],
          mode: 'optimum',
          ignoreInventory: 'oui',
          spots: 99,
          lonelilyCells: -5,
        },
      },
      defaults,
    )
    expect(cleaned.calculator).toEqual({
      targets: [
        { mutationId: 'glasscorn', quantity: 1 },
        { mutationId: 'devourer', quantity: 2 },
      ],
      goalIds: ['rose_dragon'],
      mode: 'optimum',
      ignoreInventory: false,
      spots: 20,
      lonelilyCells: 0,
    })
  })
})

describe('sauvegarde : migrations', () => {
  it('laisse passer un état de la version courante', () => {
    expect(migratePersistedState(SAVED, SCHEMA_VERSION)).toBe(SAVED)
  })

  it('migre une sauvegarde v1 : la progression est gardée, le calculateur et les grilles reçoivent leurs valeurs par défaut', () => {
    const v1 = { progress: SAVED.progress, settings: SAVED.settings }
    const migrated = sanitizePersistedState(migratePersistedState(v1, 1), defaults)
    expect(migrated).toEqual({
      progress: SAVED.progress,
      settings: SAVED.settings,
      calculator: defaults.calculator,
      grids: defaults.grids,
      tools: defaults.tools,
    })
  })

  it('migre une sauvegarde v2 : le calculateur est gardé, les grilles reçoivent leurs valeurs par défaut', () => {
    const v2 = { progress: SAVED.progress, settings: SAVED.settings, calculator: SAVED.calculator }
    expect(sanitizePersistedState(migratePersistedState(v2, 2), defaults)).toEqual({ ...v2, grids: defaults.grids, tools: defaults.tools })
  })

  it('migre une sauvegarde v3 : tout est gardé, le suivi des vines part de zéro', () => {
    const v3 = { progress: SAVED.progress, settings: SAVED.settings, calculator: SAVED.calculator, grids: SAVED.grids }
    expect(sanitizePersistedState(migratePersistedState(v3, 3), defaults)).toEqual({ ...v3, tools: defaults.tools })
  })

  it("migre une sauvegarde v4 : tout est gardé, l'option du bazar reste désactivée", () => {
    const v4Settings = { planMode: SAVED.settings.planMode, growth: SAVED.settings.growth }
    const v4 = { ...SAVED, settings: v4Settings }
    expect(sanitizePersistedState(migratePersistedState(v4, 4), defaults)).toEqual({
      ...SAVED,
      settings: { ...v4Settings, analyzedBuyable: false, player: defaults.settings.player, locale: null, guide: 'rose_dragon' },
    })
  })

  it("migre une sauvegarde v5 : tout est gardé, les tiers d'upgrades partent de zéro", () => {
    const v5 = { ...SAVED, tools: { vines: SAVED.tools.vines } }
    expect(sanitizePersistedState(migratePersistedState(v5, 5), defaults)).toEqual({
      ...SAVED,
      tools: { vines: SAVED.tools.vines, upgradeTiers: {} },
    })
  })

  it('migre une sauvegarde v6 : seul le Growth Speed reste, crops uniques et Crop Growth sont oubliés', () => {
    const v6 = { ...SAVED, settings: { ...SAVED.settings, growth: { upgrades: 0.25, uniqueCrops: 3, cropGrowth: 40 } } }
    expect(sanitizePersistedState(migratePersistedState(v6, 6), defaults)).toEqual(SAVED)
  })

  it('migre une sauvegarde v7 : les cases Farmland deviennent Dirt, les autres sols ne changent pas', () => {
    const layout = SAVED.grids.greenhouses[0]?.layouts[0]
    if (!layout) throw new Error('plan manquant')
    const oldGround = layout.ground.map((_, index) => (index === 0 ? 'Sand' : 'Farmland'))
    const v7 = {
      ...SAVED,
      grids: {
        ...SAVED.grids,
        greenhouses: SAVED.grids.greenhouses.map((greenhouse, index) =>
          index === 0 ? { ...greenhouse, layouts: [{ ...layout, ground: oldGround }] } : greenhouse,
        ),
      },
    }
    const migrated = sanitizePersistedState(migratePersistedState(v7, 7), defaults)
    expect(migrated.grids.greenhouses[0]?.layouts[0]?.ground).toEqual(oldGround.map((ground) => (ground === 'Farmland' ? 'Dirt' : ground)))
    expect(migrated.grids.greenhouses[1]).toEqual(SAVED.grids.greenhouses[1])
  })

  it("migre une sauvegarde v8 : tout est gardé, aucun joueur lié (l'invitation s'affiche)", () => {
    const { planMode, growth, analyzedBuyable } = SAVED.settings
    const v8 = { ...SAVED, settings: { planMode, growth, analyzedBuyable } }
    expect(sanitizePersistedState(migratePersistedState(v8, 8), defaults)).toEqual({
      ...SAVED,
      settings: { ...v8.settings, player: defaults.settings.player, locale: null, guide: 'rose_dragon' },
    })
  })

  it('migre une sauvegarde v9 : tout est gardé, la langue suit le navigateur', () => {
    const { locale: _locale, ...v9Settings } = SAVED.settings
    const v9 = { ...SAVED, settings: v9Settings }
    expect(sanitizePersistedState(migratePersistedState(v9, 9), defaults)).toEqual({ ...SAVED, settings: { ...v9Settings, locale: null } })
  })

  it('migre une sauvegarde v10 : tout est gardé, le guide du Rose Dragon est affiché', () => {
    const { guide: _guide, ...v10Settings } = SAVED.settings
    const v10 = { ...SAVED, settings: v10Settings }
    expect(sanitizePersistedState(migratePersistedState(v10, 10), defaults)).toEqual({ ...SAVED, settings: { ...v10Settings, guide: 'rose_dragon' } })
  })

  it("nettoie le suivi des vines et les tiers d'upgrades : entiers positifs", () => {
    const cleaned = sanitizePersistedState(
      {
        ...SAVED,
        tools: {
          vines: { first: -3, second: 12.7, third: 'beaucoup' },
          upgradeTiers: { plant_yield: 4.7, growth_speed: -2, autre: 'x' },
        },
      },
      defaults,
    )
    expect(cleaned.tools).toEqual({ vines: { first: 0, second: 12, third: 0 }, upgradeTiers: { plant_yield: 4 } })
  })

  it('renvoie null pour une version trop ancienne sans migration', () => {
    expect(migratePersistedState(SAVED, 0)).toBeNull()
  })
})

describe("sauvegarde : fichier d'export", () => {
  it('nomme le fichier avec la date du jour', () => {
    expect(exportFileName(new Date(2026, 8, 29, 23, 59))).toBe('sky-helper-2026-09-29.json')
  })

  it("relit exactement ce qu'il a exporté", () => {
    const text = serializeProgressFile(SAVED, new Date('2026-09-29T10:00:00Z'))
    expect(JSON.parse(text)).toMatchObject({
      app: 'greenhouse-planner',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: '2026-09-29T10:00:00.000Z',
    })
    expect(parseProgressFile(text, defaults)).toEqual({ ok: true, state: SAVED })
  })

  it("refuse un fichier qui n'est pas du JSON ou pas une sauvegarde de l'app", () => {
    expect(parseProgressFile('{pas du json', defaults)).toEqual({
      ok: false,
      error: "Le fichier n'est pas du JSON valide.",
    })
    expect(parseProgressFile(JSON.stringify({ hello: 'world' }), defaults).ok).toBe(false)
  })

  it("refuse une sauvegarde d'une version plus récente de l'application", () => {
    const future = JSON.stringify({ app: 'greenhouse-planner', schemaVersion: SCHEMA_VERSION + 1, state: SAVED })
    expect(parseProgressFile(future, defaults)).toEqual({
      ok: false,
      error: "Cette sauvegarde vient d'une version plus récente de l'application.",
    })
  })

  it('nettoie un fichier modifié à la main', () => {
    const edited = JSON.stringify({
      app: 'greenhouse-planner',
      schemaVersion: SCHEMA_VERSION,
      state: { ...SAVED, progress: { ...SAVED.progress, inventory: { choconut: -1, dustgrain: 5 } } },
    })
    const result = parseProgressFile(edited, defaults)
    expect(result.ok && result.state.progress.inventory).toEqual({ dustgrain: 5 })
  })
})
