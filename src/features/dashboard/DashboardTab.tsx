import { useRef } from 'react'
import { tr } from '../../i18n/locale'
import { useGoalStatuses } from '../../store/useGoalStatuses'
import { GoalsSection } from '../goals/GoalsSection'
import { ImportPrompt } from '../profile/ImportPrompt'
import { UnconfirmedUsages } from '../goals/UnconfirmedUsages'
import { NextActionCard } from './NextActionCard'

/**
 * Tableau de bord, qui regroupe les objectifs, pensé pour tenir sur un écran. Grand écran : la
 * prochaine action et les usages à confirmer (repliés) à gauche, les objectifs à droite ; mobile :
 * prochaine action, objectifs, usages.
 */
export function DashboardTab() {
  const statuses = useGoalStatuses()
  const goalsHeading = useRef<HTMLHeadingElement>(null)

  return (
    <div className="space-y-4">
      <h2 className="sr-only">{tr('Tableau de bord', 'Dashboard')}</h2>
      <ImportPrompt />
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
        <NextActionCard statuses={statuses} onChooseGoals={() => goalsHeading.current?.focus()} />
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <GoalsSection statuses={statuses} headingRef={goalsHeading} />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <UnconfirmedUsages />
        </div>
      </div>
    </div>
  )
}
