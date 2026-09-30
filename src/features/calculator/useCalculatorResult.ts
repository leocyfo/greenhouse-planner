import { useMemo } from 'react'
import { getGameData } from '../../data'
import { growthWithUpgrades } from '../../logic/growth'
import { useAppStore } from '../../store/appStore'
import { computeCalculatorResult, type CalculatorResult } from './calculatorResult'

/** Résultat du calculateur, recalculé quand son état, l'inventaire ou les réglages changent. */
export function useCalculatorResult(): CalculatorResult {
  const calculator = useAppStore((s) => s.calculator)
  const inventory = useAppStore((s) => s.progress.inventory)
  const analyzed = useAppStore((s) => s.progress.analyzed)
  const upgrades = useAppStore((s) => s.settings.growth.upgrades)
  const analyzedBuyable = useAppStore((s) => s.settings.analyzedBuyable)
  return useMemo(() => {
    const data = getGameData()
    const growth = growthWithUpgrades(upgrades, data.mechanics.growthStage.formula)
    return computeCalculatorResult(data, calculator, inventory, new Set(analyzed), growth, analyzedBuyable)
  }, [calculator, inventory, analyzed, upgrades, analyzedBuyable])
}
