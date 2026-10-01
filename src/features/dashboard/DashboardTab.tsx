import { useRef } from 'react'
import { tr } from '../../i18n/locale'
import { useGoalStatuses } from '../../store/useGoalStatuses'
import { GoalsSection } from '../goals/GoalsSection'
import { CraftList } from '../goals/CraftList'
import { HomeHero } from './HomeHero'
import { NextActionCard } from './NextActionCard'

/**
 * Tableau de bord, la page d'accueil : l'encadré d'accueil (pseudo Hypixel), puis les objectifs.
 * Grand écran : la prochaine action et les crafts (repliés) à gauche, les objectifs à droite ;
 * mobile : prochaine action, objectifs, crafts.
 */
export function DashboardTab() {
  const statuses = useGoalStatuses()
  const goalsHeading = useRef<HTMLHeadingElement>(null)

  return (
    <div className="space-y-4">
      <h2 className="sr-only">{tr('Tableau de bord', 'Dashboard')}</h2>
      <HomeHero />
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
        <NextActionCard statuses={statuses} onChooseGoals={() => goalsHeading.current?.focus()} />
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <GoalsSection statuses={statuses} headingRef={goalsHeading} />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <CraftList />
        </div>
      </div>
    </div>
  )
}
