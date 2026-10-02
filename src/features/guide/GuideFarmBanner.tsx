import { WikiIcon } from '../../components/game/WikiIcon'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import { activeLayoutOf, toGridInput } from '../../store/grids'
import { useGoalPlan } from '../../store/useGoalPlan'
import { farmsIn } from './farmPacking'
import { showInGuide } from './guideFocus'
import { farmOutputs } from './guideModel'

/**
 * Dans la Grille, quand le plan affiché contient des fermes du guide : chacune, ce qu'elle donne
 * (stock / besoin de la route) et un lien vers son chapitre du Guide.
 */
export function GuideFarmBanner({ greenhouse }: { readonly greenhouse: number }) {
  const data = getGameData()
  const state = useAppStore((s) => s.grids.greenhouses[greenhouse])
  const inventory = useAppStore((s) => s.progress.inventory)
  const { plan } = useGoalPlan()
  const active = state ? activeLayoutOf(state) : undefined
  const farms = active ? farmsIn(data, toGridInput(active, data.mechanics.greenhouse)) : []
  if (farms.length === 0) return null

  return (
    <div className="space-y-1 rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sm">
      {farms.map((farm) => (
        <div key={`${farm.preset.id}@${farm.dx},${farm.dy}`} className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold">
            {tr('Ferme du guide : ', 'Guide farm: ')}
            {farm.chapter.title}
          </span>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
            {farmOutputs(data, farm.preset, plan, inventory).map((output) => (
              <li key={output.mutation.id} className="flex items-center gap-1">
                <WikiIcon name={output.mutation.name} size={16} />
                <span className={output.need?.missing === 0 ? 'text-accent-strong' : ''}>
                  {output.owned}
                  {output.need ? `/${output.need.required}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => showInGuide(farm.chapter.id)} className="ml-auto text-sm text-accent-strong hover:underline">
            {tr('Voir dans le guide', 'See in the guide')}
          </button>
        </div>
      ))}
    </div>
  )
}
