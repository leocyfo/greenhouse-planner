import { describe, expect, it } from 'vitest'
import { projectData } from '../../test/projectData'
import { searchMutations } from './searchMutations'

const data = projectData()
const names = (query: string) => searchMutations(data.mutations, query).map((m) => m.name)

describe('recherche d’une mutation', () => {
  it('trouve un nom sans tenir compte des majuscules, des accents ni de la ponctuation', () => {
    expect(names('SNOOZ')).toEqual(['Snoozling'])
    expect(names('do not eat')).toEqual(['Do-not-eat-shroom'])
    expect(names('all in')).toEqual(['All-in Aloe'])
  })

  it('met d’abord les noms qui commencent par la recherche', () => {
    const found = names('shroom')
    expect(found).toContain('Veilshroom')
    const startsFirst = names('s')
    const firstOther = startsFirst.findIndex((name) => !name.toLowerCase().startsWith('s'))
    expect(startsFirst.slice(0, firstOther).every((name) => name.toLowerCase().startsWith('s'))).toBe(true)
    expect(startsFirst.slice(firstOther).every((name) => !name.toLowerCase().startsWith('s'))).toBe(true)
  })

  it('ne propose rien sans recherche', () => {
    expect(names('')).toEqual([])
    expect(names('   ')).toEqual([])
    expect(names('zzz')).toEqual([])
  })
})
