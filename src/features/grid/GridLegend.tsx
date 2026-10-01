import type { ReactNode } from 'react'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { GRID_COLORS, soilBackground } from '../../theme/palette'
import { EffectDot, WaterDrop } from './GridMarks'
import { ringShadow } from './gridStyle'

function Item({ children }: { readonly children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5">{children}</span>
}

/** Case miniature de la légende, avec le même contour que sur le plateau. */
function RingSwatch({ color, dim = false }: { readonly color: string; readonly dim?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`size-4 rounded-[4px] ${dim ? 'bg-panel-raised' : 'bg-line'}`}
      style={{ boxShadow: ringShadow(color) }}
    />
  )
}

/** Légende toujours visible : sols et repères du plateau (qui n'affiche aucun texte). */
export function GridLegend() {
  const surfaces = getGameData().surfaces
  return (
    <div className="space-y-2 text-xs text-ink-muted" aria-label={tr('Légende de la grille', 'Grid legend')}>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {surfaces.map((surface) => (
          <Item key={surface}>
            <span
              aria-hidden="true"
              className="size-4 rounded-sm ring-1 ring-white/25"
              style={{ background: soilBackground(surface), imageRendering: 'pixelated' }}
            />
            {surface}
          </Item>
        ))}
        <Item>
          <span
            aria-hidden="true"
            className="size-4 rounded-sm ring-1 ring-white/25"
            style={{ background: 'repeating-linear-gradient(45deg, #1b1d22 0 3px, #2a2d35 3px 6px)' }}
          />
          {tr('Bloc cassé', 'Broken block')}
        </Item>
        <Item>
          <span aria-hidden="true">🔒</span> {tr('Case verrouillée', 'Locked cell')}
        </Item>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <Item>
          <RingSwatch color={GRID_COLORS.placed} /> {tr('Crop posé', 'Placed crop')}
        </Item>
        <Item>
          <RingSwatch color={GRID_COLORS.spawn} dim /> {tr('Spawn possible (image pâle)', 'Possible spawn (faded image)')}
        </Item>
        <Item>
          <RingSwatch color={GRID_COLORS.conflict} dim /> {tr('Conflit', 'Conflict')}
        </Item>
        <Item>
          <EffectDot tone="positive" /> <EffectDot tone="negative" /> <EffectDot tone="mixed" />{' '}
          {tr('Effets reçus : positifs, négatifs, les deux', 'Received effects: positive, negative, both')}
        </Item>
        <Item>
          <WaterDrop tone="ok" /> <WaterDrop tone="short" />{' '}
          {tr("Eau : suffit jusqu'à la récolte, ou à sec avant", 'Water: lasts until harvest, or runs dry before')}
        </Item>
      </div>
      <p>
        {tr(
          'Poser une mutation met sa case à son sol. Survole ou sélectionne une case : le panneau « Case » donne tout le détail. Les Lonelily, qui spawn au hasard sur les cases vides sans voisin, ne sont pas dessinées.',
          'Placing a mutation sets its cell to its soil. Hover or select a cell: the “Cell” panel gives every detail. Lonelilies, which spawn at random on empty cells with no neighbor, are not drawn.',
        )}
      </p>
    </div>
  )
}
