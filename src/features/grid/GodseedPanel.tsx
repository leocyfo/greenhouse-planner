import type { ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { requiredEffectsCheck, type GridAnalysis, type GridInput } from '../../logic/grid'
import { cellName } from './gridText'

function Check({ ok, children }: { readonly ok: boolean; readonly children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true" className={ok ? 'text-accent-strong' : 'text-danger'}>
        {ok ? '✓' : '✗'}
      </span>
      <span className="sr-only">{ok ? tr('Rempli : ', 'Met: ') : tr('Manquant : ', 'Missing: ')}</span>
      <span className={ok ? '' : 'text-ink-muted'}>{children}</span>
    </li>
  )
}

interface GodseedPanelProps {
  readonly grid: GridInput
  readonly analysis: GridAnalysis
  /** Case en haut à gauche de la zone vérifiée. */
  readonly anchor: number | null
}

/** Vérificateur des mutations à effets requis (Godseed) pour la zone choisie. */
export function GodseedPanel({ grid, analysis, anchor }: GodseedPanelProps) {
  const data = getGameData()
  const mutations = data.mutations.filter((m) => m.spawnRule === 'requiredEffectsAround')
  const sourceName = (index: number) => {
    const crop = grid.placements[index]?.crop
    return crop ? (crop.kind === 'base' ? crop.name : (data.mutationsById.get(crop.id)?.name ?? crop.id)) : '?'
  }

  return (
    <>
      {mutations.map((mutation) => {
        if (anchor === null) {
          return (
            <Panel key={mutation.id} title={tr(`Vérificateur ${mutation.name}`, `${mutation.name} checker`)}>
              <p className="text-sm text-ink-muted">
                {tr(
                  `Clique sur la case en haut à gauche d'une zone ${mutation.size} vide pour vérifier les effets requis.`,
                  `Click the top-left cell of an empty ${mutation.size} area to check the required effects.`,
                )}
              </p>
            </Panel>
          )
        }
        const x = anchor % grid.width
        const y = Math.floor(anchor / grid.width)
        const check = requiredEffectsCheck(data, grid, analysis.occupancy, mutation, x, y)
        return (
          <Panel
            key={mutation.id}
            title={tr(`Vérificateur ${mutation.name}`, `${mutation.name} checker`)}
          >
            <p className="mb-2 text-xs text-ink-muted">
              {tr('Zone', 'Area')} {cellName(x, y)} → {cellName(x + mutation.side - 1, y + mutation.side - 1)}
            </p>
            <ul className="space-y-1 text-sm">
              <Check ok={check.fits}>{tr('La zone tient dans la grille', 'The area fits in the grid')}</Check>
              <Check ok={check.footprintFree}>{tr('Les cases de la zone sont vides et utilisables', 'The cells of the area are empty and usable')}</Check>
              <Check ok={check.soilOk}>{tr(`Sol : ${mutation.surface}`, `Soil: ${mutation.surface}`)}</Check>
              {check.effects.map((effect) => (
                <Check key={effect.name} ok={effect.sources.length > 0}>
                  {effect.name}
                  <span className="text-xs text-ink-muted">
                    {effect.sources.length > 0 ? ` — ${effect.sources.map(sourceName).join(', ')}` : tr(' — manquant', ' — missing')}
                  </span>
                </Check>
              ))}
              <Check ok={check.hasOtherCrop}>
                {tr(`Au moins un crop autour qui n'est pas un ${mutation.name}`, `At least one crop around that is not a ${mutation.name}`)}
              </Check>
            </ul>
            <p className={`mt-3 text-sm ${check.ready ? 'text-accent-strong' : 'text-ink-muted'}`}>
              {check.ready
                ? tr(`✓ Tout est réuni : ${mutation.name} peut spawn ici, et il est prioritaire.`, `✓ All set: ${mutation.name} can spawn here, and it has priority.`)
                : check.missing.length > 0
                  ? tr(`Effets manquants : ${check.missing.join(', ')}.`, `Missing effects: ${check.missing.join(', ')}.`)
                  : tr('La zone ne convient pas encore.', 'The area does not fit yet.')}
            </p>
          </Panel>
        )
      })}
    </>
  )
}
