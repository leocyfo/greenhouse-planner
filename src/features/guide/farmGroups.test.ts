import { describe, expect, it } from 'vitest'
import { projectData } from '../../test/projectData'
import { farmGroups } from './farmGroups'
import { guideGoalIds, guideScope } from './guideScope'

const data = projectData()
const chapters = data.guide.sections.flatMap((section) => section.chapters)
const numbers = new Map(chapters.map((chapter, index) => [chapter.id, index + 1]))
const groupsOf = (guide: string) => {
  const scope = guideScope(data, guideGoalIds(data, guide), new Set())
  return farmGroups(data, chapters.filter((chapter) => scope.chapterIds.has(chapter.id))).map((group) => group.map((chapter) => numbers.get(chapter.id)))
}

describe('fermes qui se font en même temps', () => {
  it('Rose Dragon : 7 + 8 + 9, 10 + 11, 13 + 14 (demande du joueur), et les 4 légendaires sur un plot', () => {
    expect(groupsOf('rose_dragon')).toEqual([[1, 2], [3], [4], [5], [6], [7, 8, 9], [10, 11], [12], [13, 14], [15], [16], [17, 18, 19, 20]])
  })

  it('ne réunit pas une ferme qui attend ce qu’une autre du groupe fait, ni Chorus Fruit, ni les étapes du Snoozling Complex', () => {
    const groups = groupsOf('rose_dragon')
    // First Big Farm pose des Gloomgourd : pas avec la ferme de Gloomgourd.
    expect(groups.find((group) => group.includes(3))).toEqual([3])
    expect(groups.find((group) => group.includes(12))).toEqual([12])
    expect(groups.find((group) => group.includes(15))).toEqual([15])
  })

  it('suit les fermes du guide affiché', () => {
    expect(groupsOf('mutation_sacks')).toEqual([[1, 2], [3], [5]])
  })
})
