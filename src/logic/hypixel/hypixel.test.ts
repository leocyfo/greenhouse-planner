import { describe, expect, it } from 'vitest'
import { projectData } from '../../test/projectData'
import { inventoryData, nbt, nbtBytes } from '../../test/nbtWriter'
import { readInventoryMutations } from './inventory'
import { parseNbt } from './nbt'

const data = projectData()
const id = (name: string) => data.mutationsByName.get(name)?.id

describe('NBT (format Minecraft)', () => {
  it('lit tous les types courants, listes et compounds imbriqués compris', () => {
    const bytes = nbtBytes({
      octet: nbt.byte(-3),
      court: nbt.short(1200),
      entier: nbt.int(70000),
      long: nbt.long(123456789012n),
      reel: nbt.double(1.5),
      texte: nbt.string('Choconut é'),
      liste: nbt.list(3, [nbt.int(1), nbt.int(2)]),
      tableau: nbt.intArray([7, 8]),
      objet: nbt.compound({ id: nbt.string('CHOCONUT') }),
    })
    expect(parseNbt(bytes)).toEqual({
      octet: -3,
      court: 1200,
      entier: 70000,
      long: 123456789012n,
      reel: 1.5,
      texte: 'Choconut é',
      liste: [1, 2],
      tableau: Int32Array.from([7, 8]),
      objet: { id: 'CHOCONUT' },
    })
  })

  it('refuse des données tronquées ou une longueur incohérente', () => {
    const bytes = nbtBytes({ liste: nbt.list(3, [nbt.int(1), nbt.int(2)]) })
    expect(() => parseNbt(bytes.subarray(0, bytes.length - 3))).toThrow(RangeError)
    const lying = Uint8Array.from(bytes)
    lying.set([0x7f, 0xff, 0xff, 0xff], bytes.indexOf(3) + 1) // la liste annonce 2 milliards d'éléments
    expect(() => parseNbt(lying)).toThrow(RangeError)
  })
})

describe('import d’un profil Hypixel', () => {
  it('additionne sacs, inventaire, ender chest et sacs à dos, et ignore le reste', async () => {
    const inventory = {
      sacks_counts: { CHOCONUT: 10, WHEAT: 500, GLASSCORN: 0 },
      inv_contents: {
        type: 0,
        data: await inventoryData([{ id: 'CHOCONUT', count: 2 }, null, { id: 'GLASSCORN', count: 1 }, { id: 'DIRT', count: 64 }]),
      },
      ender_chest_contents: { type: 0, data: await inventoryData([{ id: 'ASHWREATH', count: 5 }]) },
      backpack_contents: { '0': { type: 0, data: await inventoryData([{ id: 'CHOCONUT', count: 3 }]) } },
    }
    const result = await readInventoryMutations(data, inventory)
    expect(result.mutations).toEqual([
      { mutationId: id('Ashwreath'), total: 5, sources: { enderChest: 5 } },
      { mutationId: id('Choconut'), total: 15, sources: { sacks: 10, inventory: 2, backpacks: 3 } },
      { mutationId: id('Glasscorn'), total: 1, sources: { inventory: 1 } },
    ])
    expect(result.missingSources).toEqual(['vault'])
    expect(result.unreadableSources).toEqual([])
  })

  it('signale une source illisible et un inventaire absent (API désactivée)', async () => {
    const broken = await readInventoryMutations(data, { sacks_counts: {}, inv_contents: { data: 'pas du base64 !' } })
    expect(broken.unreadableSources).toEqual(['inventory'])
    const hidden = await readInventoryMutations(data, null)
    expect(hidden.mutations).toEqual([])
    expect(hidden.missingSources).toEqual(['sacks', 'inventory', 'enderChest', 'backpacks', 'vault'])
  })
})
