import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import { ALL_GOALS, guideGoalIds } from './guideScope'

/** Choix du guide : un par objectif des données, ou tous réunis ; gardé dans les réglages. */
export function GuideSwitcher() {
  const data = getGameData()
  const guide = useAppStore((s) => s.settings.guide)
  const setGuide = useAppStore((s) => s.setGuide)
  const current = guide === ALL_GOALS ? ALL_GOALS : (guideGoalIds(data, guide)[0] ?? '')
  const options = [...data.goals.map((goal) => ({ id: goal.id, name: goal.name })), { id: ALL_GOALS, name: tr('Tout combiné', 'All combined') }]
  return (
    <div role="group" aria-label={tr('Guide affiché', 'Guide shown')} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-bold tracking-wider text-ink-muted uppercase">{tr('Guide', 'Guide')}</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={current === option.id}
          onClick={() => setGuide(option.id)}
          className="rounded-full border border-line px-3 py-1 text-sm text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink aria-pressed:border-accent/60 aria-pressed:bg-accent/15 aria-pressed:font-medium aria-pressed:text-accent-strong"
        >
          {option.name}
        </button>
      ))}
    </div>
  )
}
