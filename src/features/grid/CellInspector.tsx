import { CropLabel } from '../../components/game/CropLabel'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { formatDecimal, tr } from '../../i18n/locale'
import { cropSide, type GridAnalysis, type GridInput } from '../../logic/grid'
import { cellName, groundLabel } from './gridText'

interface CellInspectorProps {
  readonly grid: GridInput
  readonly analysis: GridAnalysis
  readonly cell: number | null
  readonly waterStages: (cell: number) => number | null
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value} %`
}

/** Détail d'une case : sol, contenu, spawns possibles, effets reçus et eau. */
export function CellInspector({ grid, analysis, cell, waterStages }: CellInspectorProps) {
  const data = getGameData()
  if (cell === null) {
    return (
      <Panel title={tr('Case', 'Cell')}>
        <p className="text-sm text-ink-muted">{tr('Survole ou sélectionne une case pour voir son détail.', 'Hover or select a cell to see its details.')}</p>
      </Panel>
    )
  }

  const x = cell % grid.width
  const y = Math.floor(cell / grid.width)
  const placementIndex = analysis.occupancy[cell]
  const placement = placementIndex === null || placementIndex === undefined ? undefined : grid.placements[placementIndex]
  const spawn = analysis.cells[cell]
  const effects = analysis.effects[cell]
  const name = (id: string) => data.mutationsById.get(id)?.name ?? id
  const sourceName = (index: number) => {
    const crop = grid.placements[index]?.crop
    return crop ? (crop.kind === 'base' ? crop.name : name(crop.id)) : '?'
  }
  const water = waterStages(cell)
  const { lossPerStageRange, levelRange } = data.mechanics.water

  // Lignes identiques (même effet, même crop source, même relais) regroupées : « × 2 ».
  const grouped = new Map<string, { effect: string; from: string; via: string | null; cancelled: boolean; count: number }>()
  for (const contribution of effects?.contributions ?? []) {
    const from = sourceName(contribution.source)
    const via = contribution.via === null ? null : sourceName(contribution.via)
    const key = `${contribution.effect}|${from}|${via ?? ''}|${contribution.cancelled}`
    const existing = grouped.get(key)
    if (existing) existing.count += 1
    else grouped.set(key, { effect: contribution.effect, from, via, cancelled: contribution.cancelled, count: 1 })
  }

  return (
    <Panel title={tr(`Case ${cellName(x, y)}`, `Cell ${cellName(x, y)}`)}>
      <div className="space-y-3 text-sm">
        <p>
          <span className="text-ink-muted">{tr('Sol : ', 'Soil: ')}</span>
          {groundLabel(grid.ground[cell] ?? '')}
        </p>
        <p>
          {placement ? (
            <>
              <span className="text-ink-muted">{tr('Occupée par ', 'Taken by ')}</span>
              <CropLabel crop={placement.crop} />
              {cropSide(data, placement.crop) > 1 && (
                <span className="text-ink-muted">
                  {' '}
                  ({cropSide(data, placement.crop)}x{cropSide(data, placement.crop)}, {tr('ancre', 'anchor')} {cellName(placement.x, placement.y)})
                </span>
              )}
            </>
          ) : (
            <span className="text-ink-muted">{tr('Case vide', 'Empty cell')}</span>
          )}
        </p>

        {!placement && spawn && (
          <section>
            <h4 className="mb-1 text-xs font-medium text-ink-muted">{tr('Spawns possibles', 'Possible spawns')}</h4>
            {spawn.mutationIds.length === 0 ? (
              <p className="text-ink-muted">{tr("Aucun pour l'instant.", 'None for now.')}</p>
            ) : (
              <ul className="space-y-0.5">
                {spawn.mutationIds.map((id) => {
                  const option = spawn.options.find((o) => o.mutationId === id)
                  return (
                    <li key={id}>
                      <CropLabel crop={{ kind: 'mutation', id }} />
                      {option && option.side > 1 && (
                        <span className="text-xs text-ink-muted">
                          {' '}
                          {tr('zone', 'area')} {cellName(option.x, option.y)} → {cellName(option.x + option.side - 1, option.y + option.side - 1)}
                        </span>
                      )}
                      {spawn.winner === id && <span className="text-xs text-warning"> {tr('★ prioritaire', '★ priority')}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
            {spawn.conflict && (
              <p className="mt-1.5 text-xs text-danger">
                {tr('⚠ Conflit : plusieurs mutations peuvent spawn ici. ', '⚠ Conflict: several mutations can spawn here. ')}
                {spawn.winner
                  ? tr(`${name(spawn.winner)} l'emporte (priorité).`, `${name(spawn.winner)} wins (priority).`)
                  : tr('Une seule spawnera, au hasard.', 'Only one will spawn, at random.')}
              </p>
            )}
          </section>
        )}

        {effects && (
          <section>
            <h4 className="mb-1 text-xs font-medium text-ink-muted">{tr('Effets reçus', 'Received effects')}</h4>
            {grouped.size === 0 ? (
              <p className="text-ink-muted">{tr('Aucun effet reçu.', 'No effect received.')}</p>
            ) : (
              <ul className="space-y-0.5">
                {[...grouped].map(([key, line]) => {
                  const positive = data.effects.get(line.effect)?.type === 'positive'
                  return (
                    <li key={key} className={line.cancelled ? 'text-ink-muted line-through' : ''}>
                      <span className={positive ? 'text-accent-strong' : 'text-danger'}>
                        <span aria-hidden="true">{positive ? '＋' : '−'}</span> {line.effect}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {' '}
                        {tr('de', 'from')} {line.from}
                        {line.count > 1 && ` × ${line.count}`}
                        {line.via !== null && ` (via ${line.via})`}
                      </span>
                      {line.cancelled && <span className="sr-only">{tr(' (annulé par Immunity)', ' (cancelled by Immunity)')}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-1.5 text-xs text-ink-muted">
              {tr('Total : ', 'Total: ')}yield {signed(effects.totals.yield)} · XP {signed(effects.totals.xp)} · {tr('eau', 'water')}{' '}
              {signed(effects.totals.water)}
              {effects.immunity && tr(' · immunité', ' · immunity')}
              {effects.bonusDrops && ' · bonus drops'}
            </p>
          </section>
        )}

        {water !== null && (
          <section>
            <h4 className="mb-1 text-xs font-medium text-ink-muted">{tr('Eau', 'Water')}</h4>
            <p>
              {Number.isFinite(water)
                ? tr(`Environ ${water} stages avant d'être à sec`, `About ${water} stages before running dry`)
                : tr('Ne sèche jamais (rétention d’au moins +100 %)', 'Never dries out (retention of at least +100%)')}
            </p>
            <p className="text-xs text-ink-muted">
              {tr(
                `Départ à ${levelRange.max}, perte moyenne de ${formatDecimal((lossPerStageRange.min + lossPerStageRange.max) / 2, 2)} par stage.`,
                `Starts at ${levelRange.max}, average loss of ${formatDecimal((lossPerStageRange.min + lossPerStageRange.max) / 2, 2)} per stage.`,
              )}
            </p>
          </section>
        )}
      </div>
    </Panel>
  )
}
