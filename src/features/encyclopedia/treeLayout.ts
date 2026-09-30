/**
 * Disposition d'un graphe en colonnes (méthode de Sugiyama, simplifiée), logique pure et
 * déterministe :
 * 1. un lien qui saute des colonnes passe, dans chacune, par un couloir réservé entre les cartes :
 *    il ne passe jamais sous une carte. Les liens d'une même carte partagent leurs couloirs ;
 * 2. ordre de chaque colonne : barycentre des voisins puis échanges de voisines, en gardant l'ordre
 *    qui a le moins de croisements ;
 * 3. hauteurs : chaque carte au plus près de ses voisines (liens aussi droits que possible), sans
 *    jamais changer l'ordre ni rapprocher deux cartes plus que l'écart minimal.
 */

export interface LayoutColumn {
  /** Nœuds de la colonne, dans un ordre de départ (rareté puis nom, par exemple). */
  readonly ids: readonly string[]
  readonly width: number
  /** Hauteur d'un nœud de la colonne. */
  readonly height: number
  /** Écart minimal entre deux nœuds de la colonne. */
  readonly gap: number
}

export interface LayoutLink {
  readonly id: string
  readonly source: string
  readonly target: string
}

export interface LayoutResult {
  readonly width: number
  readonly height: number
  readonly columnX: readonly number[]
  /** Coin haut gauche de chaque nœud. */
  readonly positions: ReadonlyMap<string, { readonly x: number; readonly y: number }>
  /** Courbe SVG de chaque lien, du bord droit de sa source au bord gauche de sa cible. */
  readonly paths: ReadonlyMap<string, string>
}

/** Écart entre une carte et un couloir de sa colonne, et entre deux couloirs. */
const LANE_TO_NODE = 10
const LANE_TO_LANE = 8
/** Épaisseur comptée pour un couloir quand on mesure la hauteur de l'arbre. */
const LANE_EXTENT = 4
/** Points d'attache répartis sur le bord d'une carte, sans ses coins. */
const PORT_MARGIN = 0.14
const ORDER_SWEEPS = 8
const TRANSPOSE_ROUNDS = 8
const PLACE_SWEEPS = 40

interface Slot {
  readonly column: number
  readonly height: number
  readonly gap: number
  /** Couloir d'un lien qui traverse la colonne (pas un nœud affiché). */
  readonly lane: boolean
}

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const round = (value: number) => Math.round(value * 10) / 10

/**
 * Hauteurs les plus proches des souhaits (moindres carrés) qui gardent l'ordre et les écarts
 * minimaux : régression isotone (pool adjacent violators) après retrait des écarts cumulés.
 */
export function packColumn(desired: readonly number[], separations: readonly number[]): number[] {
  const offsets = desired.map(() => 0)
  for (let index = 1; index < desired.length; index += 1) {
    offsets[index] = (offsets[index - 1] ?? 0) + (separations[index - 1] ?? 0)
  }
  const blocks: { sum: number; count: number }[] = []
  desired.forEach((value, index) => {
    blocks.push({ sum: value - (offsets[index] ?? 0), count: 1 })
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1]
      const before = blocks[blocks.length - 2]
      if (!last || !before || before.sum / before.count <= last.sum / last.count) break
      before.sum += last.sum
      before.count += last.count
      blocks.pop()
    }
  })
  const result: number[] = []
  for (const block of blocks) {
    for (let step = 0; step < block.count; step += 1) result.push(block.sum / block.count + (offsets[result.length] ?? 0))
  }
  return result
}

export function layoutColumns(
  columns: readonly LayoutColumn[],
  links: readonly LayoutLink[],
  options: { readonly top: number; readonly columnGap: number },
): LayoutResult {
  const slots = new Map<string, Slot>()
  const order: string[][] = columns.map((column, index) => {
    column.ids.forEach((id) => slots.set(id, { column: index, height: column.height, gap: column.gap, lane: false }))
    return [...column.ids]
  })
  const slot = (id: string): Slot => slots.get(id) ?? { column: 0, height: 0, gap: 0, lane: true }

  // Graphe en couches : chaque lien devient une suite de sauts d'une colonne à la suivante.
  const next = new Map<string, string[]>()
  const prev = new Map<string, string[]>()
  const connect = (from: string, to: string) => {
    const successors = next.get(from) ?? []
    if (successors.includes(to)) return
    next.set(from, [...successors, to])
    prev.set(to, [...(prev.get(to) ?? []), from])
  }
  const hops = new Map<string, string[]>()
  for (const link of links) {
    const from = slots.get(link.source)?.column
    const to = slots.get(link.target)?.column
    if (from === undefined || to === undefined || from >= to) continue
    const chain = [link.source]
    for (let column = from + 1; column < to; column += 1) {
      const lane = `lane:${link.source}:${column}`
      if (!slots.has(lane)) {
        slots.set(lane, { column, height: 0, gap: LANE_TO_LANE, lane: true })
        order[column]?.push(lane)
      }
      chain.push(lane)
    }
    chain.push(link.target)
    chain.forEach((id, index) => {
      const before = chain[index - 1]
      if (before !== undefined) connect(before, id)
    })
    hops.set(link.id, chain)
  }

  // 1. Ordre des colonnes.
  const index = new Map<string, number>()
  const reindex = (column: number) => order[column]?.forEach((id, position) => index.set(id, position))
  order.forEach((_, column) => reindex(column))
  const at = (id: string) => index.get(id) ?? 0
  const relative = (id: string) => (at(id) + 0.5) / (order[slot(id).column]?.length ?? 1)

  const sortByNeighbors = (column: number, neighbors: ReadonlyMap<string, readonly string[]>) => {
    const ids = order[column] ?? []
    const keyed = ids.map((id, position) => {
      const list = neighbors.get(id) ?? []
      return { id, position, key: list.length > 0 ? mean(list.map(relative)) : (position + 0.5) / ids.length }
    })
    keyed.sort((a, b) => a.key - b.key || a.position - b.position)
    order[column] = keyed.map((entry) => entry.id)
    reindex(column)
  }
  const crossings = () => {
    let count = 0
    order.forEach((ids) => {
      const edges = ids.flatMap((from) => (next.get(from) ?? []).map((to) => [at(from), at(to)] as const))
      edges.forEach(([a1, b1], i) => {
        for (const [a2, b2] of edges.slice(i + 1)) if ((a1 - a2) * (b1 - b2) < 0) count += 1
      })
    })
    return count
  }
  /** Croisements entre les liens de `upper` et ceux de `lower`, `upper` étant au-dessus. */
  const pairCrossings = (upper: string, lower: string) => {
    let count = 0
    for (const side of [prev, next]) {
      for (const a of side.get(upper) ?? []) for (const b of side.get(lower) ?? []) if (at(a) > at(b)) count += 1
    }
    return count
  }
  const transpose = () => {
    for (let pass = 0; pass < TRANSPOSE_ROUNDS; pass += 1) {
      let improved = false
      order.forEach((ids, column) => {
        for (let position = 0; position < ids.length - 1; position += 1) {
          const upper = ids[position]
          const lower = ids[position + 1]
          if (upper === undefined || lower === undefined) continue
          if (pairCrossings(lower, upper) >= pairCrossings(upper, lower)) continue
          ids[position] = lower
          ids[position + 1] = upper
          reindex(column)
          improved = true
        }
      })
      if (!improved) return
    }
  }

  let best = order.map((ids) => [...ids])
  let fewest = crossings()
  for (let sweep = 0; sweep < ORDER_SWEEPS && fewest > 0; sweep += 1) {
    for (let column = 1; column < order.length; column += 1) sortByNeighbors(column, prev)
    for (let column = order.length - 2; column >= 0; column -= 1) sortByNeighbors(column, next)
    transpose()
    const count = crossings()
    if (count < fewest) {
      fewest = count
      best = order.map((ids) => [...ids])
    }
  }
  best.forEach((ids, column) => {
    order[column] = ids
    reindex(column)
  })

  // 2. Hauteurs : centre de chaque nœud, rapproché de ses voisins à chaque passe.
  const separation = (upper: string, lower: string) => {
    const a = slot(upper)
    const b = slot(lower)
    const gap = a.lane && b.lane ? LANE_TO_LANE : a.lane || b.lane ? LANE_TO_NODE : Math.max(a.gap, b.gap)
    return a.height / 2 + gap + b.height / 2
  }
  const center = new Map<string, number>()
  const separationsOf = order.map((ids) => ids.slice(1).map((id, position) => separation(ids[position] ?? id, id)))
  order.forEach((ids, column) => {
    const ys = packColumn(
      ids.map(() => 0),
      separationsOf[column] ?? [],
    )
    ids.forEach((id, position) => center.set(id, ys[position] ?? 0))
  })
  const place = (column: number) => {
    const ids = order[column] ?? []
    const desired = ids.map((id) => {
      const neighbors = [...(prev.get(id) ?? []), ...(next.get(id) ?? [])]
      return neighbors.length > 0 ? mean(neighbors.map((n) => center.get(n) ?? 0)) : (center.get(id) ?? 0)
    })
    const ys = packColumn(desired, separationsOf[column] ?? [])
    ids.forEach((id, position) => center.set(id, ys[position] ?? 0))
  }
  for (let sweep = 0; sweep < PLACE_SWEEPS; sweep += 1) {
    if (sweep % 2 === 0) for (let column = 0; column < order.length; column += 1) place(column)
    else for (let column = order.length - 1; column >= 0; column -= 1) place(column)
  }

  const extent = (id: string) => (slot(id).lane ? LANE_EXTENT : slot(id).height) / 2
  const ids = [...slots.keys()]
  const highest = Math.min(...ids.map((id) => (center.get(id) ?? 0) - extent(id)))
  const lowest = Math.max(...ids.map((id) => (center.get(id) ?? 0) + extent(id)))
  const shift = options.top - highest
  const y = (id: string) => Math.round((center.get(id) ?? 0) + shift)

  const columnX: number[] = []
  columns.forEach((_, column) => {
    const before = columns[column - 1]
    columnX.push(before ? (columnX[column - 1] ?? 0) + before.width + options.columnGap : 0)
  })

  // 3. Points d'attache : répartis sur le bord, dans l'ordre vertical de l'autre bout.
  const outPort = new Map<string, number>()
  const inPort = new Map<string, number>()
  const spread = (id: string, others: readonly string[], key: (other: string) => string, ports: Map<string, number>) => {
    const { height, lane } = slot(id)
    const top = y(id) - height / 2
    const sorted = [...others].sort((a, b) => y(a) - y(b) || at(a) - at(b))
    sorted.forEach((other, position) => {
      const share = PORT_MARGIN + ((1 - 2 * PORT_MARGIN) * (position + 1)) / (sorted.length + 1)
      ports.set(key(other), lane ? y(id) : top + height * share)
    })
  }
  for (const id of ids) {
    spread(id, next.get(id) ?? [], (other) => `${id}>${other}`, outPort)
    spread(id, prev.get(id) ?? [], (other) => `${other}>${id}`, inPort)
  }

  const paths = new Map<string, string>()
  for (const [linkId, chain] of hops) {
    let path = ''
    let px = 0
    let py = 0
    chain.forEach((id, position) => {
      const { column, lane } = slot(id)
      const left = columnX[column] ?? 0
      const right = left + (columns[column]?.width ?? 0)
      if (position === 0) {
        px = right
        py = outPort.get(`${id}>${chain[1]}`) ?? y(id)
        path = `M${round(px)} ${round(py)}`
        return
      }
      const qy = inPort.get(`${chain[position - 1]}>${id}`) ?? y(id)
      const bend = (left - px) / 2
      path += `C${round(px + bend)} ${round(py)} ${round(left - bend)} ${round(qy)} ${round(left)} ${round(qy)}`
      if (lane) {
        // Le couloir traverse la colonne en ligne droite, entre les cartes.
        px = right
        py = qy
        path += `L${round(px)} ${round(py)}`
      }
    })
    paths.set(linkId, path)
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (const id of ids) {
    const { column, height, lane } = slot(id)
    if (!lane) positions.set(id, { x: columnX[column] ?? 0, y: y(id) - height / 2 })
  }
  const last = columns.length - 1
  return {
    width: (columnX[last] ?? 0) + (columns[last]?.width ?? 0),
    height: Math.round(lowest + shift),
    columnX,
    positions,
    paths,
  }
}
