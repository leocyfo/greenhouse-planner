import { describe, expect, it } from 'vitest'
import { projectData } from '../test/projectData'
import { FALLBACK_COLOR, RARITY_COLORS, SOIL_COLORS, soilBackground, soilColor } from './palette'

const data = projectData()

describe('palette', () => {
  it('a une couleur pour chaque rareté du JSON', () => {
    for (const rarity of data.rarities) expect(RARITY_COLORS[rarity], rarity).toBeDefined()
  })

  it('a une couleur pour chaque sol du JSON', () => {
    for (const surface of data.surfaces) expect(SOIL_COLORS[surface], surface).toBeDefined()
  })

  it('utilise des couleurs toutes différentes', () => {
    const rarityColors = Object.values(RARITY_COLORS)
    const soilColors = Object.values(SOIL_COLORS)
    expect(new Set(rarityColors).size).toBe(rarityColors.length)
    expect(new Set(soilColors).size).toBe(soilColors.length)
  })

  it('pose la texture du wiki sur la couleur du sol, ou la couleur seule sans texture', () => {
    expect(soilBackground('Sand')).toMatch(/^url\(".+"\) center \/ 100% 100% no-repeat, #f0cf7a$/)
    expect(soilBackground('Sol inconnu')).toBe(soilColor('Sol inconnu'))
    expect(soilColor('Sol inconnu')).toBe(FALLBACK_COLOR)
  })
})
