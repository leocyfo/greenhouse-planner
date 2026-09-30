import { describe, expect, it } from 'vitest'
import { layoutColumns, packColumn, type LayoutColumn } from './treeLayout'

const column = (ids: readonly string[]): LayoutColumn => ({ ids, width: 100, height: 40, gap: 10 })

describe('disposition en colonnes', () => {
  it('place chaque nœud au plus près de son souhait, sans changer l’ordre ni rapprocher deux nœuds', () => {
    expect(packColumn([0, 100, 200], [50, 50])).toEqual([0, 100, 200])
    // Deux souhaits trop proches : écartés autour de leur milieu.
    expect(packColumn([100, 100], [50])).toEqual([75, 125])
    // Un souhait qui inverserait l'ordre : les deux se partagent l'écart.
    expect(packColumn([200, 0], [50])).toEqual([75, 125])
  })

  it('réordonne une colonne pour supprimer un croisement', () => {
    const layout = layoutColumns(
      [column(['a', 'b']), column(['c', 'd'])],
      [
        { id: 'a-d', source: 'a', target: 'd' },
        { id: 'b-c', source: 'b', target: 'c' },
      ],
      { top: 0, columnGap: 50 },
    )
    const y = (id: string) => layout.positions.get(id)?.y ?? Number.NaN
    expect(Math.sign(y('a') - y('b'))).toBe(Math.sign(y('d') - y('c')))
  })

  it('fait passer un lien qui saute une colonne entre les cartes, en ligne droite', () => {
    const layout = layoutColumns(
      [column(['a']), column(['m', 'n']), column(['z'])],
      [
        { id: 'a-m', source: 'a', target: 'm' },
        { id: 'a-n', source: 'a', target: 'n' },
        { id: 'a-z', source: 'a', target: 'z' },
      ],
      { top: 20, columnGap: 50 },
    )
    const path = layout.paths.get('a-z') ?? ''
    const lane = /L(\S+) (\S+)$/.exec(path.split('C').slice(0, -1).join('C'))
    const laneY = Number(lane?.[2])
    for (const id of ['m', 'n']) {
      const top = layout.positions.get(id)?.y ?? 0
      expect(laneY < top || laneY > top + 40, id).toBe(true)
    }
    expect(layout.columnX).toEqual([0, 150, 300])
    expect(Math.min(...[...layout.positions.values()].map((p) => p.y))).toBeGreaterThanOrEqual(20)
  })
})
