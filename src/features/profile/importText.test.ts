import { describe, expect, it } from 'vitest'
import { isPlayerName, sourceList, sourcesText } from './importText'

describe('import Hypixel : textes', () => {
  it('résume les sources dans leur ordre, sans les vides', () => {
    expect(sourcesText({ backpacks: 3, sacks: 10, inventory: 0 })).toBe('sacs 10 · sacs à dos 3')
    expect(sourceList(['backpacks', 'vault'])).toBe('sacs à dos et coffre personnel')
    expect(sourceList(['sacks', 'inventory', 'enderChest'])).toBe('sacs, inventaire et ender chest')
  })

  it('accepte les pseudos Minecraft valides seulement', () => {
    expect(isPlayerName('Notch_42')).toBe(true)
    expect(isPlayerName('')).toBe(false)
    expect(isPlayerName('pas un pseudo')).toBe(false)
    expect(isPlayerName('a'.repeat(17))).toBe(false)
  })
})
