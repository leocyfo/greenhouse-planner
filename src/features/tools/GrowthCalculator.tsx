import { useState } from 'react'
import { formatNumber } from '../../components/labels'
import { NumberStepper } from '../../components/NumberStepper'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { formatDuration } from '../../logic/format'
import { growthWithUpgrades, harvestStage, stageDurationSeconds } from '../../logic/growth'
import { useAppStore } from '../../store/appStore'

/**
 * Durée d'un growth stage et d'un nombre de stages. Seul le Growth Speed se règle (fenêtre
 * Minecraft des upgrades) ; crops uniques et Crop Growth sont comptés au maximum.
 */
export function GrowthCalculator() {
  const data = getGameData()
  const { formula } = data.mechanics.growthStage
  const upgrades = useAppStore((s) => s.settings.growth.upgrades)
  const [stages, setStages] = useState(20)
  const [mutationId, setMutationId] = useState('')

  const seconds = stageDurationSeconds(growthWithUpgrades(upgrades, formula), formula)
  const speed = (formula.baseHours * 3600) / seconds
  const mutation = data.mutationsById.get(mutationId)
  const mutationStages = mutation ? harvestStage(mutation) : null

  return (
    <Panel title="Durée d'un growth stage">
      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-canvas/40 p-3">
          <p className="text-2xl font-semibold">{formatDuration(seconds)}</p>
          <p className="text-xs text-ink-muted">
            par growth stage, soit {speed.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} fois plus vite que les{' '}
            {formula.baseHours} h de base. Growth Speed réglé dans les Upgrades du Greenhouse ; {formula.uniqueCropsMax}{' '}
            crops uniques et {formula.cropGrowthMax} de Crop Growth comptés au maximum. Sert aussi aux estimations du
            Calculateur.
          </p>
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-xs font-medium text-ink-muted">Durée de plusieurs stages</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-48 flex-col gap-1 text-xs text-ink-muted">
              Mutation (optionnel)
              <select
                value={mutationId}
                onChange={(event) => setMutationId(event.target.value)}
                className="h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink"
              >
                <option value="">Nombre de stages libre</option>
                {data.mutations
                  .filter((m) => (harvestStage(m) ?? 0) > 0)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({harvestStage(m)} stages)
                    </option>
                  ))}
              </select>
            </label>
            {!mutation && (
              <div className="flex flex-col gap-1 text-xs text-ink-muted">
                <span aria-hidden="true">Stages</span>
                <NumberStepper value={stages} onChange={setStages} name="Stages" inputLabel="Nombre de stages" min={1} max={999} />
              </div>
            )}
          </div>
          <p className="text-sm">
            {formatNumber(mutationStages ?? stages)} stages ≈{' '}
            <strong>{formatDuration((mutationStages ?? stages) * seconds)}</strong>
            {mutation?.harvest && <span className="text-xs text-ink-muted"> (stage de récolte conseillé)</span>}
          </p>
        </div>
      </div>
    </Panel>
  )
}
