import { describe, expect, it } from 'vitest'
import { recipeInputs, recipesUsing } from '../../logic/graph'
import { mutationById, projectData } from '../../test/projectData'
import { coloredName, infoLines, ingredientTooltip, spotTooltip, wikiUrl } from './sheetText'

const data = projectData()

describe('fiche « Garden Mutation » : textes', () => {
  it('colore le nom selon la rareté, en blanc pour un crop de base', () => {
    expect(coloredName(data, { kind: 'mutation', id: 'blastberry' })).toBe('§9Blastberry')
    expect(coloredName(data, { kind: 'base', name: 'Melon' })).toBe('§fMelon')
  })

  it('dit quoi faire de chaque ingrédient', () => {
    const blastberry = mutationById(data, 'blastberry')
    const chocoberry = recipeInputs(data, blastberry).find((input) => input.crop.kind === 'mutation' && input.crop.id === 'chocoberry')
    expect(chocoberry && ingredientTooltip(data, chocoberry)).toEqual(['§aChocoberry', '§7À poser autour : §f5', '§eCliquer pour voir sa fiche !'])
    const shellfruit = recipeInputs(data, mutationById(data, 'shellfruit'))
    expect(shellfruit.map((input) => ingredientTooltip(data, input)[1])).toEqual([
      '§7Consommé : §f1 §7par mutation faite',
      '§7Catalyseur : §f2 §7(pas consommé)',
    ])
    expect(spotTooltip(data, blastberry)).toContain('§7Sol : §fSand')
  })

  it('réunit les infos en lignes courtes : drops, effets, usages, route AVRG, notes', () => {
    const blastberry = mutationById(data, 'blastberry')
    const lines = infoLines(data, blastberry, { stateLabel: 'Verrouillée', usedIn: recipesUsing(data, 'blastberry'), goals: [], bestiary: [] })
    expect(lines[0]).toBe('§9§lRARE MUTATION')
    expect(lines).toContain('§f1 200 §7Cocoa Beans'.replace(' ', '\u202f'))
    expect(lines.some((line) => line.startsWith('§5Shellfruit'))).toBe(true)
    expect(lines.some((line) => line.includes('Optimum 7'))).toBe(true)
    expect(lines.some((line) => line.startsWith('§6Guide AVRG'))).toBe(true)
  })

  it('ouvre la recherche du wiki sur le nom', () => {
    expect(wikiUrl('All-in Aloe')).toBe('https://hypixel-skyblock.fandom.com/wiki/Special:Search?query=All-in%20Aloe&go=Go')
  })
})
