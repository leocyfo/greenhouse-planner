/**
 * Mutations d'un profil SkyBlock, depuis l'inventaire d'un joueur tel que le renvoie l'API
 * Hypixel (members[uuid].inventory) : sacs (`sacks_counts`), inventaire, ender chest, sacs à dos
 * et coffre personnel. Les contenus sont du NBT compressé en gzip puis encodé en base64 ; chaque
 * objet porte son identifiant Hypixel dans tag.ExtraAttributes.id (ex. CHOCONUT).
 */
import type { GameData } from '../../types/game'
import { isNbtCompound, parseNbt } from './nbt'

export type InventorySource = 'sacks' | 'inventory' | 'enderChest' | 'backpacks' | 'vault'

export interface ImportedMutation {
  readonly mutationId: string
  readonly total: number
  /** Quantité trouvée dans chaque source. */
  readonly sources: Readonly<Partial<Record<InventorySource, number>>>
}

export interface InventoryImport {
  /** Mutations trouvées (au moins un exemplaire), dans l'ordre des données. */
  readonly mutations: readonly ImportedMutation[]
  /** Sources absentes du profil : l'API correspondante est sans doute désactivée en jeu. */
  readonly missingSources: readonly InventorySource[]
  /** Sources présentes mais illisibles (données abîmées). */
  readonly unreadableSources: readonly InventorySource[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function base64Bytes(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Objets d'un contenu d'inventaire (base64 → gzip → NBT) : identifiant Hypixel → quantité. */
export async function decodeItems(data: string): Promise<Map<string, number>> {
  const root = parseNbt(await gunzip(base64Bytes(data)))
  const counts = new Map<string, number>()
  const slots = root.i
  if (!Array.isArray(slots)) return counts
  for (const slot of slots) {
    if (!isNbtCompound(slot)) continue
    const tag = slot.tag
    const extra = isNbtCompound(tag) ? tag.ExtraAttributes : undefined
    const id = isNbtCompound(extra) ? extra.id : undefined
    const count = slot.Count
    if (typeof id === 'string' && typeof count === 'number' && count > 0) counts.set(id, (counts.get(id) ?? 0) + count)
  }
  return counts
}

const dataOf = (value: unknown): string | null => (isRecord(value) && typeof value.data === 'string' ? value.data : null)

/** Contenus NBT de chaque source ; null quand la source est absente du profil. */
function containers(inventory: Record<string, unknown>): readonly [InventorySource, readonly string[] | null][] {
  const one = (value: unknown) => {
    const data = dataOf(value)
    return data === null ? null : [data]
  }
  const backpacks = inventory.backpack_contents
  return [
    ['inventory', one(inventory.inv_contents)],
    ['enderChest', one(inventory.ender_chest_contents)],
    ['backpacks', isRecord(backpacks) ? Object.values(backpacks).flatMap((value) => dataOf(value) ?? []) : null],
    ['vault', one(inventory.personal_vault_contents)],
  ]
}

/** Compte les mutations d'un inventaire de profil (valeur brute de l'API, vérifiée ici). */
export async function readInventoryMutations(data: GameData, inventory: unknown): Promise<InventoryImport> {
  const mutationByItemId = new Map(data.mutations.map((mutation) => [mutation.itemId, mutation.id]))
  const found = new Map<string, { total: number; sources: Partial<Record<InventorySource, number>> }>()
  const missingSources: InventorySource[] = []
  const unreadableSources: InventorySource[] = []

  const add = (source: InventorySource, itemId: string, count: number) => {
    const mutationId = mutationByItemId.get(itemId)
    if (!mutationId || !Number.isFinite(count) || count <= 0) return
    const entry = found.get(mutationId) ?? { total: 0, sources: {} }
    entry.total += Math.floor(count)
    entry.sources[source] = (entry.sources[source] ?? 0) + Math.floor(count)
    found.set(mutationId, entry)
  }

  const fields = isRecord(inventory) ? inventory : {}
  if (isRecord(fields.sacks_counts)) {
    for (const [itemId, count] of Object.entries(fields.sacks_counts)) {
      if (typeof count === 'number') add('sacks', itemId, count)
    }
  } else {
    missingSources.push('sacks')
  }

  for (const [source, blobs] of containers(fields)) {
    if (blobs === null) {
      missingSources.push(source)
      continue
    }
    for (const blob of blobs) {
      try {
        for (const [itemId, count] of await decodeItems(blob)) add(source, itemId, count)
      } catch {
        if (!unreadableSources.includes(source)) unreadableSources.push(source)
      }
    }
  }

  const mutations = data.mutations.flatMap((mutation) => {
    const entry = found.get(mutation.id)
    return entry ? [{ mutationId: mutation.id, total: entry.total, sources: entry.sources }] : []
  })
  return { mutations, missingSources, unreadableSources }
}
