import { useMemo } from 'react'
import { WikiIcon } from '../../components/game/WikiIcon'
import { getGameData } from '../../data'
import { cropSide } from '../../logic/grid'
import { plantingPreview } from '../../logic/plantingPreview'
import { GRID_COLORS } from '../../theme/palette'
import type { CropRef, GameData, Mutation } from '../../types/game'

const cropName = (data: GameData, crop: CropRef) =>
  crop.kind === 'mutation' ? (data.mutationsById.get(crop.id)?.name ?? crop.id) : crop.name

interface TileProps {
  readonly x: number
  readonly y: number
  readonly side: number
  readonly color: string
  readonly name: string
}

/** Crop posé sur l'aperçu : une seule image sur toute son empreinte, comme dans la Grille. */
function Tile({ x, y, side, color, name }: TileProps) {
  return (
    <span
      title={name}
      className="relative z-[1] flex items-center justify-center rounded-sm border-2"
      style={{
        gridColumn: `${x + 1} / span ${side}`,
        gridRow: `${y + 1} / span ${side}`,
        borderColor: color,
        background: `color-mix(in srgb, ${color} 36%, var(--color-canvas))`,
      }}
    >
      <WikiIcon name={name} className="h-3/4 w-3/4" />
    </span>
  )
}

/**
 * Aperçu repliable « où poser les ingrédients » : un exemple vérifié par la logique de la Grille
 * (voir logic/plantingPreview). Rien n'est affiché pour les mutations sans spawn sur la grille.
 */
export function PlantingPreview({ mutation }: { readonly mutation: Mutation }) {
  const data = getGameData()
  const preview = useMemo(() => plantingPreview(data, mutation), [data, mutation])
  if (!preview) return null

  const { width, height, target, placements } = preview
  const counts = new Map<string, number>()
  for (const placement of placements) {
    const name = cropName(data, placement.crop)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const around = [...counts].map(([name, count]) => `${count} × ${name}`).join(', ')
  const label =
    placements.length === 0
      ? `Exemple : ${mutation.name} seule, aucun crop dans les cases autour.`
      : `Exemple de plantation : ${mutation.name} au centre, avec autour ${around}.`

  return (
    <details open className="group mb-4 break-inside-avoid rounded-lg border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wider text-ink-muted uppercase hover:text-ink [&::-webkit-details-marker]:hidden">
        Aperçu de la plantation
        <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <figure className="animate-fade-up border-t border-line p-3">
        <div
          role="img"
          aria-label={label}
          className="mx-auto grid gap-1 rounded-lg border border-line bg-canvas p-1.5"
          style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, width: `min(100%, ${width * 2 + 0.75}rem)` }}
        >
          {Array.from({ length: width * height }, (_, cell) => (
            <span
              key={cell}
              className="aspect-square rounded-sm border border-line/60 bg-panel"
              style={{ gridColumn: (cell % width) + 1, gridRow: Math.floor(cell / width) + 1 }}
            />
          ))}
          <Tile x={target.x} y={target.y} side={target.side} color={GRID_COLORS.spawn} name={mutation.name} />
          {placements.map((placement) => (
            <Tile
              key={`${placement.x}-${placement.y}`}
              x={placement.x}
              y={placement.y}
              side={cropSide(data, placement.crop)}
              color={GRID_COLORS.placed}
              name={cropName(data, placement.crop)}
            />
          ))}
        </div>
        <figcaption className="mt-2 space-y-1 text-center text-xs text-ink-muted">
          <span className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: GRID_COLORS.spawn }} />
              Emplacement
            </span>
            {placements.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: GRID_COLORS.placed }} />
                Crop à poser
              </span>
            )}
          </span>
          <span className="block">
            {placements.length === 0
              ? 'Aucun crop dans les cases autour, diagonales comprises.'
              : 'Diagonales comprises · un exemple vérifié parmi d’autres.'}
          </span>
        </figcaption>
      </figure>
    </details>
  )
}
