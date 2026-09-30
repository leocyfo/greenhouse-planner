/**
 * Écriture NBT minimale, pour fabriquer dans les tests des inventaires au format de l'API
 * Hypixel (compound racine avec une liste « i » d'objets), compressés et encodés en base64.
 */

type Writable =
  | { readonly type: 'byte' | 'short' | 'int'; readonly value: number }
  | { readonly type: 'long'; readonly value: bigint }
  | { readonly type: 'double'; readonly value: number }
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'compound'; readonly value: Readonly<Record<string, Writable>> }
  | { readonly type: 'list'; readonly itemType: number; readonly value: readonly Writable[] }
  | { readonly type: 'intArray'; readonly value: readonly number[] }

const TYPE_ID = { byte: 1, short: 2, int: 3, long: 4, double: 6, string: 8, list: 9, compound: 10, intArray: 11 } as const

export const nbt = {
  byte: (value: number): Writable => ({ type: 'byte', value }),
  short: (value: number): Writable => ({ type: 'short', value }),
  int: (value: number): Writable => ({ type: 'int', value }),
  long: (value: bigint): Writable => ({ type: 'long', value }),
  double: (value: number): Writable => ({ type: 'double', value }),
  string: (value: string): Writable => ({ type: 'string', value }),
  compound: (value: Readonly<Record<string, Writable>>): Writable => ({ type: 'compound', value }),
  list: (itemType: number, value: readonly Writable[]): Writable => ({ type: 'list', itemType, value }),
  intArray: (value: readonly number[]): Writable => ({ type: 'intArray', value }),
}

class ByteWriter {
  private readonly chunks: number[] = []

  push(...bytes: number[]) {
    this.chunks.push(...bytes)
  }

  number(value: number, size: 1 | 2 | 4 | 8, float = false) {
    const view = new DataView(new ArrayBuffer(size))
    if (float) view.setFloat64(0, value)
    else if (size === 1) view.setInt8(0, value)
    else if (size === 2) view.setInt16(0, value)
    else view.setInt32(0, value)
    this.push(...new Uint8Array(view.buffer))
  }

  bigint(value: bigint) {
    const view = new DataView(new ArrayBuffer(8))
    view.setBigInt64(0, value)
    this.push(...new Uint8Array(view.buffer))
  }

  string(value: string) {
    const bytes = new TextEncoder().encode(value)
    this.number(bytes.length, 2)
    this.push(...bytes)
  }

  bytes(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.chunks)
  }
}

function writePayload(writer: ByteWriter, item: Writable) {
  switch (item.type) {
    case 'byte':
      return writer.number(item.value, 1)
    case 'short':
      return writer.number(item.value, 2)
    case 'int':
      return writer.number(item.value, 4)
    case 'long':
      return writer.bigint(item.value)
    case 'double':
      return writer.number(item.value, 8, true)
    case 'string':
      return writer.string(item.value)
    case 'intArray':
      writer.number(item.value.length, 4)
      for (const value of item.value) writer.number(value, 4)
      return
    case 'list':
      writer.push(item.itemType)
      writer.number(item.value.length, 4)
      for (const value of item.value) writePayload(writer, value)
      return
    case 'compound':
      for (const [name, value] of Object.entries(item.value)) {
        writer.push(TYPE_ID[value.type])
        writer.string(name)
        writePayload(writer, value)
      }
      writer.push(0)
  }
}

/** Contenu NBT complet : compound racine (sans nom) avec les champs donnés. */
export function nbtBytes(root: Readonly<Record<string, Writable>>): Uint8Array<ArrayBuffer> {
  const writer = new ByteWriter()
  writer.push(TYPE_ID.compound)
  writer.string('')
  writePayload(writer, nbt.compound(root))
  return writer.bytes()
}

/** Objet d'inventaire SkyBlock : identifiant Hypixel dans tag.ExtraAttributes.id. */
export function skyblockItem(itemId: string, count: number): Writable {
  return nbt.compound({
    id: nbt.short(1),
    Count: nbt.byte(count),
    tag: nbt.compound({ ExtraAttributes: nbt.compound({ id: nbt.string(itemId) }) }),
  })
}

/** Inventaire au format Hypixel : liste « i » d'objets (null = case vide), en gzip + base64. */
export async function inventoryData(items: readonly ({ id: string; count: number } | null)[]): Promise<string> {
  const slots = items.map((item) => (item ? skyblockItem(item.id, item.count) : nbt.compound({})))
  const bytes = nbtBytes({ i: nbt.list(TYPE_ID.compound, slots) })
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  const zipped = new Uint8Array(await new Response(stream).arrayBuffer())
  let binary = ''
  for (const byte of zipped) binary += String.fromCharCode(byte)
  return btoa(binary)
}
