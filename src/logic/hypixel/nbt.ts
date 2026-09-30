/**
 * Lecture du format NBT de Minecraft (édition Java, gros-boutiste), celui des inventaires que
 * donne l'API Hypixel (une fois décodés du base64 et décompressés du gzip). Lecture seule, sans
 * dépendance ; les données tronquées, trop imbriquées ou incohérentes lèvent une erreur.
 */

export type NbtValue = number | bigint | string | NbtList | NbtCompound | Int8Array | Int32Array | BigInt64Array
export type NbtList = readonly NbtValue[]
export interface NbtCompound {
  readonly [name: string]: NbtValue
}

const TAG = {
  END: 0,
  BYTE: 1,
  SHORT: 2,
  INT: 3,
  LONG: 4,
  FLOAT: 5,
  DOUBLE: 6,
  BYTE_ARRAY: 7,
  STRING: 8,
  LIST: 9,
  COMPOUND: 10,
  INT_ARRAY: 11,
  LONG_ARRAY: 12,
} as const

/** Imbrication maximale acceptée (données abîmées ou malveillantes). */
const MAX_DEPTH = 64

const utf8 = new TextDecoder('utf-8')

/** Compound NBT (et non liste ni tableau typé). */
export function isNbtCompound(value: NbtValue | undefined): value is NbtCompound {
  return typeof value === 'object' && !Array.isArray(value) && !ArrayBuffer.isView(value)
}

class NbtReader {
  private readonly bytes: Uint8Array
  private readonly view: DataView
  private offset = 0

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  /** Réserve `size` octets et renvoie leur position ; erreur si les données s'arrêtent avant. */
  private take(size: number): number {
    const at = this.offset
    if (size < 0 || at + size > this.bytes.byteLength) throw new RangeError('NBT : données tronquées')
    this.offset += size
    return at
  }

  /** Longueur d'une liste ou d'un tableau, bornée par ce qui reste à lire. */
  private length(itemSize: number): number {
    const length = this.view.getInt32(this.take(4))
    if (length < 0 || length * itemSize > this.bytes.byteLength - this.offset) {
      throw new RangeError('NBT : longueur incohérente')
    }
    return length
  }

  ubyte(): number {
    return this.view.getUint8(this.take(1))
  }

  string(): string {
    const length = this.view.getUint16(this.take(2))
    const start = this.take(length)
    return utf8.decode(this.bytes.subarray(start, start + length))
  }

  compound(depth: number): NbtCompound {
    if (depth > MAX_DEPTH) throw new RangeError('NBT : imbrication trop profonde')
    const result: Record<string, NbtValue> = {}
    for (;;) {
      const type = this.ubyte()
      if (type === TAG.END) return result
      const name = this.string()
      result[name] = this.payload(type, depth)
    }
  }

  private payload(type: number, depth: number): NbtValue {
    switch (type) {
      case TAG.BYTE:
        return this.view.getInt8(this.take(1))
      case TAG.SHORT:
        return this.view.getInt16(this.take(2))
      case TAG.INT:
        return this.view.getInt32(this.take(4))
      case TAG.LONG:
        return this.view.getBigInt64(this.take(8))
      case TAG.FLOAT:
        return this.view.getFloat32(this.take(4))
      case TAG.DOUBLE:
        return this.view.getFloat64(this.take(8))
      case TAG.BYTE_ARRAY: {
        const start = this.take(this.length(1))
        return Int8Array.from(this.bytes.subarray(start, this.offset))
      }
      case TAG.STRING:
        return this.string()
      case TAG.LIST: {
        if (depth + 1 > MAX_DEPTH) throw new RangeError('NBT : imbrication trop profonde')
        const itemType = this.ubyte()
        const count = this.length(itemType === TAG.END ? 0 : 1)
        const list: NbtValue[] = []
        for (let i = 0; i < count; i += 1) list.push(this.payload(itemType, depth + 1))
        return list
      }
      case TAG.COMPOUND:
        return this.compound(depth + 1)
      case TAG.INT_ARRAY: {
        const values = new Int32Array(this.length(4))
        for (let i = 0; i < values.length; i += 1) values[i] = this.view.getInt32(this.take(4))
        return values
      }
      case TAG.LONG_ARRAY: {
        const values = new BigInt64Array(this.length(8))
        for (let i = 0; i < values.length; i += 1) values[i] = this.view.getBigInt64(this.take(8))
        return values
      }
      default:
        throw new RangeError(`NBT : type inconnu (${type})`)
    }
  }
}

/** Lit un contenu NBT : un compound racine nommé (le nom est ignoré). */
export function parseNbt(bytes: Uint8Array): NbtCompound {
  const reader = new NbtReader(bytes)
  if (reader.ubyte() !== TAG.COMPOUND) throw new RangeError('NBT : la racine doit être un compound')
  reader.string()
  return reader.compound(0)
}
