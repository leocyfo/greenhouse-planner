import { CropLabel } from '../../components/game/CropLabel'
import { NumberStepper } from '../../components/NumberStepper'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import type { Plan } from '../../logic/recipes'
import { useAppStore } from '../../store/appStore'
import { showInEncyclopedia } from '../encyclopedia/encyclopediaFocus'
import { effectProviders } from './guideScope'

const LINK = 'text-sm text-accent-strong underline-offset-2 hover:underline'

/**
 * Ce qu'aucune ferme AVRG ne fait (Shellfruit, Godseed, Jerryflower) : à faire à la main, avec la
 * condition des données ; pour le Godseed, chaque effet demandé autour et qui le donne.
 */
export function ManualSteps({ ids, plan }: { readonly ids: readonly string[]; readonly plan: Plan }) {
  const data = getGameData()
  const inventory = useAppStore((s) => s.progress.inventory)
  const setOwned = useAppStore((s) => s.setOwned)
  const left = ids.filter((id) => (plan.needs.get(id)?.missing ?? 0) > 0)
  if (left.length === 0) return null

  return (
    <section aria-labelledby="guide-manual" className="space-y-2">
      <h3 id="guide-manual" className="text-lg font-semibold">
        {tr('À la main', 'By hand')}
      </h3>
      <p className="text-sm text-ink-muted">{tr('Aucune ferme AVRG ne les fait : voici comment les obtenir.', 'No AVRG farm makes them: here is how to get them.')}</p>
      {left.map((id) => {
        const mutation = data.mutationsById.get(id)
        const need = plan.needs.get(id)
        if (!mutation || !need) return null
        const providers = mutation.spawnRule === 'requiredEffectsAround' ? effectProviders(data, mutation) : []
        return (
          <article key={id} className="space-y-3 rounded-xl border border-line bg-panel p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-lg font-semibold">
                <CropLabel crop={{ kind: 'mutation', id }} />
              </span>
              <span className="text-sm tabular-nums text-ink-muted">
                {Math.min(need.owned, need.required)} / {need.required}
              </span>
              <NumberStepper value={inventory[id] ?? 0} onChange={(count) => setOwned(id, count)} name={mutation.name} />
              <button type="button" onClick={() => showInEncyclopedia(id)} className={`${LINK} ml-auto`}>
                {tr('Voir la fiche', 'See the sheet')}
              </button>
            </div>
            {mutation.specialCondition && <p className="text-sm">{mutation.specialCondition}</p>}
            {providers.length > 0 && (
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {providers.map((provider) => {
                  const owned = provider.mutations.filter((m) => (inventory[m.id] ?? 0) > 0)
                  const ready = provider.baseCrops.length > 0 || owned.length > 0
                  return (
                    <li key={provider.effect} className={`rounded-lg border px-2.5 py-1.5 ${ready ? 'border-accent/40' : 'border-line'}`}>
                      <p className="font-medium">
                        <span aria-hidden="true" className={ready ? 'text-accent-strong' : 'text-ink-muted'}>
                          {ready ? '✓ ' : '○ '}
                        </span>
                        {provider.effect}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {[...provider.baseCrops, ...provider.mutations.slice(0, 4).map((m) => m.name)].join(' · ')}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </article>
        )
      })}
    </section>
  )
}
