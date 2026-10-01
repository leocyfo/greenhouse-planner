import { DataPanel } from './DataPanel'
import { tr } from '../../i18n/locale'
import { GreenhouseUpgrades } from './GreenhouseUpgrades'
import { GrowthCalculator } from './GrowthCalculator'
import { LonelilyEstimator } from './LonelilyEstimator'
import { MechanicsCheatSheet } from './MechanicsCheatSheet'
import { VinesTracker } from './VinesTracker'

/** Onglet Outils : upgrades, croissance, Ethereal Vines, Lonelily, aide-mémoire et sauvegarde. */
export function ToolsTab() {
  return (
    <div className="space-y-6">
      <h2 className="sr-only">{tr('Outils', 'Tools')}</h2>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <GreenhouseUpgrades />
          <GrowthCalculator />
        </div>
        <div className="space-y-4">
          <VinesTracker />
          <LonelilyEstimator />
        </div>
      </div>
      <MechanicsCheatSheet />
      <DataPanel />
    </div>
  )
}
