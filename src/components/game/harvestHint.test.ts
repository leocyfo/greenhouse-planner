import { describe, expect, it } from 'vitest'
import { mutationById, projectData } from '../../test/projectData'
import { harvestHint } from './harvestHint'

const data = projectData()
const hint = (id: string) => harvestHint(mutationById(data, id))

describe('indication de récolte', () => {
  it('explique les récoltes avant la fin de la croissance', () => {
    expect(hint('magic_jellybean')).toBe(
      'Récoltable dès le stage 12, puis tous les 12 stages, récolte conseillée par AVRG au stage 36.',
    )
    expect(hint('glasscorn')).toBe('Récoltable du stage 7 au stage 8, repart au stage 1 après le stage 8.')
    expect(hint('all_in_aloe')).toBe(
      'Récolte conseillée par AVRG au stage 6 (4 fragments ; 9 fragments = 1 mutation).',
    )
    expect(hint('chocoberry')).toBeNull()
  })
})
