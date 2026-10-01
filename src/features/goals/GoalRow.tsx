import { useId, useState } from 'react'
import { WikiIcon } from '../../components/game/WikiIcon'
import { formatGoalType, formatPercent } from '../../components/labels'
import { ProgressBar } from '../../components/ProgressBar'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import type { GoalStatus } from '../../store/useGoalStatuses'
import { GoalDetails } from './GoalDetails'

/** Un objectif sur une ligne : case « suivi », nom et avancement ; le détail se déplie dessous. */
export function GoalRow({ status }: { readonly status: GoalStatus }) {
  const setGoalActive = useAppStore((s) => s.setGoalActive)
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const { goal, active, completion } = status

  const percent = formatPercent(completion.done, completion.total)

  return (
    <li className="py-2">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setGoalActive(goal.id, event.target.checked)}
          aria-label={tr(`Suivre ${goal.name}`, `Follow ${goal.name}`)}
          title={tr('Suivre cet objectif', 'Follow this goal')}
          className="size-4 shrink-0 cursor-pointer accent-accent"
        />
        {/* Place fixe : les noms restent alignés quand le wiki n'a pas d'image. */}
        <span className="flex size-8 shrink-0 items-center justify-center">
          <WikiIcon name={goal.name} size={32} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={`transition-colors ${active ? 'font-medium' : 'text-ink-muted'}`}>{goal.name}</span>
            <span className="text-xs text-ink-muted">{formatGoalType(goal.type)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar value={completion.done} max={completion.total} label={`${goal.name} : ${percent}`} className="flex-1" />
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-muted">{percent}</span>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((value) => !value)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
        >
          <span className="sr-only">{tr(`Détails : ${goal.name}`, `Details: ${goal.name}`)}</span>
          <span aria-hidden="true" className={`inline-block transition-transform ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
      </div>
      <div id={detailsId} hidden={!open} className="mt-3 animate-fade-up rounded-lg bg-canvas/40 p-3 sm:ml-[4.5rem]">
        <GoalDetails status={status} />
      </div>
    </li>
  )
}
