import { describe, expect, it } from 'vitest'
import { projectData } from '../test/projectData'
import { plantingPreview } from './plantingPreview'

const data = projectData()
const mutation = (name: string) => {
  const found = data.mutationsByName.get(name)
  if (!found) throw new Error(`Mutation introuvable : ${name}`)
  return found
}

describe("aperçu de plantation d'une fiche", () => {
  it('trouve un exemple vérifié pour chaque mutation qui spawn sur la grille', () => {
    for (const m of data.mutations) {
      const preview = plantingPreview(data, m)
      if (m.spawnRule === 'manual' || m.spawnRule === 'requiredEffectsAround') expect(preview, m.name).toBeNull()
      else expect(preview, m.name).not.toBeNull()
    }
  })

  it('place les ingrédients sur les côtés, au plus près : Choconut au centre de 5 x 5', () => {
    const preview = plantingPreview(data, mutation('Choconut'))
    expect(preview).toMatchObject({ width: 5, height: 5, target: { x: 2, y: 2, side: 1 } })
    expect(preview?.placements).toEqual([
      { crop: { kind: 'base', name: 'Cocoa Beans' }, x: 2, y: 1 },
      { crop: { kind: 'base', name: 'Cocoa Beans' }, x: 1, y: 2 },
    ])
  })

  it('pose les mutations 3x3 et 2x2 le long de l’emplacement (Stoplight Petal)', () => {
    const preview = plantingPreview(data, mutation('Stoplight Petal'))
    const names = preview?.placements.map((p) => (p.crop.kind === 'mutation' ? p.crop.id : p.crop.name))
    expect(preview).toMatchObject({ width: 8, height: 8 })
    expect(names?.filter((id) => id === mutation('Snoozling').id)).toHaveLength(2)
    expect(names?.filter((id) => id === mutation('Noctilume').id)).toHaveLength(2)
  })

  it('laisse l’anneau vide pour la Lonelily', () => {
    expect(plantingPreview(data, mutation('Lonelily'))?.placements).toEqual([])
  })
})
