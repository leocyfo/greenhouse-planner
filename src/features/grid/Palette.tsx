import { useMemo, useState } from 'react'
import { WikiIcon } from '../../components/game/WikiIcon'
import { formatRarity } from '../../components/labels'
import { wikiImage } from '../../data/wikiImages'
import { normalizeSearch } from '../inventory/inventoryFilters'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { BROKEN_GROUND, LOCKED_GROUND } from '../../logic/ground'
import { cropKey } from '../../logic/neighborRule'
import { rarityColor, soilBackground } from '../../theme/palette'
import type { CropRef } from '../../types/game'
import { groundLabel } from './gridText'
import { DRAG_TYPE, type GridTool } from './gridTypes'

/**
 * Outils de la palette (textes lus à l'affichage : ils suivent la langue), chacun avec l'image
 * d'un objet du jeu ; la gomme, qui n'en a pas, est dessinée.
 */
const tools = (): readonly { readonly id: GridTool; readonly label: string; readonly hint: string; readonly icon: string | null }[] => [
  { id: 'place', label: tr('Poser', 'Place'), hint: tr('Clic ou glisser depuis la liste', 'Click or drag from the list'), icon: 'Seeds' },
  { id: 'erase', label: tr('Gomme', 'Eraser'), hint: tr('Clic droit : gomme aussi', 'Right click erases too'), icon: null },
  { id: 'ground', label: tr('Sol', 'Soil'), hint: tr('Peindre le sol en glissant', 'Paint the soil by dragging'), icon: 'Dirt' },
  { id: 'inspect', label: tr('Inspecter', 'Inspect'), hint: tr('Voir le détail d’une case', 'See the details of a cell'), icon: 'Plant Diagnostics Tool' },
  { id: 'godseed', label: 'Godseed', hint: tr('Vérifier une zone 3x3', 'Check a 3x3 area'), icon: 'Godseed' },
]

function EraserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="m14 4 6 6-9 9H6l-3-3 11-12Z" fill="#f07167" fillOpacity={0.35} />
      <path d="M9 9l6 6M6 19h14" strokeLinecap="round" />
    </svg>
  )
}

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
        title: tr('Crops de base', 'Base crops'),
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
  const current =
    crop === null
      ? null
      : crop.kind === 'base'
        ? { name: crop.name, color: 'var(--color-ink)', side: 1, surface: null }
        : (() => {
            const mutation = data.mutationsById.get(crop.id)
            return mutation ? { name: mutation.name, color: rarityColor(mutation.rarity), side: mutation.side, surface: mutation.surface } : null
          })()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-ink-muted">{tr('Outil', 'Tool')}</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {tools().map((option) => (
            <label
              key={option.id}
              title={`${option.label} : ${option.hint}`}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-line px-1 py-1.5 text-[11px] text-ink-muted transition-colors hover:text-ink has-checked:border-accent has-checked:bg-accent/15 has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="grid-tool"
                value={option.id}
                checked={tool === option.id}
                onChange={() => onToolChange(option.id)}
                className="sr-only"
              />
              <span aria-hidden="true" className="flex h-7 items-center">
                {option.icon ? <WikiIcon name={option.icon} size={26} /> : <EraserIcon />}
              </span>
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Ce que l'outil posera : le crop choisi (ou le sol à peindre). */}
      {tool !== 'ground' && (
        <p className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-canvas/60 px-2.5 py-1.5 text-sm">
          <span className="text-xs text-ink-muted">{tr('En main', 'In hand')}</span>
          {current ? (
            <>
              <WikiIcon name={current.name} size={24} />
              <span className="font-medium" style={{ color: current.color }}>
                {current.name}
              </span>
              <span className="ml-auto text-xs text-ink-muted">
                {[current.side > 1 ? `${current.side}x${current.side}` : null, current.surface].filter(Boolean).join(' · ')}
              </span>
            </>
          ) : (
            <span className="text-ink-muted">{tr('rien : choisis un crop ci-dessous', 'nothing: pick a crop below')}</span>
          )}
        </p>
      )}

      {tool === 'ground' ? (
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-ink-muted">{tr('Sol à peindre', 'Soil to paint')}</legend>
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
            {tr('Crop à poser', 'Crop to place')}
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr('Rechercher', 'Search')}
              className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm font-normal text-ink placeholder:text-ink-muted/70"
            />
          </label>
          <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {groups.map((group) => (
              // Chaque groupe se replie : la liste reste courte (« Crops de base » d'un clic).
              <details key={group.title} open className="group/rarity">
                <summary className="mb-1 flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium tracking-wide text-ink-muted uppercase hover:text-ink [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="inline-block transition-transform group-open/rarity:rotate-90">
                    ▸
                  </span>
                  {group.title}
                  <span className="font-normal normal-case">· {group.crops.length}</span>
                </summary>
                {/* Grille de cartes : image, nom, bordure de la rareté, pastille du sol. */}
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-1.5">
                  {group.crops.map((item) => {
                    const key = cropKey(item.ref)
                    const selected = key === selectedKey
                    const details = [item.side > 1 ? `${item.side}x${item.side}` : null, item.surface ? tr(`sol ${item.surface}`, `${item.surface} soil`) : null]
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
                          className={`relative flex h-full w-full flex-col items-center gap-0.5 rounded-md border bg-canvas/60 px-1 pt-1.5 pb-1 transition hover:bg-panel-raised motion-safe:active:scale-95 ${
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
                          <span aria-hidden="true" className="flex h-7 items-center">
                            {wikiImage(item.name) ? (
                              <WikiIcon name={item.name} size={26} />
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
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
