import { describe, expect, it } from 'vitest'
import { analyzeGrid } from '../../logic/grid'
import { LOCKED_GROUND } from '../../logic/ground'
import { projectData } from '../../test/projectData'
import type { LayoutPreset } from '../../types/game'
import { emptyGrid, farmMask, farmsIn, farmsName, fitFarm, isGuideOnly, ownPlotOf, packFarms, withFarm } from './farmPacking'

const data = projectData()
const preset = (id: string): LayoutPreset => {
  const found = data.layouts.find((layout) => layout.id === id)
  if (!found) throw new Error(`plan inconnu : ${id}`)
  return found
}
const ownPlot = ownPlotOf(data)
const pack = (ids: string[], grid = emptyGrid(data)) => packFarms(data, grid, ids.map(preset), farmsIn(data, grid), ownPlot)

describe('plusieurs fermes dans un greenhouse', () => {
  it('ne compte que les cases utiles d’une ferme (Devourer : 4 x 4 dans un plan de 10 x 10)', () => {
    expect(farmMask(data, preset('avrg_devourer'))).toHaveLength(16)
    expect(farmMask(data, preset('avrg_cheesebite'))).toHaveLength(25)
  })

  it('range les quatre fermes légendaires dans un seul greenhouse, comme le guide AVRG', () => {
    const result = pack(['avrg_all_in_aloe', 'avrg_devourer', 'avrg_glasscorn', 'avrg_timestalk_phantomleaf'])
    expect(result.rest).toEqual([])
    expect(farmsIn(data, result.grid).map((farm) => farm.chapter.id).sort()).toEqual(['all_in_aloe', 'devourer', 'glasscorn', 'timestalk_phantomleaf'])
  })

  it('range quatre fermes 5 x 5 ensemble, et chacune fait toujours spawn ses mutations', () => {
    const result = pack(['avrg_cheesebite', 'avrg_chloronite', 'avrg_startlevine', 'avrg_zombud'])
    expect(result.rest).toEqual([])
    const analysis = analyzeGrid(data, result.grid)
    for (const farm of result.added) {
      for (const spot of farm.preset.spots) {
        const ids = analysis.cells[(spot.y + farm.dy) * result.grid.width + spot.x + farm.dx]?.mutationIds ?? []
        expect(ids).toEqual(expect.arrayContaining([...spot.expect]))
      }
    }
    expect(farmsName(result.added)).toBe('Cheesebite + Chloronite + Startlevine + Zombud')
  })

  it('une ferme sur toute la parcelle ne laisse de place à aucune autre', () => {
    const result = pack(['avrg_first_big_farm', 'avrg_cheesebite'])
    expect(result.added.map((farm) => farm.preset.id)).toEqual(['avrg_first_big_farm'])
    expect(result.rest.map((p) => p.id)).toEqual(['avrg_cheesebite'])
  })

  it('le Chorus Fruit reste seul sur son greenhouse (End Stone)', () => {
    expect(pack(['avrg_chorus_fruit', 'avrg_cheesebite']).rest.map((p) => p.id)).toEqual(['avrg_cheesebite'])
    expect(pack(['avrg_cheesebite', 'avrg_chorus_fruit']).rest.map((p) => p.id)).toEqual(['avrg_chorus_fruit'])
  })

  it('ajoute une ferme à côté d’une ferme déjà posée, sans toucher à ses cases', () => {
    const first = pack(['avrg_blastberry_opt'])
    const second = pack(['avrg_magic_jellybean'], first.grid)
    expect(second.rest).toEqual([])
    expect(farmsIn(data, second.grid).map((farm) => farm.preset.id).sort()).toEqual(['avrg_blastberry_opt', 'avrg_magic_jellybean'])
    expect(isGuideOnly(data, second.grid)).toBe(true)
  })

  it('évite les cases verrouillées du greenhouse', () => {
    const grid = emptyGrid(data)
    const locked = { ...grid, ground: grid.ground.map((ground, cell) => (cell % grid.width < 5 ? LOCKED_GROUND : ground)) }
    const farm = fitFarm(data, locked, preset('avrg_cheesebite'), [])
    expect(farm).not.toBeNull()
    expect(farm && farm.dx).toBeGreaterThanOrEqual(5)
    expect(fitFarm(data, locked, preset('avrg_blastberry_opt'), [])).toBeNull()
  })

  it('reconnaît les fermes d’un plan, et un plan qui a d’autres crops', () => {
    const grid = withFarm(data, emptyGrid(data), { preset: preset('avrg_chloronite'), dx: 5, dy: 5 })
    expect(farmsIn(data, grid).map((farm) => [farm.chapter.id, farm.dx, farm.dy])).toEqual([['chloronite', 5, 5]])
    const mixed = { ...grid, placements: [...grid.placements, { crop: { kind: 'base' as const, name: 'Wheat' }, x: 0, y: 0 }] }
    expect(isGuideOnly(data, mixed)).toBe(false)
  })
})
