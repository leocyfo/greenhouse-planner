import { describe, expect, it } from 'vitest'
import { upgradeByEffect } from '../../logic/upgrades'
import { projectData } from '../../test/projectData'
import { tierLabel, tierTooltip, upgradeTooltip, upgradeValue } from './upgradeText'

const data = projectData()

function upgrade(effect: 'growthSpeed' | 'plantYield' | 'plotLimit') {
  const found = upgradeByEffect(data, effect)
  if (!found) throw new Error(`upgrade manquant : ${effect}`)
  return found
}

describe('menu Greenhouse Upgrades : textes', () => {
  it('affiche le bonus total, ou un minimum quand des tiers sont inconnus', () => {
    expect(upgradeValue(upgrade('growthSpeed'), 9)).toBe('50 %')
    expect(upgradeValue(upgrade('plantYield'), 4)).toBe('8 %')
    expect(upgradeValue(upgrade('plantYield'), 6)).toBe('au moins 8 %')
    expect(upgradeValue(upgrade('plotLimit'), 2)).toBe('+2')
  })

  it("reprend l'infobulle du jeu, avec ses couleurs", () => {
    const plotLimit = upgrade('plotLimit')
    expect(upgradeTooltip(plotLimit, 2)).toEqual([
      '§aPlot Limit',
      `§7${plotLimit.description}`,
      '',
      '§7Tier actuel : §a2/2',
      '§7Plot Limit : §a+2',
      '',
      '§eCliquer pour voir !',
    ])
    // Plus de badge « à vérifier » dans les infobulles (demande du joueur).
    expect(upgradeTooltip(upgrade('growthSpeed'), 9).join(' ')).not.toContain('vérifier')
  })

  it('décrit chaque tier : bonus, état et action du clic', () => {
    expect(tierTooltip(upgrade('growthSpeed'), 9, 9, 'unlocked')).toEqual([
      '§aGrowth Speed IX',
      '§b+10 % Growth Speed',
      '',
      '§a§lDÉBLOQUÉ',
      '§7Cliquer pour le retirer',
    ])
    expect(tierTooltip(upgrade('plantYield'), 6, 4, 'locked')).toEqual([
      '§cPlant Yield VI',
      '§8Bonus inconnu',
      '',
      '§c§lVERROUILLÉ',
      "§eCliquer pour débloquer jusqu'ici",
    ])
    expect(tierLabel(upgrade('plantYield'), 5, 'next')).toBe('Plant Yield V : bonus inconnu, prochain tier')
  })
})
