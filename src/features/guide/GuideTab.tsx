import { useEffect, useState, type ReactNode } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { cropName } from '../../components/game/recipeText'
import { WikiIcon } from '../../components/game/WikiIcon'
import { formatNumber } from '../../components/labels'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { formatDuration } from '../../logic/format'
import { planProgress } from '../../logic/recipes'
import { vineProgress } from '../../logic/tools'
import { useAppStore } from '../../store/appStore'
import { useCalculatorResult } from '../calculator/useCalculatorResult'
import { showGoalInEncyclopedia } from '../encyclopedia/encyclopediaFocus'
import { VinesTracker } from '../tools/VinesTracker'
import { ChapterCard } from './ChapterCard'
import { clearGuideFocus, useGuideFocus } from './guideFocus'
import { guideChapters, guideContext, guideNow } from './guideModel'
import { PlaceCard, RunningCard } from './NowCard'

/** Conseils du guide AVRG utiles avant de commencer (textes des données). */
const PREPARE_TIPS = ['getting-started', 'space', 'optimum', 'growth-tick', 'no-replant', 'rosewater', 'dead-crops', 'diagnostic-tool'] as const

const CARD = 'rounded-xl border border-line bg-panel p-4'
const LINK = 'text-sm text-accent-strong underline-offset-2 hover:underline'

/** Partie repliable du bas de la page. */
function Fold({ title, open = false, children }: { readonly title: string; readonly open?: boolean; readonly children: ReactNode }) {
  return (
    <details open={open} className="group">
      <summary className="cursor-pointer list-none text-base font-semibold text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="mr-1.5 inline-block transition-transform group-open:rotate-90">
          ▸
        </span>
        {title}
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  )
}

/**
 * Onglet Guide : le Rose Dragon Pet avec les fermes du guide AVRG, une chose à la fois. Tout part du
 * stock et des greenhouses : « À faire maintenant » montre les fermes prêtes à poser (réunies dans un
 * greenhouse quand elles tiennent ensemble, comme Gloomgourd + Dustgrain) et celles qui poussent ;
 * « Ensuite », les fermes suivantes dans l'ordre du guide. Mettre le stock à jour fait avancer le guide.
 */
export function GuideTab() {
  const data = getGameData()
  const goal = data.goals.find((g) => g.id === data.guide.goalId)
  const { plan, estimate } = useCalculatorResult({ kind: 'goal', goalId: data.guide.goalId })
  const inventory = useAppStore((s) => s.progress.inventory)
  const grids = useAppStore((s) => s.grids)
  const vines = useAppStore((s) => s.tools.vines)
  const following = useAppStore((s) => s.progress.activeGoals.includes(data.guide.goalId))
  const setGoalActive = useAppStore((s) => s.setGoalActive)

  // Ferme demandée depuis la Grille : ouverte dans « Ensuite », puis la page défile jusqu'à elle.
  const focusRequest = useGuideFocus((s) => s.chapterId)
  const [focused, setFocused] = useState(focusRequest)
  if (focusRequest && focusRequest !== focused) setFocused(focusRequest)
  useEffect(() => {
    if (!focusRequest) return
    document.getElementById(`guide-${focusRequest}`)?.scrollIntoView({ block: 'start' })
    clearGuideFocus()
  }, [focusRequest])

  if (!goal) return null
  const context = guideContext(data, plan, inventory, grids)
  const views = guideChapters(data, context)
  const vineState = vineProgress(data, vines)
  const unlocked = vineState.unlockedGreenhouses
  const now = guideNow(data, context, views, unlocked)
  const progress = planProgress(plan)
  const percent = progress.total > 0 ? Math.floor((progress.done / progress.total) * 100) : 100
  const farmsDone = views.filter((view) => view.status === 'done').length
  const tips = PREPARE_TIPS.map((id) => data.mechanics.tips.find((tip) => tip.id === id)).filter((tip) => tip !== undefined)
  const numbers = new Map(views.map((view, index) => [view.chapter.id, index + 1]))
  const nothingNow = now.toPlace.length === 0 && now.running.length === 0
  const blocked = nothingNow ? now.next[0] : undefined
  const missing = blocked?.ingredients.filter((item) => item.owned !== null && item.owned < item.count) ?? []

  return (
    <div className="space-y-8">
      <header className={`${CARD} flex flex-wrap items-center gap-4`}>
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-canvas">
          <WikiIcon name={goal.name} size={46} />
        </span>
        <div className="min-w-[14rem] flex-1">
          <h2 className="text-xl font-bold">{tr(`Guide : ${goal.name}`, `Guide: ${goal.name}`)}</h2>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
            <span>
              <strong className="text-ink tabular-nums">{tr(`${percent} %`, `${percent}%`)}</strong> ({progress.done} / {progress.total} mutations)
            </span>
            <span>{tr(`Fermes finies : ${farmsDone} / ${views.length}`, `Farms done: ${farmsDone} / ${views.length}`)}</span>
            <span>
              {tr('Temps restant : ', 'Time left: ')}
              <strong className="text-ink">{formatDuration(estimate.criticalPathSeconds)}</strong>
            </span>
          </p>
        </div>
        {!following && (
          <button
            type="button"
            onClick={() => setGoalActive(data.guide.goalId, true)}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong"
          >
            {tr('Suivre cet objectif', 'Follow this goal')}
          </button>
        )}
      </header>

      <section aria-labelledby="guide-now" className="space-y-3">
        <h3 id="guide-now" className="text-lg font-semibold">
          {tr('À faire maintenant', 'To do now')}
        </h3>
        {now.toPlace.map((group) => (
          <PlaceCard
            key={`place-${group.greenhouse}`}
            greenhouse={group.greenhouse}
            views={group.chapters}
            preview={[group.result.grid, group.result.farms, '']}
            mode={group.newPlan ? 'new' : 'add'}
            alongside={!group.newPlan && group.result.farms.length > group.chapters.length}
          />
        ))}
        {now.running.map((group) => (
          <RunningCard key={`running-${group.greenhouse}`} greenhouse={group.greenhouse} views={group.chapters} />
        ))}
        {blocked && (
          <div className={`${CARD} space-y-2 text-sm`}>
            <p>
              {tr('Prochaine ferme : ', 'Next farm: ')}
              <strong>{blocked.chapter.title}</strong>
            </p>
            {missing.length > 0 ? (
              <p className="text-ink-muted">
                {tr('Il te manque : ', 'You are missing: ')}
                {missing.map((item) => `${item.count - (item.owned ?? 0)} ${cropName(data, item.crop)}`).join(', ')}
                {tr('. Mets ton stock à jour quand tu les as.', '. Update your stock once you have them.')}
              </p>
            ) : (
              <p className="text-ink-muted">
                {tr('Pas de place dans tes greenhouses : attends qu’une ferme finisse, ou débloque un greenhouse.', 'No room in your greenhouses: wait for a farm to finish, or unlock a greenhouse.')}
              </p>
            )}
          </div>
        )}
        {!blocked && nothingNow && (
          <p className={`${CARD} text-sm`}>{tr('Toutes les fermes sont finies : direction Ludleth !', 'Every farm is done: off to Ludleth!')}</p>
        )}
      </section>

      {now.next.length > 0 && (
        <section aria-labelledby="guide-next" className="space-y-2">
          <h3 id="guide-next" className="text-lg font-semibold">
            {tr('Ensuite', 'Next')}
          </h3>
          {now.next.map((view) => (
            <ChapterCard key={view.chapter.id} number={numbers.get(view.chapter.id) ?? 0} chapter={view.chapter} context={context} open={focused === view.chapter.id} />
          ))}
        </section>
      )}

      <div className="space-y-4 border-t border-line pt-6">
        {unlocked.length < grids.greenhouses.length && (
          <Fold title={tr(`Débloquer des greenhouses (${unlocked.length} / ${grids.greenhouses.length})`, `Unlock greenhouses (${unlocked.length} / ${grids.greenhouses.length})`)}>
            <VinesTracker />
          </Fold>
        )}
        <Fold title={tr('Conseils d’AVRG', 'AVRG’s tips')}>
          <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {tips.map((tip) => (
              <div key={tip.id} className="rounded-lg border border-line bg-canvas/40 p-3">
                <dt className="text-sm font-semibold">{tip.title}</dt>
                <dd className="mt-1 text-sm text-ink-muted">{tip.text}</dd>
              </div>
            ))}
          </dl>
        </Fold>
        <Fold title={tr(`L’œuf : ${goal.name}`, `The egg: ${goal.name}`)}>
          <div className={CARD}>
            {goal.npc && <p className="mb-2 text-sm text-ink-muted">{tr(`Chez ${goal.npc}, avec :`, `At ${goal.npc}, with:`)}</p>}
            <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {goal.mutations.map((requirement) => {
                const have = (inventory[requirement.mutationId] ?? 0) >= (requirement.quantity ?? 1)
                return (
                  <li key={requirement.mutationId} className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true" className={have ? 'text-accent-strong' : 'text-ink-muted'}>
                      {have ? '✓' : '○'}
                    </span>
                    <span className="sr-only">{have ? tr('En stock : ', 'In stock: ') : tr('Pas encore : ', 'Not yet: ')}</span>
                    <CropLabel crop={{ kind: 'mutation', id: requirement.mutationId }} />
                    <span className="text-ink-muted">× {requirement.quantity ?? '?'}</span>
                  </li>
                )
              })}
              {Object.entries(goal.other).map(([resource, amount]) => (
                <li key={resource} className="flex items-center gap-2 text-sm">
                  <span aria-hidden="true" className="text-ink-muted">
                    ○
                  </span>
                  {formatNumber(amount)} {resource}
                </li>
              ))}
            </ul>
          </div>
        </Fold>
        <button type="button" onClick={() => showGoalInEncyclopedia(data.guide.goalId)} className={LINK}>
          {tr("Tout l'arbre dans l'encyclopédie", 'Whole tree in the encyclopedia')}
        </button>
      </div>
    </div>
  )
}
