import { useEffect, useMemo } from 'react'
import { getGameData } from '../../data'
import { growthWithUpgrades } from '../../logic/growth'
import { vineProgress } from '../../logic/tools'
import { useAppStore } from '../../store/appStore'
import { activeLayoutOf, toGridInput } from '../../store/grids'
import { computeCalculatorResult } from '../calculator/calculatorResult'
import { farmGroups } from './farmGroups'
import { alignStages, farmsIn } from './farmPacking'
import { guideChapters, guideContext, guideNow } from './guideModel'
import { guideGoalIds, guideScope } from './guideScope'

/**
 * Le guide affiché (réglage `settings.guide`), calculé depuis le stock, les greenhouses et les
 * réglages : ses objectifs et ses fermes (guideScope), leurs besoins (route du guide, mode Optimum),
 * les chapitres, les greenhouses débloqués et « À faire maintenant ». Partagé par l'onglet Guide et
 * le Tableau de bord.
 */
export function useGuide() {
  const data = getGameData()
  const guide = useAppStore((s) => s.settings.guide)
  const calculator = useAppStore((s) => s.calculator)
  const inventory = useAppStore((s) => s.progress.inventory)
  const analyzed = useAppStore((s) => s.progress.analyzed)
  const upgrades = useAppStore((s) => s.settings.growth.upgrades)
  const analyzedBuyable = useAppStore((s) => s.settings.analyzedBuyable)
  const grids = useAppStore((s) => s.grids)
  const vines = useAppStore((s) => s.tools.vines)
  const replaceLayoutContent = useAppStore((s) => s.replaceLayoutContent)

  // Une ferme posée là où son étape suivante ne pourra pas se construire (étape 1 du Snoozling
  // Complex posée avant la v1.14) : recalée dans le plan affiché, pour que l'étape 2 ne déplace rien.
  useEffect(() => {
    grids.greenhouses.forEach((greenhouse, index) => {
      const active = activeLayoutOf(greenhouse)
      if (!active) return
      const grid = toGridInput(active, data.mechanics.greenhouse)
      const aligned = alignStages(data, grid, farmsIn(data, grid))
      if (aligned) replaceLayoutContent(index, active.id, active.name, aligned.grid.ground, aligned.grid.placements)
    })
  }, [data, grids, replaceLayoutContent])

  // Les fermes du guide ne dépendent pas du stock : recalculées seulement quand le guide ou les analyses changent.
  const scope = useMemo(() => guideScope(data, guideGoalIds(data, guide), new Set(analyzed)), [data, guide, analyzed])
  const result = useMemo(
    () =>
      computeCalculatorResult(
        data,
        { ...calculator, targets: [], goalIds: [], mode: 'optimum', ignoreInventory: false },
        inventory,
        new Set(analyzed),
        growthWithUpgrades(upgrades, data.mechanics.growthStage.formula),
        analyzedBuyable,
        { targets: scope.targets, route: scope.route },
      ),
    [data, calculator, inventory, analyzed, upgrades, analyzedBuyable, scope],
  )
  // Fermes qui se font en même temps (7 + 8 + 9…), d'après les fermes du guide seulement.
  const groups = useMemo(
    () => farmGroups(data, data.guide.sections.flatMap((section) => section.chapters).filter((chapter) => scope.chapterIds.has(chapter.id))),
    [data, scope],
  )
  const context = guideContext(data, result.plan, inventory, grids, result.stageSeconds, scope.chapterIds)
  const views = guideChapters(data, context)
  const vineState = vineProgress(data, vines)
  const now = guideNow(data, context, views, vineState.unlockedGreenhouses)
  return { guide, scope, groups, result, context, views, vineState, now }
}
