import type { ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { requiredEffectsCheck, type GridAnalysis, type GridInput } from '../../logic/grid'
import { cellName } from './gridText'

function Check({ ok, children }: { readonly ok: boolean; readonly children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true" className={ok ? 'text-accent-strong' : 'text-danger'}>
        {ok ? '✓' : '✗'}
      </span>
      <span className="sr-only">{ok ? 'Rempli : ' : 'Manquant : '}</span>
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
            <Panel key={mutation.id} title={`Vérificateur ${mutation.name}`}>
              <p className="text-sm text-ink-muted">
                Clique sur la case en haut à gauche d&apos;une zone {mutation.size} vide pour vérifier les effets requis.
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
            title={`Vérificateur ${mutation.name}`}
          >
            <p className="mb-2 text-xs text-ink-muted">
              Zone {cellName(x, y)} → {cellName(x + mutation.side - 1, y + mutation.side - 1)}
            </p>
            <ul className="space-y-1 text-sm">
              <Check ok={check.fits}>La zone tient dans la grille</Check>
              <Check ok={check.footprintFree}>Les cases de la zone sont vides et utilisables</Check>
              <Check ok={check.soilOk}>Sol : {mutation.surface}</Check>
              {check.effects.map((effect) => (
                <Check key={effect.name} ok={effect.sources.length > 0}>
                  {effect.name}
                  <span className="text-xs text-ink-muted">
                    {effect.sources.length > 0 ? ` — ${effect.sources.map(sourceName).join(', ')}` : ' — manquant'}
                  </span>
                </Check>
              ))}
              <Check ok={check.hasOtherCrop}>Au moins un crop autour qui n&apos;est pas un {mutation.name}</Check>
            </ul>
            <p className={`mt-3 text-sm ${check.ready ? 'text-accent-strong' : 'text-ink-muted'}`}>
              {check.ready
                ? `✓ Tout est réuni : ${mutation.name} peut spawn ici, et il est prioritaire.`
                : check.missing.length > 0
                  ? `Effets manquants : ${check.missing.join(', ')}.`
                  : 'La zone ne convient pas encore.'}
            </p>
          </Panel>
        )
      })}
    </>
  )
}
