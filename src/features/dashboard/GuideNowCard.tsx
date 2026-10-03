import { tabHref } from '../../app/navigation'
import { cropName } from '../../components/game/recipeText'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { formatDuration } from '../../logic/format'
import type { ChapterView } from '../guide/guideModel'
import { guideName } from '../guide/guideScope'
import { StockRefreshButton } from '../guide/StockRefreshButton'
import { useGuide } from '../guide/useGuide'

const LINK = 'text-sm text-accent-strong underline-offset-2 hover:underline'

const titles = (views: readonly ChapterView[]) => views.map((view) => view.chapter.title).join(' + ')

/** Ce que les fermes en cours prennent encore au moins (la plus longue). */
function longest(views: readonly ChapterView[]): string {
  const seconds = Math.max(0, ...views.map((view) => view.timing.seconds))
  return seconds > 0 ? tr(` · encore ${formatDuration(seconds)} au moins`, ` · ${formatDuration(seconds)} left at least`) : ''
}

/** Sur le Tableau de bord : le « À faire maintenant » du guide affiché, en court. */
export function GuideNowCard() {
  const data = getGameData()
  const { guide, scope, result, views, now } = useGuide()
  const name = (id: string) => data.mutationsById.get(id)?.name ?? id
  const manualLeft = scope.manual.filter((id) => (result.plan.needs.get(id)?.missing ?? 0) > 0)

  const done = views.filter((view) => view.status === 'done').length
  const lines = [
    ...now.toPlace.map((group) => ({
      key: `place-${group.greenhouse}`,
      tone: 'text-accent-strong',
      text: tr(`Pose dans le Greenhouse ${group.greenhouse + 1} : ${titles(group.chapters)}`, `Place in Greenhouse ${group.greenhouse + 1}: ${titles(group.chapters)}`),
    })),
    ...now.upgrades.map((upgrade) => ({
      key: `upgrade-${upgrade.greenhouse}`,
      tone: 'text-accent-strong',
      text: tr(`Greenhouse ${upgrade.greenhouse + 1} : passe à ${upgrade.view.chapter.title}`, `Greenhouse ${upgrade.greenhouse + 1}: move on to ${upgrade.view.chapter.title}`),
    })),
    ...now.running.map((group) => ({
      key: `running-${group.greenhouse}`,
      tone: 'text-sky-300',
      text:
        tr(`En cours dans le Greenhouse ${group.greenhouse + 1} : ${titles(group.chapters)}`, `Growing in Greenhouse ${group.greenhouse + 1}: ${titles(group.chapters)}`) +
        longest(group.chapters),
    })),
  ]
  const blocked = lines.length === 0 ? now.next[0] : undefined
  const missing = blocked?.ingredients.filter((item) => item.owned !== null && item.owned < item.count) ?? []

  return (
    <Panel
      title={tr(`Guide : ${guideName(data, guide)}`, `Guide: ${guideName(data, guide)}`)}
      actions={<span className="text-xs text-ink-muted">{tr(`Fermes finies : ${done} / ${views.length}`, `Farms done: ${done} / ${views.length}`)}</span>}
      className="border-accent/40"
    >
      <ul className="space-y-1.5 text-sm">
        {lines.map((line) => (
          <li key={line.key} className={line.tone}>
            {line.text}
          </li>
        ))}
        {blocked && (
          <li>
            {tr('Prochaine ferme : ', 'Next farm: ')}
            <strong>{blocked.chapter.title}</strong>
            {missing.length > 0 && (
              <span className="text-ink-muted">
                {tr(' — il te manque ', ' — you are missing ')}
                {missing.map((item) => `${item.count - (item.owned ?? 0)} ${cropName(data, item.crop)}`).join(', ')}
              </span>
            )}
          </li>
        )}
        {lines.length === 0 && !blocked && manualLeft.length > 0 && (
          <li>{tr(`À la main : ${manualLeft.map(name).join(', ')}`, `By hand: ${manualLeft.map(name).join(', ')}`)}</li>
        )}
        {lines.length === 0 && !blocked && manualLeft.length === 0 && (
          <li className="text-accent-strong">{tr('Toutes les fermes de ce guide sont finies !', 'Every farm of this guide is done!')}</li>
        )}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href={tabHref('guide')} className={LINK}>
          {tr('Ouvrir le guide', 'Open the guide')} <span aria-hidden="true">→</span>
        </a>
        <StockRefreshButton className={LINK} />
      </div>
    </Panel>
  )
}
