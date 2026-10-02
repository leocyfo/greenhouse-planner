import { describe, expect, it } from 'vitest'
import { BROKEN_GROUND, LOCKED_GROUND } from '../../logic/ground'
import { projectData } from '../../test/projectData'
import { analyzeGrid } from '../../logic/grid'
import { gridFrom } from '../../test/grids'
import { buildShortLabels, cellName, groundLabel, gridSummary, gridSummaryText } from './gridText'

const data = projectData()
const names = [...data.mutations.map((m) => m.name), ...data.baseCrops.map((c) => c.name)]

describe('textes de la grille', () => {
  it('donne une abréviation unique et courte à chaque crop', () => {
    const labels = buildShortLabels(names)
    const values = [...labels.values()]
    expect(new Set(values).size).toBe(names.length)
    expect(Math.max(...values.map((v) => v.length))).toBeLessThanOrEqual(6)
    expect(labels.get('Nether Wart')).toBe('NW')
    expect(labels.get('Magic Jellybean')).toBe('MJ')
    expect(labels.get('Duskbloom')).toBe('Dusk')
    expect(labels.get('Dustgrain')).toBe('Dust')
    expect(labels.get('Chocoberry')).not.toBe(labels.get('Choconut'))
  })

  it('nomme les cases comme un tableur et les sols spéciaux en clair', () => {
    expect(cellName(0, 0)).toBe('A1')
    expect(cellName(9, 9)).toBe('J10')
    expect(groundLabel('Sand')).toBe('Sand')
    expect(groundLabel(BROKEN_GROUND)).toBe('Bloc cassé')
    expect(groundLabel(LOCKED_GROUND)).toBe('Case verrouillée')
  })

  it('fait le bilan de la grille : crops posés, emplacements de spawn, conflits', () => {
    const empty = gridFrom(data, ['...', '...', '...'])
    expect(gridSummaryText(gridSummary(data, empty, analyzeGrid(data, empty)))).toBe('0 crop posé · aucun emplacement de spawn')
    // 2 Nether Wart et 2 Fire autour du centre (Soul Sand) : un emplacement d'Ashwreath.
    const ashwreath = gridFrom(data, ['.N.', 'FsF', '.N.'], { N: 'Nether Wart', F: 'Fire', s: { surface: 'Soul Sand' } })
    const summary = gridSummary(data, ashwreath, analyzeGrid(data, ashwreath))
    expect(summary.crops).toBe(4)
    expect(summary.spots).toBeGreaterThanOrEqual(1)
    expect(gridSummaryText(summary)).toMatch(/^4 crops posés · \d+ emplacements? de spawn \(\d+ mutations?\)/)
  })
})
