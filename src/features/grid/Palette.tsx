import { useMemo, useState } from 'react'
import { WikiIcon } from '../../components/game/WikiIcon'
import { formatRarity } from '../../components/labels'
import { wikiImage } from '../../data/wikiImages'
import { normalizeSearch } from '../inventory/inventoryFilters'
import { getGameData } from '../../data'
import { BROKEN_GROUND, LOCKED_GROUND } from '../../logic/ground'
import { cropKey } from '../../logic/neighborRule'
import { rarityColor, soilBackground } from '../../theme/palette'
import type { CropRef } from '../../types/game'
import { groundLabel } from './gridText'
import { DRAG_TYPE, type GridTool } from './gridTypes'

const TOOLS: readonly { readonly id: GridTool; readonly label: string; readonly hint: string }[] = [
  { id: 'place', label: 'Poser', hint: 'Clic ou glisser depuis la liste' },
  { id: 'erase', label: 'Gomme', hint: 'Clic droit : gomme aussi' },
  { id: 'ground', label: 'Sol', hint: 'Peindre le sol en glissant' },
  { id: 'inspect', label: 'Inspecter', hint: 'Voir le détail d’une case' },
  { id: 'godseed', label: 'Godseed', hint: 'Vérifier une zone 3x3' },
]

interface PaletteProps {
  readonly tool: GridTool
  readonly onToolChange: (tool: GridTool) => void
  readonly crop: CropRef | null
  readonly onCropChange: (crop: CropRef) => void
  readonly brush: string
  readonly onBrushChange: (ground: string) => void
  /** Les cases verrouillées ne concernent que le 1er greenhouse. */
  readonly allowLocked: boolean
  readonly labels: ReadonlyMap<string, string>
}

/**
 * Palette : outil, crop à poser (avec recherche et glisser-déposer) ou sol à peindre. Dans une
 * colonne de hauteur fixe, la liste des crops prend toute la place restante et défile seule.
 */
export function Palette({ tool, onToolChange, crop, onCropChange, brush, onBrushChange, allowLocked, labels }: PaletteProps) {
  const data = getGameData()
  const [search, setSearch] = useState('')

  const groups = useMemo(() => {
    const query = normalizeSearch(search)
    const matches = (name: string) => !query || normalizeSearch(name).includes(query)
    return [
      {
        title: 'Crops de base',
        crops: data.baseCrops
          .filter((c) => matches(c.name))
          .map((c) => ({
            ref: { kind: 'base', name: c.name } as CropRef,
            name: c.name,
            color: 'var(--color-ink)',
            border: 'var(--color-line)',
            surface: null as string | null,
            side: 1,
          })),
      },
      ...data.rarities.map((rarity) => ({
        title: formatRarity(rarity),
        crops: data.mutations
          .filter((m) => m.rarity === rarity && matches(m.name))
          .map((m) => ({
            ref: { kind: 'mutation', id: m.id } as CropRef,
            name: m.name,
            color: rarityColor(m.rarity),
            border: rarityColor(m.rarity),
            surface: m.surface as string | null,
            side: m.side,
          })),
      })),
    ].filter((group) => group.crops.length > 0)
  }, [data, search])

  const grounds = [...data.surfaces, BROKEN_GROUND, ...(allowLocked ? [LOCKED_GROUND] : [])]
  const selectedKey = crop ? cropKey(crop) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-ink-muted">Outil</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {TOOLS.map((option) => (
            <label
              key={option.id}
              title={option.hint}
              className="cursor-pointer rounded-lg border border-line px-2 py-1.5 text-center text-xs text-ink-muted transition-colors hover:text-ink has-checked:border-accent has-checked:bg-accent/15 has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="grid-tool"
                value={option.id}
                checked={tool === option.id}
                onChange={() => onToolChange(option.id)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {tool === 'ground' ? (
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-ink-muted">Sol à peindre</legend>
          <div className="space-y-1">
            {grounds.map((ground) => (
              <label
                key={ground}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-panel-raised has-checked:bg-panel-raised has-checked:font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent"
              >
                <input
                  type="radio"
                  name="grid-brush"
                  value={ground}
                  checked={brush === ground}
                  onChange={() => onBrushChange(ground)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="size-5 rounded-sm ring-1 ring-white/25"
                  style={{
                    imageRendering: 'pixelated',
                    background:
                      ground === BROKEN_GROUND
                        ? 'repeating-linear-gradient(45deg, #1b1d22 0 3px, #2a2d35 3px 6px)'
                        : ground === LOCKED_GROUND
                          ? '#23262d'
                          : soilBackground(ground),
                  }}
                />
                {groundLabel(ground)}
                {brush === ground && <span className="ml-auto text-accent-strong" aria-hidden="true">✓</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
            Crop à poser
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher"
              className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm font-normal text-ink placeholder:text-ink-muted/70"
            />
          </label>
          <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">{group.title}</p>
                {/* Grille de cartes : image, nom, bordure de la rareté, pastille du sol. */}
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
                  {group.crops.map((item) => {
                    const key = cropKey(item.ref)
                    const selected = key === selectedKey
                    const details = [item.side > 1 ? `${item.side}x${item.side}` : null, item.surface ? `sol ${item.surface}` : null]
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          draggable
                          aria-pressed={selected}
                          aria-label={[item.name, ...details].filter(Boolean).join(', ')}
                          title={[item.name, ...details].filter(Boolean).join(' · ')}
                          onDragStart={(event) => {
                            event.dataTransfer.setData(DRAG_TYPE, key)
                            onCropChange(item.ref)
                          }}
                          onClick={() => {
                            onCropChange(item.ref)
                            if (tool !== 'place') onToolChange('place')
                          }}
                          className={`relative flex h-full w-full flex-col items-center gap-1 rounded-md border bg-canvas/60 px-1 pt-2 pb-1.5 transition hover:bg-panel-raised motion-safe:active:scale-95 ${
                            selected ? 'bg-accent/15 ring-2 ring-accent' : ''
                          }`}
                          style={{ borderColor: item.border }}
                        >
                          {item.surface && (
                            <span
                              aria-hidden="true"
                              className="absolute top-1 right-1 size-2.5 rounded-[2px] ring-1 ring-black/60"
                              style={{ background: soilBackground(item.surface), imageRendering: 'pixelated' }}
                            />
                          )}
                          {item.side > 1 && (
                            <span aria-hidden="true" className="absolute top-0.5 left-1 text-[9px] text-ink-muted">
                              {item.side}x{item.side}
                            </span>
                          )}
                          <span aria-hidden="true" className="flex h-8 items-center">
                            {wikiImage(item.name) ? (
                              <WikiIcon name={item.name} size={30} />
                            ) : (
                              <span className="rounded bg-canvas px-1 text-[10px] font-semibold" style={{ color: item.color }}>
                                {labels.get(item.name)}
                              </span>
                            )}
                          </span>
                          <span aria-hidden="true" className="line-clamp-2 w-full text-center text-[10px] leading-tight" style={{ color: item.color }}>
                            {item.name}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
