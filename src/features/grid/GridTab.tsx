import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { tabElementId, tabPanelId } from '../../components/tabIds'
import { Tabs } from '../../components/Tabs'
import { getGameData } from '../../data'
import { analyzeGrid } from '../../logic/grid'
import { vineProgress } from '../../logic/tools'
import { stagesBeforeDry } from '../../logic/water'
import { useAppStore } from '../../store/appStore'
import { activeLayoutOf, toGridInput } from '../../store/grids'
import type { CropRef } from '../../types/game'
import { AutofillPanel } from './AutofillPanel'
import { CellInspector } from './CellInspector'
import { ConsumptionPanel } from './ConsumptionPanel'
import { GodseedPanel } from './GodseedPanel'
import { GridBoard } from './GridBoard'
import { GridLegend } from './GridLegend'
import { buildShortLabels } from './gridText'
import { DEFAULT_OVERLAYS, type GridTool, type Overlays } from './gridTypes'
import { LayoutToolbar } from './LayoutToolbar'
import { LockedGreenhouse } from './LockedGreenhouse'
import { OverlayToggles } from './OverlayToggles'
import { Palette } from './Palette'

const TABS_PREFIX = 'greenhouse'

/**
 * Onglet Grille : 3 greenhouses, plusieurs plans chacun, palette, plateau et analyse. Il utilise
 * toute la largeur de la page (voir app/tabs.ts).
 */
export function GridTab() {
  const data = getGameData()
  const size = data.mechanics.greenhouse
  const grids = useAppStore((s) => s.grids)
  const setActiveGreenhouse = useAppStore((s) => s.setActiveGreenhouse)
  const placeCrop = useAppStore((s) => s.placeCrop)
  const removeCropAt = useAppStore((s) => s.removeCropAt)
  const paintGround = useAppStore((s) => s.paintGround)
  const vines = useAppStore((s) => s.tools.vines)

  const [tool, setTool] = useState<GridTool>('place')
  const [crop, setCrop] = useState<CropRef | null>(null)
  const [brush, setBrush] = useState(data.surfaces[0] ?? '')
  const [overlays, setOverlays] = useState<Overlays>(DEFAULT_OVERLAYS)
  // Sélection et zone Godseed retiennent leur plan : elles disparaissent quand on en change.
  const [selection, setSelection] = useState<{ layoutId: string; cell: number } | null>(null)
  const [zoneAnchor, setZoneAnchor] = useState<{ layoutId: string; cell: number } | null>(null)
  const [hoverCell, setHoverCell] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteTitleId = useId()

  const greenhouseIndex = grids.activeGreenhouse
  const greenhouse = grids.greenhouses[greenhouseIndex]
  const layout = greenhouse ? activeLayoutOf(greenhouse) : undefined
  const grid = useMemo(() => (layout ? toGridInput(layout, size) : null), [layout, size])
  const analysis = useMemo(() => (grid ? analyzeGrid(data, grid) : null), [data, grid])
  const labels = useMemo(
    () => buildShortLabels([...data.mutations.map((m) => m.name), ...data.baseCrops.map((c) => c.name)]),
    [data],
  )
  const selectedCell = selection && selection.layoutId === layout?.id ? selection.cell : null
  const anchor = zoneAnchor && zoneAnchor.layoutId === layout?.id ? zoneAnchor.cell : null

  // Les messages (pose refusée…) disparaissent seuls.
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  const waterStages = useCallback(
    (cell: number) => {
      if (!analysis || analysis.occupancy[cell] === null) return null
      const { lossPerStageRange, levelRange } = data.mechanics.water
      return stagesBeforeDry({
        startLevel: levelRange.max,
        lossPerStage: (lossPerStageRange.min + lossPerStageRange.max) / 2,
        retentionPercent: analysis.effects[cell]?.totals.water ?? 0,
        levelRange,
      })
    },
    [analysis, data],
  )

  if (!greenhouse || !layout || !grid || !analysis) return null

  // Seuls les greenhouses débloqués dans Outils (Plot Limit) se modifient.
  const vineState = vineProgress(data, vines)
  const unlocked = vineState.unlockedGreenhouses
  const locked = !unlocked.includes(greenhouseIndex)

  const select = (cell: number) => setSelection({ layoutId: layout.id, cell })
  const place = (cell: number, cropToPlace: CropRef) => {
    const error = placeCrop(greenhouseIndex, layout.id, cropToPlace, cell % size.width, Math.floor(cell / size.width))
    setMessage(error)
    select(cell)
  }

  const onCellAction = (cell: number, kind: 'primary' | 'erase') => {
    const x = cell % size.width
    const y = Math.floor(cell / size.width)
    if (kind === 'erase' || tool === 'erase') {
      removeCropAt(greenhouseIndex, layout.id, x, y)
      return
    }
    switch (tool) {
      case 'place':
        if (crop) place(cell, crop)
        else setMessage('Choisis d’abord un crop dans la palette.')
        break
      case 'ground':
        paintGround(greenhouseIndex, layout.id, x, y, brush)
        break
      case 'godseed':
        setZoneAnchor({ layoutId: layout.id, cell })
        select(cell)
        break
      case 'inspect':
        select(cell)
        break
    }
  }

  const godseed = data.mutations.find((m) => m.spawnRule === 'requiredEffectsAround')
  const zone =
    tool === 'godseed' && anchor !== null && godseed
      ? { x: anchor % size.width, y: Math.floor(anchor / size.width), side: godseed.side }
      : null
  const inspected = hoverCell ?? selectedCell
  const palette = (
    <Palette
      tool={tool}
      onToolChange={setTool}
      crop={crop}
      onCropChange={setCrop}
      brush={brush}
      onBrushChange={setBrush}
      allowLocked={greenhouseIndex === 0}
      labels={labels}
    />
  )

  const editor = (
    <>
      <LayoutToolbar greenhouse={greenhouseIndex} layouts={greenhouse.layouts} active={layout} />

      {/* Plateau au centre de la zone ; la case et la consommation à côté en grand écran. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-3">
          {/* En grand écran, les cases « Afficher » passent à côté de la grille : elle garde la hauteur. */}
          <div className="flex flex-wrap items-center justify-between gap-3 xl:hidden">
            <OverlayToggles value={overlays} onChange={setOverlays} />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm lg:hidden"
            >
              Palette
            </button>
          </div>
          <GridBoard
            grid={grid}
            analysis={analysis}
            overlays={overlays}
            labels={labels}
            selectedCell={selectedCell}
            zone={zone}
            paintMode={tool === 'ground' || tool === 'erase'}
            waterStages={waterStages}
            onCellAction={onCellAction}
            onHover={setHoverCell}
            onDropCrop={(cell, dropped) => {
              setCrop(dropped)
              setTool('place')
              place(cell, dropped)
            }}
            label={`Greenhouse ${greenhouseIndex + 1}, plan « ${layout.name} », ${size.width} x ${size.height} cases`}
          />
          <p aria-live="polite" className="min-h-5 text-sm text-warning">
            <span key={message} className="inline-block animate-fade-in">
              {message}
            </span>
          </p>
          <GridLegend />
        </div>

        <div className="space-y-4">
          <div className="hidden rounded-xl border border-line bg-panel p-3 xl:block">
            <OverlayToggles value={overlays} onChange={setOverlays} />
          </div>
          {tool === 'godseed' ? (
            <GodseedPanel grid={grid} analysis={analysis} anchor={anchor} />
          ) : (
            <CellInspector grid={grid} analysis={analysis} cell={inspected} waterStages={waterStages} />
          )}
          <ConsumptionPanel />
          <AutofillPanel key={greenhouseIndex} greenhouse={greenhouseIndex} layout={layout} />
        </div>
      </div>
    </>
  )

  // Mise en page de SkyCrypt, sur toute la largeur : les crops et mutations à gauche, sur toute la
  // hauteur (la place du personnage), la grille à droite (la place des stats).
  return (
    <div className="gap-5 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[minmax(22rem,28%)_minmax(0,1fr)]">
      <h2 className="sr-only">Grille</h2>

      <aside aria-labelledby={paletteTitleId} className="hidden lg:block">
        <div className="sticky top-32 flex h-[calc(100dvh-9rem)] flex-col rounded-2xl border border-line bg-panel p-4 shadow-lg shadow-black/20 xl:top-20 xl:h-[calc(100dvh-6rem)]">
          <h3 id={paletteTitleId} className="mb-3 text-base font-semibold">
            Crops et mutations
          </h3>
          {palette}
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <Tabs
          tabs={grids.greenhouses.map((_, index) => ({
            id: String(index),
            label: `Greenhouse ${index + 1}${unlocked.includes(index) ? '' : ' 🔒'}`,
          }))}
          selected={String(greenhouseIndex)}
          onSelect={(id) => setActiveGreenhouse(Number(id))}
          idPrefix={TABS_PREFIX}
          label="Greenhouses"
          className="border-b border-line"
        />

        <div
          role="tabpanel"
          id={tabPanelId(TABS_PREFIX, String(greenhouseIndex))}
          aria-labelledby={tabElementId(TABS_PREFIX, String(greenhouseIndex))}
          className="space-y-4"
        >
          {locked ? (
            <LockedGreenhouse
              index={greenhouseIndex}
              price={vineState.purchases[greenhouseIndex - 1]?.price}
              previousLocked={greenhouseIndex > 1 && !unlocked.includes(greenhouseIndex - 1)}
            />
          ) : (
            editor
          )}
        </div>
      </div>

      {paletteOpen && !locked && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Palette">
          <button
            type="button"
            aria-label="Fermer la palette"
            className="absolute inset-0 bg-black/50"
            onClick={() => setPaletteOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-line bg-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Palette</h3>
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="rounded-lg border border-line px-3 py-1 text-sm"
              >
                Fermer
              </button>
            </div>
            {palette}
          </div>
        </div>
      )}
    </div>
  )
}
