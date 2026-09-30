import { describe, expect, it } from 'vitest'
import { isPlayerName, readAgeText, sourceList, sourcesText } from './importText'

describe('import Hypixel : textes', () => {
  it('résume les sources dans leur ordre, sans les vides', () => {
    expect(sourcesText({ backpacks: 3, sacks: 10, inventory: 0 })).toBe('sacs 10 · sacs à dos 3')
    expect(sourceList(['backpacks', 'vault'])).toBe('sacs à dos et coffre personnel')
    expect(sourceList(['sacks', 'inventory', 'enderChest'])).toBe('sacs, inventaire et ender chest')
  })

  it('dit depuis quand le profil a été lu sur Hypixel (le serveur le garde 5 minutes)', () => {
    const minute = 60_000
    expect([-5_000, 59_000, 4 * minute, 59 * minute, 60 * minute, 150 * minute].map(readAgeText)).toEqual([
      "à l'instant",
      "à l'instant",
      'il y a 4 min',
      'il y a 59 min',
      'il y a 1 h',
      'il y a 2 h',
    ])
  })

  it('accepte les pseudos Minecraft valides seulement', () => {
    expect(isPlayerName('Notch_42')).toBe(true)
    expect(isPlayerName('')).toBe(false)
    expect(isPlayerName('pas un pseudo')).toBe(false)
    expect(isPlayerName('a'.repeat(17))).toBe(false)
  })
})
