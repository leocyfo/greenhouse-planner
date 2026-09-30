import { describe, expect, it } from 'vitest'
import { mutationById, projectData } from '../../test/projectData'
import { sackHelpTooltip, sackLabel, sackTooltip, untrackedTooltip } from './sackText'

const data = projectData()
const dustgrain = mutationById(data, 'dustgrain')
const need = { mutationId: 'dustgrain', required: 11, owned: 3, missing: 8, buy: false, basis: 'computed' as const, level: 1, sources: [] }

describe('Mutations Sack : données', () => {
  it("contient les 40 mutations dans l'ordre du jeu, plus les objets non suivis", () => {
    const tracked = data.mutationsSack.items.filter((item) => item.mutationId !== null)
    expect(tracked).toHaveLength(40)
    expect(data.mutationsSack.items.map((item) => item.name).slice(0, 3)).toEqual(['All-in Aloe', 'All-in Aloe Fragment', 'Ashwreath'])
    expect(data.mutationsSack.items.filter((item) => item.mutationId === null).map((item) => item.name)).toEqual([
      'All-in Aloe Fragment',
      'Dead Plant',
    ])
  })
})

describe('Mutations Sack : textes', () => {
  it("résume la mutation dans l'infobulle, couleur de rareté comprise", () => {
    expect(sackTooltip({ mutation: dustgrain, owned: 3, need, analyzed: true })).toEqual([
      '§fDustgrain',
      '§8Common · 1x1 · sol Dirt',
      '',
      '§7En stock : §a3',
      '§7Besoin : §e3 / 11 §c(manque 8)',
      '§7Analysée : §aoui',
      '',
      '§eCliquer pour voir !',
    ])
  })

  it('donne un nom accessible complet', () => {
    expect(sackLabel({ mutation: dustgrain, owned: 0, need: undefined, analyzed: false })).toBe(
      'Dustgrain : 0 en stock, pas demandée par tes objectifs, pas analysée. Ouvrir la fiche.',
    )
  })

  it('explique les objets non suivis et les repères du sac', () => {
    expect(untrackedTooltip('Dead Plant')[0]).toBe('§fDead Plant')
    expect(sackHelpTooltip(data.mutationsSack)).toContain(`§7Large : §a${(1024).toLocaleString('fr-FR')} §7de chaque objet`)
  })
})
