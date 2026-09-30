import { useMemo, useState } from 'react'
import { tabHref } from '../../app/navigation'
import { NumberStepper } from '../../components/NumberStepper'
import { Panel } from '../../components/Panel'
import { SegmentedControl } from '../../components/SegmentedControl'
import { getGameData } from '../../data'
import { formatDuration } from '../../logic/format'
import { growthWithUpgrades, stageDurationSeconds } from '../../logic/growth'
import { lonelilyCellsIn, lonelilyEstimate, vineProgress } from '../../logic/tools'
import { useAppStore } from '../../store/appStore'
import { activeLayoutOf, toGridInput } from '../../store/grids'
import { useGoalPlan } from '../../store/useGoalPlan'

type Source = 'grids' | 'manual'

const decimal = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

/** « 1 », « 1 et 2 », « 1, 2 et 3 ». */
function numberList(numbers: readonly number[]): string {
  if (numbers.length <= 1) return numbers.join('')
  return `${numbers.slice(0, -1).join(', ')} et ${numbers[numbers.length - 1]}`
}

/** Combien de Lonelily attendre, et en combien de temps. */
export function LonelilyEstimator() {
  const data = getGameData()
  const rate = data.mechanics.lonelilyRatePerCell
  const { width, height, count } = data.mechanics.greenhouse
  const grids = useAppStore((s) => s.grids)
  const upgrades = useAppStore((s) => s.settings.growth.upgrades)
  const vines = useAppStore((s) => s.tools.vines)
  const { plan } = useGoalPlan()
  const lonelily = data.mutationsByName.get(rate.mutation)
  const missing = lonelily ? (plan.needs.get(lonelily.id)?.missing ?? 0) : 0

  const [source, setSource] = useState<Source>('grids')
  const [manualCells, setManualCells] = useState(width * height)
  const [stages, setStages] = useState(10)
  // Par défaut : ce que demandent encore les objectifs, sinon le total AVRG de la route.
  const [wanted, setWanted] = useState(missing > 0 ? missing : Math.max(1, lonelily?.roseDragonOptimum ?? 1))

  // Seuls les greenhouses débloqués comptent : le 1er, plus ceux achetés au NPC.
  const { unlocked, gridCells } = useMemo(() => {
    const open = vineProgress(data, vines).unlockedGreenhouses
    const cells = lonelilyCellsIn(
      data,
      grids.greenhouses.flatMap((greenhouse, index) => {
        const layout = activeLayoutOf(greenhouse)
        return layout && open.includes(index) ? [toGridInput(layout, { width, height })] : []
      }),
    )
    return { unlocked: open, gridCells: cells }
  }, [data, grids, width, height, vines])
  const cells = source === 'grids' ? gridCells : manualCells
  const estimate = lonelilyEstimate(data, cells, stages, wanted)
  const { formula } = data.mechanics.growthStage
  const stageSeconds = stageDurationSeconds(growthWithUpgrades(upgrades, formula), formula)

  return (
    <Panel title={`Estimation des ${rate.mutation}`}>
      <div className="space-y-4 text-sm">
        <p className="text-xs text-ink-muted">{rate.note}</p>
        <SegmentedControl
          legend="Cases prises en compte"
          name="lonelily-source"
          value={source}
          onChange={setSource}
          options={[
            { value: 'grids', label: 'Depuis mes grilles' },
            { value: 'manual', label: 'À la main' },
          ]}
        />
        {source === 'grids' ? (
          <p>
            <strong className="tabular-nums">{gridCells}</strong> case{gridCells > 1 ? 's' : ''} de Dirt vides et sans voisin
            {unlocked.length > 1
              ? ` dans les plans actifs des greenhouses ${numberList(unlocked.map((index) => index + 1))}.`
              : ' dans le plan actif du greenhouse 1.'}{' '}
            <span className="text-xs text-ink-muted">
              Les cases peintes comme verrouillées ou cassées dans la{' '}
              <a href={tabHref('grille')} className="text-accent-strong underline-offset-2 hover:underline">
                Grille
              </a>{' '}
              ne comptent pas
              {unlocked.length < count ? ', ni les greenhouses pas encore achetés (Plot Limit, dans les Upgrades du Greenhouse)' : ''}.
            </span>
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span>Cases de Dirt vides</span>
            <NumberStepper
              value={manualCells}
              onChange={setManualCells}
              name="Cases vides"
              inputLabel="Cases de Dirt vides"
              min={0}
              max={count * width * height}
            />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start">
            <span className="text-xs text-ink-muted">Sur combien de stages</span>
            <NumberStepper value={stages} onChange={setStages} name="Stages" inputLabel="Nombre de stages" min={1} max={999} />
          </div>
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start">
            <span className="text-xs text-ink-muted">{rate.mutation} voulues</span>
            <NumberStepper value={wanted} onChange={setWanted} name={`${rate.mutation} voulues`} inputLabel={`${rate.mutation} voulues`} min={1} max={999} />
          </div>
        </div>

        <dl className="space-y-2 rounded-lg border border-line bg-canvas/40 p-3">
          <div>
            <dt className="text-xs text-ink-muted">Par growth stage</dt>
            <dd>
              {decimal(estimate.perStage.min)} à {decimal(estimate.perStage.max)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">En {stages} stages</dt>
            <dd>
              {decimal(estimate.expected.min)} à {decimal(estimate.expected.max)} {rate.mutation}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Pour en avoir {wanted}</dt>
            <dd>
              {estimate.stagesFor
                ? `${estimate.stagesFor.min} à ${estimate.stagesFor.max} stages, soit ${formatDuration(estimate.stagesFor.min * stageSeconds)} à ${formatDuration(estimate.stagesFor.max * stageSeconds)}`
                : 'Impossible sans case vide.'}
            </dd>
          </div>
        </dl>
        {missing > 0 && (
          <p className="text-xs text-ink-muted">
            Tes objectifs suivis demandent encore {missing} {rate.mutation}.
          </p>
        )}
      </div>
    </Panel>
  )
}
