import { useEffect, useState, type ReactNode } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { cropName } from '../../components/game/recipeText'
import { WikiIcon } from '../../components/game/WikiIcon'
import { formatNumber } from '../../components/labels'
import { getGameData } from '../../data'
import { wikiImage } from '../../data/wikiImages'
import { tr } from '../../i18n/locale'
import { formatDuration } from '../../logic/format'
import { planProgress } from '../../logic/recipes'
import { useAppStore } from '../../store/appStore'
import { showGoalInEncyclopedia } from '../encyclopedia/encyclopediaFocus'
import { VinesTracker } from '../tools/VinesTracker'
import { ChapterCard } from './ChapterCard'
import { clearGuideFocus, useGuideFocus } from './guideFocus'
import { planPreview } from './farmPacking'
import type { ChapterView } from './guideModel'
import { ALL_GOALS, guideName } from './guideScope'
import { GroupCard } from './GroupCard'
import { GuideSwitcher } from './GuideSwitcher'
import { ManualSteps } from './ManualSteps'
import { PlaceCard, RunningCard, UpgradeCard } from './NowCard'
import { StockRefreshButton } from './StockRefreshButton'
import { useGuide } from './useGuide'

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
 * Onglet Guide : un objectif (Rose Dragon Pet par défaut, ou tous réunis) avec les fermes du guide
 * AVRG qui lui servent, une chose à la fois. Tout part du
 * stock et des greenhouses : « À faire maintenant » montre les fermes prêtes à poser (réunies dans un
 * greenhouse quand elles tiennent ensemble, comme Gloomgourd + Dustgrain) et celles qui poussent ;
 * « Ensuite », les fermes suivantes dans l'ordre du guide. Mettre le stock à jour fait avancer le guide.
 */
export function GuideTab() {
  const data = getGameData()
  const { guide, scope, groups, result, context, views, vineState, now } = useGuide()
  const { plan, estimate } = result
  const goals = data.goals.filter((g) => scope.goalIds.includes(g.id))
  const [goal] = goals
  const inventory = useAppStore((s) => s.progress.inventory)
  const grids = useAppStore((s) => s.grids)
  const activeGoals = useAppStore((s) => s.progress.activeGoals)
  const setGoalActive = useAppStore((s) => s.setGoalActive)
  const notFollowed = goals.filter((g) => !activeGoals.includes(g.id))

  // Ferme demandée depuis la Grille : ouverte dans « Ensuite », puis la page défile jusqu'à elle.
  const focusRequest = useGuideFocus((s) => s.chapterId)
  const [focused, setFocused] = useState(focusRequest)
  if (focusRequest && focusRequest !== focused) setFocused(focusRequest)
  useEffect(() => {
    if (!focusRequest) return
    // Une étape suivante est dans la carte de sa ferme (Snoozling Complex).
    const card = document.getElementById(`guide-${focusRequest}`) ?? document.querySelector(`[data-stages~="${focusRequest}"]`)
    card?.scrollIntoView({ block: 'start' })
    clearGuideFocus()
  }, [focusRequest])

  if (!goal) return null
  const unlocked = vineState.unlockedGreenhouses
  const progress = planProgress(plan)
  const percent = progress.total > 0 ? Math.floor((progress.done / progress.total) * 100) : 100
  const done = views.filter((view) => view.status === 'done')
  const farmsDone = done.length
  const tips = PREPARE_TIPS.map((id) => data.mechanics.tips.find((tip) => tip.id === id)).filter((tip) => tip !== undefined)
  const numbers = new Map(views.map((view, index) => [view.chapter.id, index + 1]))
  const nothingNow = now.toPlace.length === 0 && now.upgrades.length === 0 && now.running.length === 0
  const blocked = nothingNow ? now.next[0] : undefined
  const missing = blocked?.ingredients.filter((item) => item.owned !== null && item.owned < item.count) ?? []
  const manualLeft = scope.manual.filter((id) => (plan.needs.get(id)?.missing ?? 0) > 0)
  // Icône : celle de l'objectif, sinon de la mutation qu'il demande (Godseed pour Sun's Grasp), sinon aucune.
  const icon = [goal.name, ...goal.mutations.map((r) => data.mutationsById.get(r.mutationId)?.name ?? '')].find((name) => name && wikiImage(name))
  // « Ensuite » : une ferme en plusieurs étapes tient dans une seule carte (l'étape 1, puis les suivantes).
  const nextIds = new Set(now.next.map((view) => view.chapter.id))
  const byId = new Map(views.map((view) => [view.chapter.id, view]))
  const stagesOf = (view: ChapterView) => {
    const stages = [view.chapter]
    for (let stage = view.nextStage; stage && nextIds.has(stage.id); stage = byId.get(stage.id)?.nextStage ?? null) stages.push(stage)
    return stages
  }
  // Ferme en cours : l'aperçu du plan affiché de son greenhouse.
  const runningPreview = (greenhouse: number): Parameters<typeof planPreview> | null => {
    const farms = context.greenhouses[greenhouse]
    return farms?.grid ? [farms.grid, farms.active, ''] : null
  }
  const farmTitle = (id: string) => data.guide.sections.find((section) => section.chapters.some((chapter) => chapter.id === id))?.title

  return (
    <div className="space-y-8">
      <header className={`${CARD} flex flex-wrap items-center gap-4`}>
        {icon && (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-canvas">
            <WikiIcon name={icon} size={46} />
          </span>
        )}
        <div className="min-w-[14rem] flex-1">
          <h2 className="text-xl font-bold">{tr(`Guide : ${guideName(data, guide)}`, `Guide: ${guideName(data, guide)}`)}</h2>
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
        <StockRefreshButton className="rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:bg-panel-raised" />
        {notFollowed.length > 0 && (
          <button
            type="button"
            onClick={() => notFollowed.forEach((g) => setGoalActive(g.id, true))}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong"
          >
            {goals.length > 1 ? tr('Suivre ces objectifs', 'Follow these goals') : tr('Suivre cet objectif', 'Follow this goal')}
          </button>
        )}
        <div className="basis-full border-t border-line pt-3">
          <GuideSwitcher />
        </div>
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
        {now.upgrades.map((upgrade) => (
          <UpgradeCard key={`upgrade-${upgrade.greenhouse}-${upgrade.view.chapter.id}`} upgrade={upgrade} />
        ))}
        {now.running.map((group) => (
          <RunningCard
            key={`running-${group.greenhouse}`}
            greenhouse={group.greenhouse}
            views={group.chapters}
            preview={runningPreview(group.greenhouse)}
            nextStages={group.nextStages}
          />
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
          <p className={`${CARD} text-sm`}>
            {manualLeft.length > 0
              ? tr('Plus de ferme à faire : il reste les étapes à la main, plus bas.', 'No farm left: only the steps by hand are left, below.')
              : goals.length === 1 && goal.npc
                ? tr(`Toutes les fermes sont finies : direction ${goal.npc} !`, `Every farm is done: off to ${goal.npc}!`)
                : tr('Toutes les fermes de ce guide sont finies !', 'Every farm of this guide is done!')}
          </p>
        )}
      </section>

      {now.next.length > 0 && (
        <section aria-labelledby="guide-next" className="space-y-2">
          <h3 id="guide-next" className="text-lg font-semibold">
            {tr('Ensuite', 'Next')}
          </h3>
          {groups.map((group) => {
            // Fermes qui se font en même temps : une carte pour celles qui restent à faire.
            const members = group.filter((chapter) => nextIds.has(chapter.id))
            if (members.length > 1) {
              const nums = members.map((chapter) => numbers.get(chapter.id) ?? 0)
              const consecutive = nums.every((n, index) => index === 0 || n === (nums[index - 1] ?? 0) + 1)
              return (
                <GroupCard
                  key={members.map((chapter) => chapter.id).join('+')}
                  number={consecutive ? `${nums[0]}–${nums[nums.length - 1]}` : nums.join(', ')}
                  chapters={members}
                  context={context}
                  open={members.some((chapter) => chapter.id === focused)}
                />
              )
            }
            const view = members[0] ? byId.get(members[0].id) : undefined
            if (!view) return null
            // Étape suivante d'une ferme déjà montrée avec son étape 1.
            if (view.chapter.upgrades && nextIds.has(view.chapter.upgrades.id)) return null
            const stages = stagesOf(view)
            const last = stages[stages.length - 1]
            const number = numbers.get(view.chapter.id) ?? 0
            return stages.length > 1 && last ? (
              <ChapterCard
                key={view.chapter.id}
                number={`${number}–${numbers.get(last.id) ?? 0}`}
                chapter={view.chapter}
                stages={stages}
                title={farmTitle(view.chapter.id)}
                context={context}
                open={stages.some((stage) => stage.id === focused)}
              />
            ) : (
              <ChapterCard key={view.chapter.id} number={number} chapter={view.chapter} context={context} open={focused === view.chapter.id} />
            )
          })}
        </section>
      )}

      <ManualSteps ids={scope.manual} plan={plan} />

      <div className="space-y-4 border-t border-line pt-6">
        {done.length > 0 && (
          <Fold title={tr(`Fermes finies (${done.length})`, `Farms done (${done.length})`)}>
            <p className="text-sm text-ink-muted">
              {tr(
                'Pour revoir une ferme, ou la remettre si le stock était faux : baisse le stock de ce qu’elle donne.',
                'To look at a farm again, or bring it back if the stock was wrong: lower the stock of what it makes.',
              )}
            </p>
            <div className="space-y-2">
              {done.map((view) => (
                <ChapterCard key={view.chapter.id} number={numbers.get(view.chapter.id) ?? 0} chapter={view.chapter} context={context} open={false} />
              ))}
            </div>
          </Fold>
        )}
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
        {goals
          .filter((g) => g.mutations.length > 0 || Object.keys(g.other).length > 0)
          .map((item) => (
            <Fold key={item.id} title={item.type === 'pet' ? tr(`L’œuf : ${item.name}`, `The egg: ${item.name}`) : tr(`Objectif : ${item.name}`, `Goal: ${item.name}`)}>
              <div className={CARD}>
                {item.npc && <p className="mb-2 text-sm text-ink-muted">{tr(`Chez ${item.npc}, avec :`, `At ${item.npc}, with:`)}</p>}
                <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {item.mutations.map((requirement) => {
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
                  {Object.entries(item.other).map(([resource, amount]) => (
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
          ))}
        {guide !== ALL_GOALS && (
          <button type="button" onClick={() => showGoalInEncyclopedia(goal.id)} className={LINK}>
            {tr("Tout l'arbre dans l'encyclopédie", 'Whole tree in the encyclopedia')}
          </button>
        )}
      </div>
    </div>
  )
}
