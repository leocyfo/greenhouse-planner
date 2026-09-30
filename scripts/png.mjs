/**
 * Lecture et écriture de PNG sans dépendance (zlib de Node), et extraction de la face du dessus
 * d'un bloc rendu en isométrique. Utilisé par fetch-wiki-images.mjs pour les textures de sol.
 */
import { crc32, deflateSync, inflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

/** Décode un PNG non entrelacé (niveaux de gris, RVB, palette, avec ou sans alpha) en RGBA 8 bits. */
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("Ce n'est pas un PNG")
  let offset = 8
  let header = null
  let palette = null
  let transparency = null
  const idat = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('latin1', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9], interlace: data[12] }
    } else if (type === 'PLTE') palette = data
    else if (type === 'tRNS') transparency = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
  }
  const { width, height, bitDepth, colorType, interlace } = header
  const channels = CHANNELS[colorType]
  if (!channels || interlace !== 0) throw new Error(`PNG non géré (type ${colorType}, entrelacement ${interlace})`)

  // 1. Défiltrage, ligne par ligne (bpp = octets par pixel, au moins 1).
  const bitsPerPixel = channels * bitDepth
  const bpp = Math.max(1, bitsPerPixel >> 3)
  const stride = Math.ceil((width * bitsPerPixel) / 8)
  const raw = inflateSync(Buffer.concat(idat))
  const bytes = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const out = bytes.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? bytes.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? out[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? paeth(a, b, c) : 0
      out[x] = (line[x] + predictor) & 0xff
    }
  }

  // 2. Échantillon n°k d'une ligne, quelle que soit la profondeur (1 à 16 bits, 16 → octet fort).
  const sample = (y, k) => {
    const row = y * stride
    if (bitDepth === 8) return bytes[row + k]
    if (bitDepth === 16) return bytes[row + k * 2]
    const bit = k * bitDepth
    const value = (bytes[row + (bit >> 3)] >> (8 - bitDepth - (bit & 7))) & ((1 << bitDepth) - 1)
    return colorType === 3 ? value : Math.round((value * 255) / ((1 << bitDepth) - 1))
  }

  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const k = x * channels
      let pixel
      if (colorType === 3) {
        const index = sample(y, k)
        const alpha = transparency && index < transparency.length ? transparency[index] : 255
        pixel = [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2], alpha]
      } else if (colorType === 0) pixel = [sample(y, k), sample(y, k), sample(y, k), 255]
      else if (colorType === 4) pixel = [sample(y, k), sample(y, k), sample(y, k), sample(y, k + 1)]
      else if (colorType === 2) pixel = [sample(y, k), sample(y, k + 1), sample(y, k + 2), 255]
      else pixel = [sample(y, k), sample(y, k + 1), sample(y, k + 2), sample(y, k + 3)]
      rgba.set(pixel, (y * width + x) * 4)
    }
  }
  return { width, height, rgba }
}

/** Encode une image RGBA 8 bits en PNG. */
export function encodePng({ width, height, rgba }) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([length, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // 8 bits par canal
  header[9] = 6 // RGBA
  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

/**
 * Texture carrée de la face du dessus d'un bloc rendu en isométrique. La silhouette est un
 * hexagone : sommet du haut, puis coins gauche et droit en haut des colonnes extrêmes. Chaque
 * texel est lu en son centre, dans le losange de la face du dessus (éclairée à 100 %).
 */
export function topFaceTexture({ width, height, rgba }, size = 16) {
  const opaque = (x, y) => rgba[(y * width + x) * 4 + 3] > 200
  let top = height
  let minX = width
  let maxX = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!opaque(x, y)) continue
      top = Math.min(top, y)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
    }
  }
  const firstOpaqueY = (x) => {
    for (let y = 0; y < height; y += 1) if (opaque(x, y)) return y
    return height
  }
  const t = { x: (minX + maxX) / 2, y: top }
  const r = { x: maxX, y: firstOpaqueY(maxX) }
  const l = { x: minX, y: firstOpaqueY(minX) }
  const out = Buffer.alloc(size * size * 4)
  for (let v = 0; v < size; v += 1) {
    for (let u = 0; u < size; u += 1) {
      const fu = (u + 0.5) / size
      const fv = (v + 0.5) / size
      const x = Math.round(t.x + fu * (r.x - t.x) + fv * (l.x - t.x))
      const y = Math.round(t.y + fu * (r.y - t.y) + fv * (l.y - t.y))
      rgba.copy(out, (v * size + u) * 4, (y * width + x) * 4, (y * width + x) * 4 + 4)
    }
  }
  return { width: size, height: size, rgba: out }
}
