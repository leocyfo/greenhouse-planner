import { useMemo, useState } from 'react'
import { tabHref } from '../../app/navigation'
import { NumberStepper } from '../../components/NumberStepper'
import { Panel } from '../../components/Panel'
import { SegmentedControl } from '../../components/SegmentedControl'
import { getGameData } from '../../data'
import { formatDecimal, tr } from '../../i18n/locale'
import { formatDuration } from '../../logic/format'
import { growthWithUpgrades, stageDurationSeconds } from '../../logic/growth'
import { lonelilyCellsIn, lonelilyEstimate, vineProgress } from '../../logic/tools'
import { useAppStore } from '../../store/appStore'
import { activeLayoutOf, toGridInput } from '../../store/grids'
import { useGoalPlan } from '../../store/useGoalPlan'

type Source = 'grids' | 'manual'

const decimal = (value: number) => formatDecimal(value, 2)

/** « 1 », « 1 et 2 », « 1, 2 et 3 ». */
function numberList(numbers: readonly number[]): string {
  if (numbers.length <= 1) return numbers.join('')
  return `${numbers.slice(0, -1).join(', ')} ${tr('et', 'and')} ${numbers[numbers.length - 1]}`
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
    <Panel title={tr(`Estimation des ${rate.mutation}`, `${rate.mutation} estimate`)}>
      <div className="space-y-4 text-sm">
        <p className="text-xs text-ink-muted">{rate.note}</p>
        <SegmentedControl
          legend={tr('Cases prises en compte', 'Cells taken into account')}
          name="lonelily-source"
          value={source}
          onChange={setSource}
          options={[
            { value: 'grids', label: tr('Depuis mes grilles', 'From my grids') },
            { value: 'manual', label: tr('À la main', 'By hand') },
          ]}
        />
        {source === 'grids' ? (
          <p>
            <strong className="tabular-nums">{gridCells}</strong>{' '}
            {tr(`case${gridCells > 1 ? 's' : ''} de Dirt vides et sans voisin`, `empty Dirt cell${gridCells !== 1 ? 's' : ''} with no neighbor`)}
            {unlocked.length > 1
              ? tr(
                  ` dans les plans actifs des greenhouses ${numberList(unlocked.map((index) => index + 1))}.`,
                  ` in the active plans of greenhouses ${numberList(unlocked.map((index) => index + 1))}.`,
                )
              : tr(' dans le plan actif du greenhouse 1.', ' in the active plan of greenhouse 1.')}{' '}
            <span className="text-xs text-ink-muted">
              {tr('Les cases peintes comme verrouillées ou cassées dans la ', 'Cells painted as locked or broken in the ')}
              <a href={tabHref('grille')} className="text-accent-strong underline-offset-2 hover:underline">
                {tr('Grille', 'Grid')}
              </a>{' '}
              {tr('ne comptent pas', "don't count")}
              {unlocked.length < count
                ? tr(
                    ', ni les greenhouses pas encore achetés (Plot Limit, dans les Upgrades du Greenhouse)',
                    ', nor the greenhouses not bought yet (Plot Limit, in the Greenhouse Upgrades)',
                  )
                : ''}
              .
            </span>
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span>{tr('Cases de Dirt vides', 'Empty Dirt cells')}</span>
            <NumberStepper
              value={manualCells}
              onChange={setManualCells}
              name={tr('Cases vides', 'Empty cells')}
              inputLabel={tr('Cases de Dirt vides', 'Empty Dirt cells')}
              min={0}
              max={count * width * height}
            />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start">
            <span className="text-xs text-ink-muted">{tr('Sur combien de stages', 'Over how many stages')}</span>
            <NumberStepper value={stages} onChange={setStages} name="Stages" inputLabel={tr('Nombre de stages', 'Number of stages')} min={1} max={999} />
          </div>
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start">
            <span className="text-xs text-ink-muted">{tr(`${rate.mutation} voulues`, `${rate.mutation} wanted`)}</span>
            <NumberStepper
              value={wanted}
              onChange={setWanted}
              name={tr(`${rate.mutation} voulues`, `${rate.mutation} wanted`)}
              inputLabel={tr(`${rate.mutation} voulues`, `${rate.mutation} wanted`)}
              min={1}
              max={999}
            />
          </div>
        </div>

        <dl className="space-y-2 rounded-lg border border-line bg-canvas/40 p-3">
          <div>
            <dt className="text-xs text-ink-muted">{tr('Par growth stage', 'Per growth stage')}</dt>
            <dd>{tr(`${decimal(estimate.perStage.min)} à ${decimal(estimate.perStage.max)}`, `${decimal(estimate.perStage.min)} to ${decimal(estimate.perStage.max)}`)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{tr(`En ${stages} stages`, `In ${stages} stages`)}</dt>
            <dd>
              {tr(
                `${decimal(estimate.expected.min)} à ${decimal(estimate.expected.max)} ${rate.mutation}`,
                `${decimal(estimate.expected.min)} to ${decimal(estimate.expected.max)} ${rate.mutation}`,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{tr(`Pour en avoir ${wanted}`, `To get ${wanted}`)}</dt>
            <dd>
              {estimate.stagesFor
                ? tr(
                    `${estimate.stagesFor.min} à ${estimate.stagesFor.max} stages, soit ${formatDuration(estimate.stagesFor.min * stageSeconds)} à ${formatDuration(estimate.stagesFor.max * stageSeconds)}`,
                    `${estimate.stagesFor.min} to ${estimate.stagesFor.max} stages, that is ${formatDuration(estimate.stagesFor.min * stageSeconds)} to ${formatDuration(estimate.stagesFor.max * stageSeconds)}`,
                  )
                : tr('Impossible sans case vide.', 'Impossible without an empty cell.')}
            </dd>
          </div>
        </dl>
        {missing > 0 && (
          <p className="text-xs text-ink-muted">
            {tr(`Tes objectifs suivis demandent encore ${missing} ${rate.mutation}.`, `Your followed goals still need ${missing} ${rate.mutation}.`)}
          </p>
        )}
      </div>
    </Panel>
  )
}
