import { describe, expect, it } from 'vitest'
import { ringCellCount } from '../logic/footprint'
import type { DataIssue, GameData, Mutation } from '../types/game'
import { loadGameData } from './load'
import raw from './mutations.json'
import type { RawGameData, RawMutation } from './schema'

function loadProjectData(): GameData {
  const result = loadGameData(raw)
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.path} : ${issue.message}`).join('\n'))
  }
  return result.data
}

function mutation(data: GameData, id: string): Mutation {
  const found = data.mutationsById.get(id)
  if (!found) throw new Error(`Mutation introuvable : ${id}`)
  return found
}

describe('mutations.json du projet', () => {
  const data = loadProjectData()

  it('passe toutes les validations', () => {
    const result = loadGameData(raw)
    expect(result.ok ? [] : result.issues).toEqual([])
  })

  it('contient 40 mutations, 12 effets, 17 crops de base et 6 objectifs', () => {
    expect(data.mutations).toHaveLength(40)
    expect(data.effects.size).toBe(12)
    expect(data.baseCrops).toHaveLength(17)
    expect(data.goals).toHaveLength(6)
    expect(new Set(data.mutations.map((m) => m.id)).size).toBe(40)
  })

  it('résout les conditions en mutations (par id) ou en crops de base (par nom)', () => {
    expect(mutation(data, 'chocoberry').conditions).toEqual([
      { crop: { kind: 'mutation', id: 'choconut' }, count: 6 },
      { crop: { kind: 'mutation', id: 'gloomgourd' }, count: 2 },
    ])
    expect(mutation(data, 'ashwreath').conditions).toEqual([
      { crop: { kind: 'base', name: 'Nether Wart' }, count: 2 },
      { crop: { kind: 'base', name: 'Fire' }, count: 2 },
    ])
  })

  it("remplit exactement l'anneau des mutations multi-cases (les conditions comptent des cases)", () => {
    for (const id of ['noctilume', 'snoozling', 'plantboy_advance', 'glasscorn']) {
      const m = mutation(data, id)
      const cells = m.conditions.reduce((sum, c) => sum + c.count, 0)
      expect(cells, id).toBe(ringCellCount(m.side))
    }
    expect(mutation(data, 'snoozling').side).toBe(3)
    expect(ringCellCount(3)).toBe(16)
  })

  it('marque les champs à vérifier : drapeaux, valeurs inconnues et conflits', () => {
    expect(mutation(data, 'soggybud').unverified).toEqual(['growthStages'])
    expect(mutation(data, 'turtlellini').unverified).toEqual(['name', 'rarity'])
    expect(mutation(data, 'jerryflower').unverified).toEqual(['growthStages'])
    // growthStages: null = inconnu
    expect(mutation(data, 'devourer').growthStages).toBeNull()
    expect(mutation(data, 'devourer').unverified).toEqual(['growthStages'])
    expect(mutation(data, 'dustgrain').unverified).toEqual([])
  })

  it('chiffre les effets : amount en %, négatif pour un malus, null sans valeur', () => {
    expect(data.effects.get('Harvest Boost')).toMatchObject({ stat: 'yield', amount: 20 })
    expect(data.effects.get('Water Drain')).toMatchObject({ type: 'negative', stat: 'water', amount: -30 })
    expect(data.effects.get('Immunity')).toMatchObject({ stat: 'immunity', amount: null })
  })

  it('résout les prérequis spéciaux du Shellfruit', () => {
    expect(mutation(data, 'shellfruit').specialPrerequisites).toEqual([
      { mutationId: 'turtlellini', count: 1, role: 'consumed' },
      { mutationId: 'blastberry', count: 2, role: 'catalyst' },
    ])
  })

  it('normalise les objectifs : quantités consommées, null = inconnue', () => {
    const [roseDragon, analyzeAll, sunsGrasp] = data.goals
    expect(roseDragon?.mutations).toEqual([
      { mutationId: 'glasscorn', quantity: 1 },
      { mutationId: 'devourer', quantity: 1 },
      { mutationId: 'all_in_aloe', quantity: 1 },
      { mutationId: 'phantomleaf', quantity: 1 },
      { mutationId: 'timestalk', quantity: 1 },
    ])
    expect(roseDragon?.other).toEqual({ Coins: 500000000, Copper: 20000, 'Condensed Helianthus': 5 })
    expect(analyzeAll?.eachMutation).toBe(1)
    expect(sunsGrasp?.mutations).toEqual([{ mutationId: 'godseed', quantity: null }])
  })

  it('range les raretés de Common (0) à Legendary (4)', () => {
    expect(mutation(data, 'lonelily').rarityRank).toBe(0)
    expect(mutation(data, 'glasscorn').rarityRank).toBe(4)
  })

  it('garde les minimums AVRG inférieurs ou égaux aux optimums', () => {
    for (const m of data.mutations) {
      if (m.roseDragonMinimum !== null) expect(m.roseDragonMinimum, m.id).toBeLessThanOrEqual(m.roseDragonOptimum)
    }
  })

  it('marque le bestiary du Timestalk Clone à vérifier (10 kills contre 20 chez AVRG)', () => {
    const clone = data.bestiary.find((entry) => entry.mob === 'Timestalk Clone')
    expect(clone).toMatchObject({ maxKills: 10, maxKillsVerified: false })
    expect(clone?.conflicts[0]?.value).toBe(20)
  })

  it('relie chaque entrée du bestiary à sa mutation', () => {
    expect(data.bestiary.map((entry) => [entry.mob, entry.mutationId])).toEqual([
      ['Timestalk Clone', 'timestalk'],
      ['Zombuddy', 'zombud'],
      ['Rat', 'cheesebite'],
    ])
  })

  it('marque à vérifier un bestiary sans nombre de kills', () => {
    expect(data.bestiary.find((entry) => entry.mob === 'Zombuddy')).toMatchObject({ maxKills: null, maxKillsVerified: false })
  })
})

describe('validation de données invalides', () => {
  /** Copie modifiable du JSON du projet. */
  function rawCopy(): RawGameData {
    return structuredClone(raw) as unknown as RawGameData
  }

  function rawMutation(data: RawGameData, id: string): RawMutation {
    const found = data.mutations.find((m) => m.id === id)
    if (!found) throw new Error(`Mutation introuvable : ${id}`)
    return found
  }

  /** Charge des données modifiées et renvoie les problèmes trouvés. */
  function issuesAfter(change: (data: RawGameData) => void): readonly DataIssue[] {
    const data = rawCopy()
    change(data)
    const result = loadGameData(data)
    if (result.ok) throw new Error('Les données modifiées auraient dû être refusées')
    return result.issues
  }

  it('signale un crop inconnu dans les conditions, avec un chemin lisible', () => {
    const issues = issuesAfter((data) => {
      const condition = rawMutation(data, 'dustgrain').conditions[0]
      if (condition) condition.crop = 'Whaet'
    })
    expect(issues).toEqual([
      {
        path: 'mutations[dustgrain].conditions[Whaet].crop',
        message: 'crop inconnu : « Whaet » (ni une mutation, ni un crop de base listé dans baseCrops)',
      },
    ])
  })

  it('signale un effet inconnu', () => {
    const issues = issuesAfter((data) => {
      rawMutation(data, 'dustgrain').effects.push('Super Boost')
    })
    expect(issues[0]?.message).toBe('effet inconnu : « Super Boost »')
  })

  it('signale une surface inconnue', () => {
    const issues = issuesAfter((data) => {
      rawMutation(data, 'dustgrain').surface = 'Grass'
    })
    expect(issues[0]?.path).toBe('mutations[dustgrain].surface')
  })

  it("signale des conditions qui ne tiennent pas dans l'anneau", () => {
    const issues = issuesAfter((data) => {
      rawMutation(data, 'dustgrain').conditions.push({ crop: 'Carrot', count: 7 })
    })
    expect(issues[0]?.message).toBe("9 cases demandées, mais l'anneau autour d'une mutation 1x1 n'en a que 8")
  })

  it('signale un cycle de recettes', () => {
    const issues = issuesAfter((data) => {
      rawMutation(data, 'choconut').conditions.push({ crop: 'Chocoberry', count: 1 })
    })
    expect(issues[0]?.message).toBe('cycle de recettes : Choconut → Chocoberry → Choconut')
  })

  it('signale un id en double', () => {
    const issues = issuesAfter((data) => {
      rawMutation(data, 'choconut').id = 'dustgrain'
    })
    expect(issues.some((issue) => issue.message === 'id en double : « dustgrain »')).toBe(true)
  })

  it('signale un champ obligatoire manquant (schéma)', () => {
    const issues = issuesAfter((data) => {
      delete (rawMutation(data, 'dustgrain') as { surface?: string }).surface
    })
    expect(issues[0]?.path).toBe('mutations[dustgrain].surface')
  })

  it('signale une clé inconnue, souvent une faute de frappe', () => {
    const issues = issuesAfter((data) => {
      Object.assign(rawMutation(data, 'dustgrain'), { growthStage: 3 })
    })
    expect(issues[0]?.path).toBe('mutations[dustgrain]')
    expect(issues[0]?.message).toContain('growthStage')
  })

  it('signale une mutation sans condition ni specialCondition', () => {
    const issues = issuesAfter((data) => {
      rawMutation(data, 'dustgrain').conditions = []
    })
    expect(issues[0]?.message).toBe('aucune condition : renseigner conditions ou specialCondition')
  })

  it("signale un minimum AVRG supérieur à l'optimum", () => {
    const issues = issuesAfter((data) => {
      rawMutation(data, 'dustgrain').roseDragonMinimum = 99
    })
    expect(issues[0]?.path).toBe('mutations[dustgrain].roseDragonMinimum')
  })

  it('signale un objectif qui vise une mutation inconnue', () => {
    const issues = issuesAfter((data) => {
      const goal = data.goals[0]
      if (goal) goal.requires.mutations = { Glascorn: 1 }
    })
    expect(issues).toEqual([
      { path: 'goals[rose_dragon].requires.mutations.Glascorn', message: 'mutation inconnue : « Glascorn »' },
    ])
  })

  it('signale une mutation inconnue dans le bestiary', () => {
    const issues = issuesAfter((data) => {
      const entry = data.bestiary[0]
      if (entry) entry.mutation = 'Timestalc'
    })
    expect(issues).toEqual([{ path: 'bestiary[Timestalk Clone].mutation', message: 'mutation inconnue : « Timestalc »' }])
  })

  it('signale un prérequis spécial inconnu', () => {
    const issues = issuesAfter((data) => {
      const prerequisite = rawMutation(data, 'shellfruit').specialPrerequisites?.[0]
      if (prerequisite) prerequisite.crop = 'Turtle'
    })
    expect(issues[0]?.message).toBe('mutation inconnue : « Turtle »')
  })

  it("signale un amount dont le signe contredit le type de l'effet", () => {
    const issues = issuesAfter((data) => {
      const effect = data.effects['Harvest Boost']
      if (effect) effect.amount = -20
    })
    expect(issues[0]?.path).toBe('effects["Harvest Boost"].amount')
  })
})
