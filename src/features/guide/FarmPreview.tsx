import type { CSSProperties } from 'react'
import { WikiIcon } from '../../components/game/WikiIcon'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { cropSide } from '../../logic/grid'
import { BROKEN_GROUND } from '../../logic/ground'
import { soilBackground } from '../../theme/palette'
import type { CropRef, LayoutPreset } from '../../types/game'

/** Ce que l'aperçu dessine : une ferme du guide, ou un plan qui en réunit plusieurs. */
export type PreviewLayout = Pick<LayoutPreset, 'name' | 'width' | 'height' | 'ground' | 'placements' | 'spots'>

const cropName = (crop: CropRef) =>
  crop.kind === 'base' ? crop.name : (getGameData().mutationsById.get(crop.id)?.name ?? crop.id)

/**
 * Aperçu d'une ferme du guide, comme dans la grille : le sol de chaque case, les crops à poser
 * (un 2x2 couvre ses quatre cases) et, en vert, les emplacements où les mutations vont spawn.
 */
export function FarmPreview({ layout }: { readonly layout: PreviewLayout }) {
  const data = getGameData()
  const spots = new Set(layout.spots.map((spot) => spot.y * layout.width + spot.x))
  const style = { gridTemplateColumns: `repeat(${layout.width}, minmax(0, 1fr))`, maxWidth: `${layout.width * 1.75}rem` } as CSSProperties

  return (
    <figure className="space-y-1.5">
      <div
        role="img"
        aria-label={tr(
          `Plan « ${layout.name} » : ${layout.placements.length} crops à poser, ${layout.spots.length} cases d'emplacement`,
          `Layout “${layout.name}”: ${layout.placements.length} crops to place, ${layout.spots.length} spot cells`,
        )}
        className="grid w-full gap-px rounded-lg border border-line bg-canvas p-1"
        style={style}
      >
        {layout.ground.map((ground, cell) => (
          <span
            key={cell}
            className="aspect-square rounded-[2px]"
            style={{
              gridColumn: (cell % layout.width) + 1,
              gridRow: Math.floor(cell / layout.width) + 1,
              imageRendering: 'pixelated',
              background: ground === BROKEN_GROUND ? 'repeating-linear-gradient(45deg, #1b1d22 0 3px, #2a2d35 3px 6px)' : soilBackground(ground),
              boxShadow: spots.has(cell) ? 'inset 0 0 0 2px rgb(108 192 112), inset 0 0 0 9px rgb(108 192 112 / 0.35)' : undefined,
            }}
          />
        ))}
        {layout.placements.map((placement) => {
          const side = cropSide(data, placement.crop)
          const name = cropName(placement.crop)
          return (
            <span
              key={`${placement.x}-${placement.y}`}
              title={name}
              className="z-[1] flex items-center justify-center rounded-[3px] bg-black/25"
              style={{ gridColumn: `${placement.x + 1} / span ${side}`, gridRow: `${placement.y + 1} / span ${side}` }}
            >
              <WikiIcon name={name} className="h-4/5 w-4/5" />
            </span>
          )
        })}
      </div>
      <figcaption className="flex flex-wrap gap-x-3 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ boxShadow: 'inset 0 0 0 2px rgb(108 192 112)' }} />
          {tr('Emplacement', 'Spot')}
        </span>
        <span>
          {layout.width} × {layout.height}
        </span>
      </figcaption>
    </figure>
  )
}
