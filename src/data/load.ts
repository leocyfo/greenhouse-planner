/**
 * Chargement de mutations.json en trois temps :
 *   1. structure (schéma zod) ;
 *   2. vérifications croisées (noms référencés, doublons, cycles, taille des anneaux…) ;
 *   3. normalisation vers les types du domaine (noms → ids, champs « à vérifier »…).
 * Tous les problèmes trouvés sont renvoyés d'un coup, avec un chemin lisible, pour que
 * l'écran d'erreur liste tout ce qu'il faut corriger dans le fichier.
 */
import { ringCellCount, sideOf } from '../logic/footprint'
import type {
  BaseCrop,
  BestiaryEntry,
  CropRef,
  DataIssue,
  Effect,
  GameData,
  GameDataLoadResult,
  Goal,
  HarvestInfo,
  Mutation,
  MutationField,
} from '../types/game'
import { parseLayout, type LayoutContext } from './layouts'
import { gameDataSchema, VERIFIABLE_MUTATION_FIELDS, type RawGameData, type RawMutation } from './schema'

type Path = readonly PropertyKey[]

const VERIFIABLE_FIELDS = new Set<string>(VERIFIABLE_MUTATION_FIELDS)
const BESTIARY_FIELDS = new Set(['mob', 'source', 'maxKills'])
/** Stats dont la valeur est un pourcentage (`amount` obligatoire). */
const STATS_WITH_AMOUNT = new Set(['yield', 'xp', 'water'])

export function loadGameData(raw: unknown): GameDataLoadResult {
  const parsed = gameDataSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: formatPath(issue.path, raw),
        message: issue.message,
      })),
    }
  }
  const issues = findReferenceIssues(parsed.data)
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, data: normalize(parsed.data) }
}

// ---------------------------------------------------------------------------
// Chemins lisibles : mutations[soggybud].conditions[Melon].count plutôt que mutations.23.conditions.0.count
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Libellé d'un élément de tableau : son id, son nom, son mob ou son crop. */
function labelOf(item: unknown): string | null {
  if (!isRecord(item)) return null
  for (const key of ['id', 'name', 'mob', 'crop']) {
    const value = item[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

function formatPath(path: Path, root: unknown): string {
  let out = ''
  let node: unknown = root
  for (const key of path) {
    if (typeof key === 'number') {
      const item: unknown = Array.isArray(node) ? node[key] : undefined
      out += `[${labelOf(item) ?? key}]`
      node = item
    } else {
      const name = String(key)
      if (/^[A-Za-z_$][\w$]*$/.test(name)) out += out ? `.${name}` : name
      else out += `[${JSON.stringify(name)}]`
      node = isRecord(node) ? node[name] : undefined
    }
  }
  return out || '(racine du fichier)'
}

// ---------------------------------------------------------------------------
// Vérifications croisées
// ---------------------------------------------------------------------------

function quoted(values: Iterable<string>): string {
  return [...values].map((v) => `« ${v} »`).join(', ')
}

function findReferenceIssues(data: RawGameData): DataIssue[] {
  const issues: DataIssue[] = []
  const add = (path: Path, message: string) =>
    issues.push({ path: formatPath(path, data), message })

  const surfaces = new Set(data.surfaces)
  const rarities = new Set(data.rarities)
  const effectNames = new Set(Object.keys(data.effects))

  reportDuplicates(data.surfaces, ['surfaces'], 'surface', add)
  reportDuplicates(data.rarities, ['rarities'], 'rareté', add)

  // --- Effets : cohérence entre stat, amount et type ---
  for (const [name, effect] of Object.entries(data.effects)) {
    const needsAmount = STATS_WITH_AMOUNT.has(effect.stat)
    if (needsAmount && effect.amount === undefined) {
      add(['effects', name, 'amount'], `amount obligatoire pour la stat « ${effect.stat} »`)
    }
    if (!needsAmount && effect.amount !== undefined) {
      add(['effects', name, 'amount'], `pas d'amount pour la stat « ${effect.stat} »`)
    }
    if (effect.amount !== undefined && (effect.type === 'positive') !== (effect.amount > 0)) {
      add(['effects', name, 'amount'], `le signe de amount ne correspond pas au type « ${effect.type} »`)
    }
  }

  // --- Mutations : ids et noms uniques ---
  const mutationNames = new Set<string>()
  const mutationIds = new Set<string>()
  data.mutations.forEach((m, i) => {
    if (mutationIds.has(m.id)) add(['mutations', i, 'id'], `id en double : « ${m.id} »`)
    if (mutationNames.has(m.name)) add(['mutations', i, 'name'], `nom en double : « ${m.name} »`)
    mutationIds.add(m.id)
    mutationNames.add(m.name)
  })

  // --- Crops de base ---
  const baseNames = new Set<string>()
  data.baseCrops.forEach((crop, i) => {
    if (baseNames.has(crop.name)) add(['baseCrops', i, 'name'], `crop de base en double : « ${crop.name} »`)
    if (mutationNames.has(crop.name)) {
      add(['baseCrops', i, 'name'], `« ${crop.name} » est à la fois un crop de base et une mutation`)
    }
    baseNames.add(crop.name)
    if (crop.surface !== null && !surfaces.has(crop.surface)) {
      add(['baseCrops', i, 'surface'], `surface inconnue : « ${crop.surface} » (attendu : ${quoted(surfaces)})`)
    }
    crop.effects.forEach((effect, ei) => {
      if (!effectNames.has(effect)) add(['baseCrops', i, 'effects', ei], `effet inconnu : « ${effect} »`)
    })
  })

  // --- Mutations : références et cohérence ---
  data.mutations.forEach((m, i) => {
    const at = (...rest: PropertyKey[]): Path => ['mutations', i, ...rest]

    if (!rarities.has(m.rarity)) {
      add(at('rarity'), `rareté inconnue : « ${m.rarity} » (attendu : ${quoted(rarities)})`)
    }
    if (!surfaces.has(m.surface)) {
      add(at('surface'), `surface inconnue : « ${m.surface} » (attendu : ${quoted(surfaces)})`)
    }
    m.effects.forEach((effect, ei) => {
      if (!effectNames.has(effect)) add(at('effects', ei), `effet inconnu : « ${effect} »`)
    })

    const seen = new Set<string>()
    let requiredCells = 0
    m.conditions.forEach((condition, ci) => {
      requiredCells += condition.count
      if (seen.has(condition.crop)) {
        add(at('conditions', ci, 'crop'), `« ${condition.crop} » apparaît deux fois dans les conditions`)
      }
      seen.add(condition.crop)
      if (condition.crop === m.name) {
        add(at('conditions', ci, 'crop'), 'une mutation ne peut pas être son propre ingrédient')
      } else if (!mutationNames.has(condition.crop) && !baseNames.has(condition.crop)) {
        add(
          at('conditions', ci, 'crop'),
          `crop inconnu : « ${condition.crop} » (ni une mutation, ni un crop de base listé dans baseCrops)`,
        )
      }
    })
    // Les conditions comptent des cases : elles doivent tenir dans l'anneau autour de l'empreinte.
    const ring = ringCellCount(sideOf(m.size))
    if (requiredCells > ring) {
      add(
        at('conditions'),
        `${requiredCells} cases demandées, mais l'anneau autour d'une mutation ${m.size} n'en a que ${ring}`,
      )
    }
    if (m.conditions.length === 0 && m.specialCondition === undefined) {
      add(at('conditions'), 'aucune condition : renseigner conditions ou specialCondition')
    }
    // Règle de spawn sur la grille : cohérente avec la présence de conditions.
    if (m.conditions.length > 0 && m.spawnRule !== undefined && m.spawnRule !== 'conditions') {
      add(at('spawnRule'), `« ${m.spawnRule} » est incompatible avec des conditions de voisinage`)
    }
    if (m.conditions.length === 0 && (m.spawnRule === undefined || m.spawnRule === 'conditions')) {
      add(at('spawnRule'), 'sans conditions, renseigner spawnRule : noAdjacentCrops, requiredEffectsAround ou manual')
    }
    if (m.spawnRule === 'requiredEffectsAround' && m.effects.length === 0) {
      add(at('spawnRule'), 'requiredEffectsAround demande une liste effects non vide')
    }

    m.specialPrerequisites?.forEach((prerequisite, pi) => {
      if (prerequisite.crop === m.name) {
        add(at('specialPrerequisites', pi, 'crop'), 'une mutation ne peut pas être son propre prérequis')
      } else if (!mutationNames.has(prerequisite.crop)) {
        add(at('specialPrerequisites', pi, 'crop'), `mutation inconnue : « ${prerequisite.crop} »`)
      }
    })

    if (m.roseDragonMinimum !== null && m.roseDragonMinimum > m.roseDragonOptimum) {
      add(
        at('roseDragonMinimum'),
        `le minimum (${m.roseDragonMinimum}) dépasse l'optimum (${m.roseDragonOptimum})`,
      )
    }

    m.conflicts?.forEach((conflict, ci) => {
      if (!VERIFIABLE_FIELDS.has(conflict.field)) {
        add(at('conflicts', ci, 'field'), `champ inconnu : « ${conflict.field} » (attendu : ${quoted(VERIFIABLE_FIELDS)})`)
      }
    })

    if (m.harvest) checkHarvest(m, (rest, message) => add(at('harvest', ...rest), message))
  })

  // --- Objectifs ---
  const goalIds = new Set<string>()
  data.goals.forEach((goal, i) => {
    if (goalIds.has(goal.id)) add(['goals', i, 'id'], `id d'objectif en double : « ${goal.id} »`)
    goalIds.add(goal.id)
    for (const name of Object.keys(goal.requires.mutations ?? {})) {
      if (!mutationNames.has(name)) add(['goals', i, 'requires', 'mutations', name], `mutation inconnue : « ${name} »`)
    }
  })

  // --- Bestiary ---
  data.bestiary.forEach((entry, i) => {
    if (entry.mutation !== undefined && !mutationNames.has(entry.mutation)) {
      add(['bestiary', i, 'mutation'], `mutation inconnue : « ${entry.mutation} »`)
    }
    entry.conflicts?.forEach((conflict, ci) => {
      if (!BESTIARY_FIELDS.has(conflict.field)) {
        add(['bestiary', i, 'conflicts', ci, 'field'], `champ inconnu : « ${conflict.field} »`)
      }
    })
  })

  // --- Mutations Sack : toutes les mutations, une seule fois chacune ---
  const sackItems = data.mutationsSack.items
  const missingFromSack = data.mutations.filter((m) => !sackItems.includes(m.name)).map((m) => m.name)
  if (missingFromSack.length > 0) add(['mutationsSack', 'items'], `mutations absentes du sac : ${quoted(missingFromSack)}`)
  const doubles = sackItems.filter((item, index) => sackItems.indexOf(item) !== index)
  if (doubles.length > 0) add(['mutationsSack', 'items'], `objets en double : ${quoted(new Set(doubles))}`)

  // --- Identifiants Hypixel : un par mutation ---
  const itemIds = data.mutations.map((m) => m.itemId)
  const doubleIds = itemIds.filter((id, index) => itemIds.indexOf(id) !== index)
  if (doubleIds.length > 0) add(['mutations'], `itemId en double : ${quoted(new Set(doubleIds))}`)

  // --- Mécaniques : intervalles ---
  const { water, lonelilyRatePerCell } = data.mechanics
  if (water.lossPerStageRange.min > water.lossPerStageRange.max) {
    add(['mechanics', 'water', 'lossPerStageRange'], 'min supérieur à max')
  }
  if (water.levelRange.min > water.levelRange.max) {
    add(['mechanics', 'water', 'levelRange'], 'min supérieur à max')
  }
  if (lonelilyRatePerCell.min > lonelilyRatePerCell.max) {
    add(['mechanics', 'lonelilyRatePerCell'], 'min supérieur à max')
  }
  if (!mutationNames.has(lonelilyRatePerCell.mutation)) {
    add(['mechanics', 'lonelilyRatePerCell', 'mutation'], `mutation inconnue : « ${lonelilyRatePerCell.mutation} »`)
  }

  // --- Upgrades du Greenhouse : un par effet, cohérents avec la formule et les greenhouses ---
  const upgradeIds = new Set<string>()
  const upgradeEffects = new Set<string>()
  data.mechanics.greenhouseUpgrades.items.forEach((upgrade, i) => {
    const at = (...path: PropertyKey[]) => ['mechanics', 'greenhouseUpgrades', 'items', i, ...path]
    if (upgradeIds.has(upgrade.id)) add(at('id'), `id en double : « ${upgrade.id} »`)
    if (upgradeEffects.has(upgrade.effect)) add(at('effect'), `effet déjà utilisé par un autre upgrade : « ${upgrade.effect} »`)
    upgradeIds.add(upgrade.id)
    upgradeEffects.add(upgrade.effect)
    const known = upgrade.tiers.filter((tier): tier is number => tier !== null)
    if (upgrade.effect === 'growthSpeed' && known.length === upgrade.tiers.length) {
      const total = Math.round(known.reduce((sum, tier) => sum + tier, 0) * 1000) / 1000
      const expected = Math.round(data.mechanics.growthStage.formula.upgradesMax * 100 * 1000) / 1000
      if (total !== expected) add(at('tiers'), `total des tiers : ${total} %, alors que growthStage.formula.upgradesMax vaut ${expected} %`)
    }
    if (upgrade.effect === 'plotLimit' && upgrade.tiers.length !== data.mechanics.greenhouse.count - 1) {
      add(at('tiers'), `${upgrade.tiers.length} tiers pour ${data.mechanics.greenhouse.count - 1} greenhouses à acheter`)
    }
  })

  // --- Plans de ferme ---
  const layoutIds = new Set<string>()
  const layoutContext = createLayoutContext(data)
  data.layouts.forEach((layout, i) => {
    if (layoutIds.has(layout.id)) add(['layouts', i, 'id'], `id de plan en double : « ${layout.id} »`)
    layoutIds.add(layout.id)
    for (const layoutIssue of parseLayout(layout, i, layoutContext).issues) add(layoutIssue.path, layoutIssue.message)
  })

  // --- Guide : objectif et plans connus, chapitres uniques ---
  if (!goalIds.has(data.guide.goal)) add(['guide', 'goal'], `objectif inconnu : « ${data.guide.goal} »`)
  const chapterIds = new Set<string>()
  data.guide.sections.forEach((section, s) => {
    section.chapters.forEach((chapter, c) => {
      const at = (...path: PropertyKey[]) => ['guide', 'sections', s, 'chapters', c, ...path]
      if (chapterIds.has(chapter.id)) add(at('id'), `id de chapitre en double : « ${chapter.id} »`)
      chapterIds.add(chapter.id)
      if (!layoutIds.has(chapter.layout)) add(at('layout'), `plan inconnu : « ${chapter.layout} »`)
      if (chapter.minimumLayout !== undefined && !layoutIds.has(chapter.minimumLayout)) {
        add(at('minimumLayout'), `plan inconnu : « ${chapter.minimumLayout} »`)
      }
    })
  })

  // --- Cycles : cherchés seulement si tous les noms sont résolus (sinon messages parasites) ---
  if (issues.length === 0) {
    const cycle = findRecipeCycle(data)
    if (cycle) add(['mutations'], `cycle de recettes : ${cycle.join(' → ')}`)
  }

  return issues
}

/** Contexte de lecture des plans, construit depuis les données brutes (déjà structurellement valides). */
function createLayoutContext(data: RawGameData): LayoutContext {
  const mutationsByName = new Map(data.mutations.map((m) => [m.name, m]))
  const baseNames = new Set(data.baseCrops.map((crop) => crop.name))
  return {
    surfaces: new Set(data.surfaces),
    defaultSurface: data.surfaces[0] ?? '',
    maxWidth: data.mechanics.greenhouse.width,
    maxHeight: data.mechanics.greenhouse.height,
    resolveCrop: (name) => {
      const mutation = mutationsByName.get(name)
      if (mutation) return { kind: 'mutation', id: mutation.id }
      return baseNames.has(name) ? { kind: 'base', name } : null
    },
    sideOf: (crop) => {
      if (crop.kind === 'base') return 1
      const mutation = data.mutations.find((m) => m.id === crop.id)
      return mutation ? sideOf(mutation.size) : 1
    },
  }
}

function reportDuplicates(
  values: readonly string[],
  path: Path,
  label: string,
  add: (path: Path, message: string) => void,
): void {
  const seen = new Set<string>()
  values.forEach((value, i) => {
    if (seen.has(value)) add([...path, i], `${label} en double : « ${value} »`)
    seen.add(value)
  })
}

/** Les stages de récolte doivent être cohérents entre eux et avec le nombre de growth stages. */
function checkHarvest(m: RawMutation, add: (rest: PropertyKey[], message: string) => void): void {
  const harvest = m.harvest
  if (!harvest) return
  const stages = {
    firstStage: harvest.firstStage,
    lastStage: harvest.lastStage,
    recommendedStage: harvest.recommendedStage,
    resetsAfterStage: harvest.resetsAfterStage,
  }
  for (const [key, stage] of Object.entries(stages)) {
    if (stage !== undefined && m.growthStages !== null && stage > m.growthStages) {
      add([key], `stage ${stage} au-delà des ${m.growthStages} growth stages de la mutation`)
    }
  }
  if (harvest.firstStage !== undefined && harvest.lastStage !== undefined && harvest.firstStage > harvest.lastStage) {
    add(['firstStage'], 'firstStage supérieur à lastStage')
  }
}

/** Renvoie un cycle (noms, le premier répété à la fin) dans le graphe des recettes, ou null. */
function findRecipeCycle(data: RawGameData): string[] | null {
  const mutationNames = new Set(data.mutations.map((m) => m.name))
  const ingredients = new Map<string, string[]>()
  for (const m of data.mutations) {
    const names = [...m.conditions.map((c) => c.crop), ...(m.specialPrerequisites ?? []).map((p) => p.crop)]
    ingredients.set(m.name, names.filter((name) => mutationNames.has(name)))
  }

  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []
  const visit = (name: string): string[] | null => {
    state.set(name, 'visiting')
    stack.push(name)
    for (const next of ingredients.get(name) ?? []) {
      const status = state.get(next)
      if (status === 'visiting') return [...stack.slice(stack.indexOf(next)), next]
      if (status === undefined) {
        const cycle = visit(next)
        if (cycle) return cycle
      }
    }
    stack.pop()
    state.set(name, 'done')
    return null
  }

  for (const m of data.mutations) {
    if (!state.has(m.name)) {
      const cycle = visit(m.name)
      if (cycle) return cycle
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Normalisation (les données sont déjà validées ici)
// ---------------------------------------------------------------------------

function normalize(data: RawGameData): GameData {
  const idByName = new Map(data.mutations.map((m) => [m.name, m.id]))
  const rarityRank = new Map(data.rarities.map((rarity, i) => [rarity, i]))

  /** Nom de mutation → id. La validation garantit que le nom existe. */
  const requireId = (name: string): string => {
    const id = idByName.get(name)
    if (id === undefined) throw new Error(`Mutation introuvable après validation : ${name}`)
    return id
  }
  const toCropRef = (name: string): CropRef => {
    const id = idByName.get(name)
    return id === undefined ? { kind: 'base', name } : { kind: 'mutation', id }
  }

  const effects = new Map<string, Effect>(
    Object.entries(data.effects).map(([name, effect]) => [
      name,
      { name, type: effect.type, value: effect.value, stat: effect.stat, amount: effect.amount ?? null },
    ]),
  )

  const mutations = data.mutations.map(
    (m): Mutation => ({
      id: m.id,
      name: m.name,
      itemId: m.itemId,
      rarity: m.rarity,
      rarityRank: rarityRank.get(m.rarity) ?? 0,
      size: m.size,
      side: sideOf(m.size),
      surface: m.surface,
      growthStages: m.growthStages,
      decayDays: m.decayDays,
      needsWater: m.needsWater ?? null,
      conditions: m.conditions.map((c) => ({ crop: toCropRef(c.crop), count: c.count })),
      specialCondition: m.specialCondition ?? null,
      specialPrerequisites: (m.specialPrerequisites ?? []).map((p) => ({
        mutationId: requireId(p.crop),
        count: p.count,
        role: p.role,
      })),
      spawnRule: m.spawnRule ?? 'conditions',
      spawnPriority: m.spawnPriority ?? 0,
      drops: m.drops,
      effects: m.effects,
      notes: m.notes ?? null,
      avrgNotes: m.avrgNotes ?? null,
      harvest: m.harvest ? normalizeHarvest(m.harvest) : null,
      roseDragonOptimum: m.roseDragonOptimum,
      roseDragonMinimum: m.roseDragonMinimum,
      usages: m.usages,
      conflicts: m.conflicts ?? [],
      unverified: unverifiedFields(m),
    }),
  )

  const baseCrops = data.baseCrops.map(
    (crop): BaseCrop => ({
      name: crop.name,
      purchasable: crop.purchasable,
      surface: crop.surface,
      effects: crop.effects,
      effectsVerified: crop.effectsVerified !== false,
      notes: crop.notes ?? null,
    }),
  )

  const goals = data.goals.map(
    (goal): Goal => ({
      id: goal.id,
      name: goal.name,
      type: goal.type,
      npc: goal.npc ?? null,
      description: goal.description ?? null,
      notes: goal.notes ?? null,
      mutations: Object.entries(goal.requires.mutations ?? {}).map(([name, quantity]) => ({
        mutationId: requireId(name),
        quantity,
      })),
      eachMutation: goal.requires.eachMutation ?? null,
      other: goal.requires.other ?? {},
      milestones: goal.requires.milestones ?? [],
      avrgRoute: goal.avrgRoute === true,
      verified: goal.verified,
    }),
  )

  const bestiary = data.bestiary.map(
    (entry): BestiaryEntry => ({
      mob: entry.mob,
      source: entry.source,
      mutationId: entry.mutation === undefined ? null : (idByName.get(entry.mutation) ?? null),
      maxKills: entry.maxKills ?? null,
      // Comme pour les mutations : une valeur absente est à vérifier, au même titre qu'un
      // drapeau maxKillsVerified: false ou qu'un conflit entre sources.
      maxKillsVerified:
        entry.maxKills !== undefined &&
        entry.maxKillsVerified !== false &&
        !(entry.conflicts ?? []).some((c) => c.field === 'maxKills'),
      conflicts: entry.conflicts ?? [],
    }),
  )

  const layouts = data.layouts.flatMap((layout, i) => {
    const { preset } = parseLayout(layout, i, createLayoutContext(data))
    return preset ? [preset] : []
  })
  const layoutsById = new Map(layouts.map((layout) => [layout.id, layout]))

  return {
    meta: {
      description: data._meta.description,
      dataVersion: data._meta.dataVersion,
      sources: data._meta.sources,
    },
    surfaces: data.surfaces,
    rarities: data.rarities,
    effects,
    mechanics: data.mechanics,
    baseCrops,
    baseCropsByName: new Map(baseCrops.map((crop) => [crop.name, crop])),
    mutations,
    mutationsById: new Map(mutations.map((m) => [m.id, m])),
    mutationsByName: new Map(mutations.map((m) => [m.name, m])),
    goals,
    unmappedUsages: data.unmappedUsages,
    layouts,
    guide: {
      goalId: data.guide.goal,
      sections: data.guide.sections.map((section) => ({
        id: section.id,
        title: section.title,
        text: section.text ?? null,
        chapters: section.chapters.flatMap((chapter) => {
          const layout = layoutsById.get(chapter.layout)
          if (!layout) return []
          return [
            {
              id: chapter.id,
              title: chapter.title,
              text: chapter.text ?? null,
              layout,
              minimumLayout: chapter.minimumLayout ? (layoutsById.get(chapter.minimumLayout) ?? null) : null,
              ownPlot: chapter.ownPlot ?? false,
            },
          ]
        }),
      })),
    },
    bestiary,
    mutationsSack: {
      name: data.mutationsSack.name,
      capacity: data.mutationsSack.capacity,
      items: data.mutationsSack.items.map((name) => ({ name, mutationId: idByName.get(name) ?? null })),
    },
  }
}

function normalizeHarvest(harvest: NonNullable<RawMutation['harvest']>): HarvestInfo {
  return {
    firstStage: harvest.firstStage ?? null,
    every: harvest.every ?? null,
    lastStage: harvest.lastStage ?? null,
    recommendedStage: harvest.recommendedStage ?? null,
    resetsAfterStage: harvest.resetsAfterStage ?? null,
    fragments: harvest.fragments ?? null,
  }
}

function isMutationField(field: string): field is MutationField {
  return VERIFIABLE_FIELDS.has(field)
}

/**
 * Champs « à vérifier » d'une mutation, d'où qu'ils viennent :
 * drapeau `<champ>Verified: false`, growthStages inconnu (null) ou conflit entre sources.
 */
function unverifiedFields(m: RawMutation): MutationField[] {
  const flags: Record<MutationField, boolean | undefined> = {
    name: m.nameVerified,
    rarity: m.rarityVerified,
    size: m.sizeVerified,
    surface: m.surfaceVerified,
    growthStages: m.growthStagesVerified,
    conditions: m.conditionsVerified,
    drops: m.dropsVerified,
    effects: m.effectsVerified,
  }
  const fields = new Set<MutationField>()
  for (const field of VERIFIABLE_MUTATION_FIELDS) {
    if (flags[field] === false) fields.add(field)
  }
  if (m.growthStages === null) fields.add('growthStages')
  for (const conflict of m.conflicts ?? []) {
    if (isMutationField(conflict.field)) fields.add(conflict.field)
  }
  return [...fields]
}
