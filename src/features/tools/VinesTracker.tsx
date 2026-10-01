import { tabHref } from '../../app/navigation'
import { WikiIcon } from '../../components/game/WikiIcon'
import { formatPercent } from '../../components/labels'
import { NumberStepper } from '../../components/NumberStepper'
import { Panel } from '../../components/Panel'
import { ProgressBar } from '../../components/ProgressBar'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { vineProgress } from '../../logic/tools'
import { useAppStore } from '../../store/appStore'

/**
 * Ethereal Vines : le 1er greenhouse s'ouvre case par case (1 vine par case), puis les
 * greenhouses 2 et 3 s'achètent en une fois, via l'upgrade Plot Limit (menu Greenhouse Upgrades).
 */
export function VinesTracker() {
  const data = getGameData()
  const vines = useAppStore((s) => s.tools.vines)
  const setVines = useAppStore((s) => s.setVines)
  const progress = vineProgress(data, vines)
  const { first } = progress
  const { etherealVines } = data.mechanics
  const bought = progress.purchases.filter((purchase) => purchase.unlocked)
  // Le 2e greenhouse s'achète une fois le 1er entièrement ouvert : son compteur reste alors au maximum.
  const firstLocked = bought.length > 0
  const allFirstOpen = progress.firstGreenhouseSpots >= progress.firstGreenhouseCells

  return (
    <Panel title="Ethereal Vines">
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">{tr('Greenhouse 1 : cases à débloquer', 'Greenhouse 1: cells to unlock')}</span>
            <div className="ml-auto flex items-center gap-2">
              <NumberStepper
                value={first.spent}
                onChange={(value) => setVines({ first: value })}
                name="Greenhouse 1"
                inputLabel={tr('Greenhouse 1 : vines dépensées en cases', 'Greenhouse 1: vines spent on cells')}
                min={firstLocked ? first.needed : 0}
                max={first.needed}
              />
              <span className="w-12 text-right text-xs tabular-nums text-ink-muted">/ {first.needed}</span>
            </div>
          </div>
          <ProgressBar
            value={first.spent}
            max={first.needed}
            label={tr(`Greenhouse 1 : ${first.spent} vines sur ${first.needed}`, `Greenhouse 1: ${first.spent} vines out of ${first.needed}`)}
            className="mt-1.5"
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            {tr(
              `Cases ouvertes : ${progress.firstGreenhouseSpots} / ${progress.firstGreenhouseCells}.`,
              `Open cells: ${progress.firstGreenhouseSpots} / ${progress.firstGreenhouseCells}.`,
            )}{' '}
            {firstLocked ? (
              tr(`Bloqué à ${first.needed} : le Plot Limit est débloqué.`, `Locked at ${first.needed}: the Plot Limit is unlocked.`)
            ) : (
              !allFirstOpen && (
                <a href={tabHref('grille')} className="text-accent-strong underline-offset-2 hover:underline">
                  {tr('Peindre les cases encore verrouillées dans la Grille', 'Paint the cells still locked in the Grid')}
                </a>
              )
            )}
          </p>
        </div>

        {/* Réglé par l'upgrade Plot Limit du menu Greenhouse Upgrades : simple rappel ici. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span>{tr('Greenhouses 2 et 3 : Plot Limit', 'Greenhouses 2 and 3: Plot Limit')}</span>
          <span className="tabular-nums text-ink-muted">
            tier {bought.length}/{progress.purchases.length} ({bought.reduce((sum, purchase) => sum + purchase.price, 0)} vines)
            <span className="text-xs">{tr(' · réglé dans les Upgrades du Greenhouse', ' · set in the Greenhouse Upgrades')}</span>
          </span>
        </div>

        <div className="rounded-lg border border-line bg-canvas/40 p-3">
          <p className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
              <WikiIcon name="Ethereal Vine" size={32} />
              {progress.spent} / {progress.total}
            </span>
            <span className="text-sm tabular-nums text-ink-muted">{formatPercent(progress.spent, progress.total)}</span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">{tr('vines dépensées au total', 'vines spent in total')}</p>
        </div>
        <p className="text-xs text-ink-muted">{etherealVines.description}</p>
        <p className="text-xs text-ink-muted">{etherealVines.avrgNotes}</p>
      </div>
    </Panel>
  )
}
