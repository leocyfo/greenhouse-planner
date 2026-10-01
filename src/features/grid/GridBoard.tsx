import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from 'react'
import { WikiIcon } from '../../components/game/WikiIcon'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { wikiImage } from '../../data/wikiImages'
import { cropSide, type GridAnalysis, type GridInput } from '../../logic/grid'
import { BROKEN_GROUND, LOCKED_GROUND } from '../../logic/ground'
import { harvestStage } from '../../logic/growth'
import { GRID_COLORS, rarityColor, soilBackground } from '../../theme/palette'
import type { CropRef } from '../../types/game'
import { EffectDot, WaterDrop, type EffectTone, type WaterTone } from './GridMarks'
import { ringShadow } from './gridStyle'
import { cellName, groundLabel } from './gridText'
import { DRAG_TYPE, type Overlays } from './gridTypes'

/**
 * Côté d'une case : toute la place disponible, en largeur (le plateau fait 10 cases + 41 px :
 * 9 écarts de 3 px, marges et bordure) comme en hauteur (--board-height : de son haut au bas de
 * l'écran), entre 44 et 72 px. Les icônes suivent (tailles en %).
 */
const CELL = 'clamp(2.75rem, min(calc((100cqw - 41px) / 10), calc((var(--board-height, 100dvh) - 41px) / 10)), 4.5rem)'
/** Marge laissée sous le plateau, en bas de l'écran. */
const BOTTOM_MARGIN = 16

/**
 * Hauteur disponible pour le plateau : du haut du plateau (dans la page, quel que soit le
 * défilement) au bas de l'écran. Recalculée quand l'écran ou la page change de taille (barre des
 * plans sur une ou deux lignes, notes d'un plan…).
 */
function useAvailableHeight(element: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    const update = () => {
      const top = element.current ? element.current.getBoundingClientRect().top + window.scrollY : 0
      setHeight(Math.max(0, Math.round(window.innerHeight - top - BOTTOM_MARGIN)))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(document.documentElement)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [element])
  return height
}
/** Voile sombre sur le sol des cases vides : les crops posés ressortent en pleine lumière. */
const EMPTY_VEIL = 'linear-gradient(rgb(14 16 20 / 0.55), rgb(14 16 20 / 0.55))'

interface GridBoardProps {
  readonly grid: GridInput
  readonly analysis: GridAnalysis
  readonly overlays: Overlays
  /** Abréviation de chaque crop (par nom), pour ceux qui n'ont pas d'image. */
  readonly labels: ReadonlyMap<string, string>
  readonly selectedCell: number | null
  /** Zone mise en évidence (vérificateur Godseed). */
  readonly zone: { readonly x: number; readonly y: number; readonly side: number } | null
  /** Sol ou gomme : l'action se répète en glissant avec le bouton appuyé. */
  readonly paintMode: boolean
  /** Stages avant d'être à sec pour une case occupée (null = sans objet). */
  readonly waterStages: (cell: number) => number | null
  readonly onCellAction: (cell: number, kind: 'primary' | 'erase') => void
  readonly onHover: (cell: number | null) => void
  readonly onDropCrop: (cell: number, crop: CropRef) => void
  /** Nom accessible du plateau. */
  readonly label: string
}

function parseCropKey(key: string): CropRef | null {
  if (key.startsWith('mutation:')) return { kind: 'mutation', id: key.slice('mutation:'.length) }
  if (key.startsWith('base:')) return { kind: 'base', name: key.slice('base:'.length) }
  return null
}

/** Fond d'une case : son sol, assombri tant qu'elle est vide. */
function cellBackground(ground: string, occupied: boolean): CSSProperties {
  if (ground === BROKEN_GROUND) {
    return { background: 'repeating-linear-gradient(45deg, #1b1d22 0 6px, #2a2d35 6px 12px)' }
  }
  if (ground === LOCKED_GROUND) return { background: '#1a1d23' }
  const soil = soilBackground(ground)
  return { background: occupied ? soil : `${EMPTY_VEIL}, ${soil}`, imageRendering: 'pixelated' }
}

function position(x: number, y: number, side = 1): CSSProperties {
  return { gridColumn: `${x + 1} / span ${side}`, gridRow: `${y + 1} / span ${side}` }
}

/**
 * Plateau de la grille, sans texte dans les cases : crops posés (bordure orange), spawns
 * possibles en fantôme (bordure verte), conflits (bordure rouge), pastilles d'effets et gouttes
 * d'eau. Le détail est dans le panneau Case et dans le nom accessible de chaque case.
 */
export function GridBoard({
  grid,
  analysis,
  overlays,
  labels,
  selectedCell,
  zone,
  paintMode,
  waterStages,
  onCellAction,
  onHover,
  onDropCrop,
  label,
}: GridBoardProps) {
  const data = getGameData()
  const helpId = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const [focusedCell, setFocusedCell] = useState(0)
  const painting = useRef(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const availableHeight = useAvailableHeight(boardRef)

  const cropName = (crop: CropRef) =>
    crop.kind === 'base' ? crop.name : (data.mutationsById.get(crop.id)?.name ?? crop.id)
  const mutationName = (id: string) => data.mutationsById.get(id)?.name ?? id
  // Les spawns au hasard (Lonelily, sur toute case vide sans voisin) ne sont pas dessinés :
  // ils couvriraient toute la grille vide. Leurs conflits restent signalés.
  const drawn = (id: string) => data.mutationsById.get(id)?.spawnRule !== 'noAdjacentCrops'
  const placementAt = (cell: number) => {
    const index = analysis.occupancy[cell]
    return index === null || index === undefined ? undefined : grid.placements[index]
  }

  function describe(cell: number, x: number, y: number): string {
    const placement = placementAt(cell)
    const parts = [tr(`${cellName(x, y)} : ${groundLabel(grid.ground[cell] ?? '')}`, `${cellName(x, y)}: ${groundLabel(grid.ground[cell] ?? '')}`)]
    parts.push(placement ? cropName(placement.crop) : tr('vide', 'empty'))
    const spawns = (analysis.cells[cell]?.mutationIds ?? []).map(mutationName)
    if (spawns.length > 0) parts.push(tr(`spawn possible : ${spawns.join(', ')}`, `possible spawn: ${spawns.join(', ')}`))
    if (analysis.cells[cell]?.conflict) parts.push(tr('conflit', 'conflict'))
    return parts.join(', ')
  }

  function effectTone(cell: number): EffectTone | null {
    const effects = analysis.effects[cell]
    if (!overlays.effects || !effects) return null
    const values = [effects.totals.yield, effects.totals.xp, effects.totals.water]
    const positive = values.some((value) => value > 0) || effects.immunity || effects.bonusDrops
    const negative = values.some((value) => value < 0)
    if (positive && negative) return 'mixed'
    return positive ? 'positive' : negative ? 'negative' : null
  }

  function waterTone(cell: number): WaterTone | null {
    if (!overlays.water) return null
    const stages = waterStages(cell)
    if (stages === null) return null
    const crop = placementAt(cell)?.crop
    const mutation = crop?.kind === 'mutation' ? data.mutationsById.get(crop.id) : undefined
    const needed = mutation ? harvestStage(mutation) : null
    return needed !== null && stages < needed ? 'short' : 'ok'
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, cell: number) {
    const x = cell % grid.width
    const y = Math.floor(cell / grid.width)
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      const nx = Math.min(grid.width - 1, Math.max(0, x + move[0]))
      const ny = Math.min(grid.height - 1, Math.max(0, y + move[1]))
      const next = ny * grid.width + nx
      setFocusedCell(next)
      buttons.current[next]?.focus()
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      onCellAction(cell, 'erase')
    }
  }

  const validPlacements = grid.placements
    .map((placement, index) => ({ placement, index }))
    .filter(({ index }) => analysis.occupancy.includes(index))

  // Spawns de 2x2 et 3x3 : un seul fantôme sur toute l'empreinte, pas un par case.
  const bigSpawns = overlays.spawns ? analysis.options.filter((option) => option.side > 1 && drawn(option.mutationId)) : []
  const inBigSpawn = new Set(
    bigSpawns.flatMap((option) =>
      Array.from({ length: option.side * option.side }, (_, i) => (option.y + Math.floor(i / option.side)) * grid.width + option.x + (i % option.side)),
    ),
  )

  return (
    <div className="@container overflow-x-auto pb-2" onPointerUp={() => (painting.current = false)} onPointerLeave={() => onHover(null)}>
      <p id={helpId} className="sr-only">
        {tr(
          "Flèches pour se déplacer, Entrée pour agir avec l'outil choisi, Suppr pour effacer.",
          'Arrows to move, Enter to act with the chosen tool, Delete to erase.',
        )}
      </p>
      <div
        ref={boardRef}
        role="group"
        aria-label={label}
        aria-describedby={helpId}
        className="relative mx-auto grid w-max touch-manipulation select-none gap-[3px] rounded-xl border border-line bg-canvas p-1.5"
        style={
          {
            ...(availableHeight !== null && { '--board-height': `${availableHeight}px` }),
            gridTemplateColumns: `repeat(${grid.width}, ${CELL})`,
            gridTemplateRows: `repeat(${grid.height}, ${CELL})`,
          } as CSSProperties
        }
      >
        {/* Couche 1 : les cases (boutons). Les crops 1x1 sont dessinés dedans. */}
        {grid.ground.map((ground, cell) => {
          const x = cell % grid.width
          const y = Math.floor(cell / grid.width)
          const placement = placementAt(cell)
          const single = placement && cropSide(data, placement.crop) === 1 ? placement : undefined
          return (
            <button
              key={cell}
              ref={(element) => {
                buttons.current[cell] = element
              }}
              type="button"
              tabIndex={cell === focusedCell ? 0 : -1}
              aria-label={describe(cell, x, y)}
              style={{
                ...position(x, y),
                ...cellBackground(ground, placement !== undefined),
                boxShadow: single ? ringShadow(GRID_COLORS.placed) : undefined,
              }}
              className="relative flex items-center justify-center rounded-md text-[10px] font-semibold focus-visible:z-30"
              onFocus={() => setFocusedCell(cell)}
              onKeyDown={(event) => moveFocus(event, cell)}
              onMouseEnter={() => {
                onHover(cell)
                if (painting.current) onCellAction(cell, 'primary')
              }}
              onPointerDown={(event) => {
                if (!paintMode || event.button !== 0) return
                painting.current = true
                onCellAction(cell, 'primary')
              }}
              onClick={(event) => {
                // En mode peinture, la souris a déjà agi au pointerdown ; le clavier passe ici (detail 0).
                if (!paintMode || event.detail === 0) onCellAction(cell, 'primary')
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                onCellAction(cell, 'erase')
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const crop = parseCropKey(event.dataTransfer.getData(DRAG_TYPE))
                if (crop) onDropCrop(cell, crop)
              }}
            >
              {ground === LOCKED_GROUND && <span aria-hidden="true">🔒</span>}
              {single &&
                (wikiImage(cropName(single.crop)) ? (
                  // Une clé par crop : un crop posé (ou remplacé) apparaît avec un petit rebond.
                  <WikiIcon key={cropName(single.crop)} name={cropName(single.crop)} size={34} className="size-[78%] animate-pop drop-shadow" />
                ) : (
                  // Crop sans image (Fire) : son abréviation, faute de mieux.
                  <span
                    aria-hidden="true"
                    className="rounded bg-canvas/85 px-0.5 leading-tight"
                    style={{ color: single.crop.kind === 'mutation' ? rarityColor(data.mutationsById.get(single.crop.id)?.rarity ?? '') : undefined }}
                  >
                    {labels.get(cropName(single.crop)) ?? '?'}
                  </span>
                ))}
            </button>
          )
        })}

        {/* Couche 2 : mutations multi-cases posées, puis spawns possibles de 2x2 et 3x3. */}
        {validPlacements.map(({ placement }) => {
          const side = cropSide(data, placement.crop)
          if (side === 1) return null
          return (
            // Clé stable (position et crop) : retirer un autre crop ne rejoue pas l'animation des suivants.
            <div
              key={`placement-${placement.x}-${placement.y}-${cropName(placement.crop)}`}
              aria-hidden="true"
              className="pointer-events-none z-10 flex animate-pop items-center justify-center rounded-md"
              style={{ ...position(placement.x, placement.y, side), boxShadow: ringShadow(GRID_COLORS.placed) }}
            >
              <WikiIcon name={cropName(placement.crop)} size={side * 30} className="size-[70%] drop-shadow" />
            </div>
          )
        })}
        {bigSpawns.map((option) => (
          <div
            key={`spawn-${option.mutationId}-${option.x}-${option.y}`}
            aria-hidden="true"
            className="pointer-events-none z-10 flex animate-fade-in items-center justify-center rounded-md"
            style={{ ...position(option.x, option.y, option.side), boxShadow: ringShadow(GRID_COLORS.spawn) }}
          >
            <WikiIcon name={mutationName(option.mutationId)} size={option.side * 26} className="size-[60%] opacity-45" />
          </div>
        ))}

        {/* Couche 3 : spawns 1x1 en fantôme, conflits, effets, eau et sélection. */}
        {grid.ground.map((_, cell) => {
          const x = cell % grid.width
          const y = Math.floor(cell / grid.width)
          const spawn = analysis.cells[cell]
          const occupied = analysis.occupancy[cell] !== null
          const conflict = overlays.conflicts && spawn?.conflict === true
          const candidates = (spawn?.mutationIds ?? []).filter((id) => drawn(id) && (data.mutationsById.get(id)?.side ?? 1) === 1)
          const ghost =
            overlays.spawns && !occupied && !inBigSpawn.has(cell)
              ? ((spawn?.winner && candidates.includes(spawn.winner) ? spawn.winner : candidates[0]) ?? null)
              : null
          const effect = effectTone(cell)
          const water = waterTone(cell)
          if (!ghost && !conflict && !effect && !water && cell !== selectedCell) return null
          const ring = conflict ? GRID_COLORS.conflict : ghost ? GRID_COLORS.spawn : null
          return (
            <div
              key={`overlay-${cell}`}
              aria-hidden="true"
              className={`pointer-events-none relative z-20 flex items-center justify-center rounded-md ${
                cell === selectedCell ? 'outline-2 outline-offset-1 outline-ink' : ''
              }`}
              style={{ ...position(x, y), boxShadow: ring ? ringShadow(ring) : undefined }}
            >
              {ghost && <WikiIcon key={ghost} name={mutationName(ghost)} size={30} className="size-[68%] animate-fade-in opacity-45" />}
              {effect && <EffectDot tone={effect} className="absolute bottom-1 left-1" />}
              {water && <WaterDrop tone={water} className="absolute top-0.5 right-0.5" />}
            </div>
          )
        })}
        {zone && (
          <div
            aria-hidden="true"
            className="pointer-events-none z-20 rounded-md border-2 border-dashed border-warning"
            style={position(zone.x, zone.y, zone.side)}
          />
        )}
      </div>
    </div>
  )
}
