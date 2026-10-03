import { useState } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { WikiIcon } from '../../components/game/WikiIcon'
import { cropName } from '../../components/game/recipeText'
import { NumberStepper } from '../../components/NumberStepper'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import type { GuideChapter } from '../../types/game'
import { showInEncyclopedia } from '../encyclopedia/encyclopediaFocus'
import { FarmPreview } from './FarmPreview'
import { FarmTimingInfo } from './FarmTimingInfo'
import { FarmWarning } from './FarmWarning'
import { GreenhouseButtons } from './GreenhouseButtons'
import { NextStageNote } from './NextStageNote'
import { chapterView, farmOutputs, upgradeFor, type ChapterContext } from './guideModel'
import { StatusBadge } from './StatusBadge'
import { useFarmActions } from './useFarmActions'

interface ChapterCardProps {
  /** Numéro dans le guide (« 15–16 » pour une ferme en deux étapes). */
  readonly number: number | string
  readonly chapter: GuideChapter
  readonly context: ChapterContext
  /** Ouvert d'emblée (ferme en cours, proposée ou demandée depuis la Grille). */
  readonly open: boolean
  /**
   * Ferme en plusieurs étapes, réunie dans une carte (Snoozling Complex) : `chapter` est l'étape 1,
   * `stages` toutes les étapes dans l'ordre, et `title` le nom de la ferme.
   */
  readonly stages?: readonly GuideChapter[]
  readonly title?: string
  /** Seulement le contenu, sans l'en-tête repliable (une ferme d'un groupe, voir GroupCard). */
  readonly bare?: boolean
}

/**
 * Un chapitre du guide AVRG : la ferme (aperçu), ce qu'elle demande (stock vérifié), ce qu'elle
 * donne (stock modifiable) et ses conseils ; puis où la poser parmi les greenhouses débloqués. Une
 * ferme en plusieurs étapes montre chaque étape, l'une se construisant sur l'autre.
 */
export function ChapterCard({ number, chapter: first, context, open, stages = [], title, bare = false }: ChapterCardProps) {
  const data = getGameData()
  const [stage, setStage] = useState(0)
  const chapter = stages[stage] ?? first
  const [minimum, setMinimum] = useState(false)
  // Ouvert ou replié par le joueur ; ouvert d'emblée quand la page le demande (ferme proposée…).
  const [isOpen, setIsOpen] = useState(open)
  const [wanted, setWanted] = useState(open)
  if (open !== wanted) {
    setWanted(open)
    if (open) setIsOpen(true)
  }
  const setOwned = useAppStore((s) => s.setOwned)
  const actions = useFarmActions()
  const view = chapterView(data, chapter, context, minimum)
  const { layout, ingredients, outputs, placedIn, upgradeIn } = view
  const missing = ingredients.filter((item) => item.owned !== null && item.owned < item.count)
  // En-tête d'une ferme en étapes : l'état de la première, les mutations de toutes.
  const status = stages.length > 1 ? chapterView(data, first, context).status : view.status
  const icons = [...new Map((stages.length > 1 ? stages : [chapter]).flatMap((c) => farmOutputs(data, c.layout, context.plan, context.inventory)).map((o) => [o.mutation.id, o])).values()]

  const body = (
    <div className={`grid gap-5 p-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] ${bare ? '' : 'border-t border-line'}`}>
      <div className="space-y-2">
        {stages.length > 1 && (
          <>
            <div role="group" aria-label={tr('Étape de la ferme', 'Farm step')} className="inline-flex rounded-lg border border-line bg-canvas p-0.5 text-xs">
              {stages.map((s, index) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={stage === index}
                  onClick={() => setStage(index)}
                  className="rounded-md px-2.5 py-1 text-ink-muted aria-pressed:bg-panel-raised aria-pressed:font-medium aria-pressed:text-ink"
                >
                  {tr(`Étape ${index + 1}`, `Step ${index + 1}`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-muted">
              {tr('Chaque étape se construit sur la précédente, dans le même greenhouse.', 'Each step is built on the previous one, in the same greenhouse.')}
            </p>
          </>
        )}
        {chapter.minimumLayout && (
          <div role="group" aria-label={tr('Version de la ferme', 'Farm version')} className="inline-flex rounded-lg border border-line bg-canvas p-0.5 text-xs">
            {[false, true].map((isMinimum) => (
              <button
                key={String(isMinimum)}
                type="button"
                aria-pressed={minimum === isMinimum}
                onClick={() => setMinimum(isMinimum)}
                className="rounded-md px-2.5 py-1 text-ink-muted aria-pressed:bg-panel-raised aria-pressed:font-medium aria-pressed:text-ink"
              >
                {isMinimum ? 'Minimum' : tr('Optimum (conseillé)', 'Optimum (advised)')}
              </button>
            ))}
          </div>
        )}
        <FarmPreview layout={layout} />
      </div>

      <div className="min-w-0 space-y-4 text-sm">
        <FarmWarning chapters={[chapter]} />
        <section>
          <h5 className="mb-1.5 text-[11px] font-bold tracking-wider text-ink-muted uppercase">{tr('Ça donne', 'It makes')}</h5>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {outputs.map((output) => {
              const done = output.need !== null && output.need.missing === 0
              return (
                <li key={output.mutation.id} className="flex items-center justify-between gap-2 rounded-lg bg-canvas/50 px-2.5 py-1.5">
                  <button type="button" onClick={() => showInEncyclopedia(output.mutation.id)} className="min-w-0 truncate text-left hover:underline">
                    <CropLabel crop={{ kind: 'mutation', id: output.mutation.id }} />
                  </button>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {output.need && (
                      <span className={`text-xs tabular-nums ${done ? 'text-accent-strong' : 'text-ink-muted'}`}>
                        {done ? '✓ ' : ''}/ {output.need.required}
                      </span>
                    )}
                    <NumberStepper value={output.owned} onChange={(count) => setOwned(output.mutation.id, count)} name={output.mutation.name} />
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <FarmTimingInfo views={[view]} />

        <section>
          <h5 className="mb-1.5 text-[11px] font-bold tracking-wider text-ink-muted uppercase">
            {upgradeIn.length > 0 ? tr('À ajouter', 'To add') : tr('À poser', 'To place')}
          </h5>
          <ul className="flex flex-wrap gap-1.5">
            {ingredients.map((item) => {
              const enough = item.owned === null || item.owned >= item.count
              const name = item.crop.kind === 'mutation' ? item.crop.id : item.crop.name
              return (
                <li
                  key={name}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
                    item.owned === null ? 'border-line' : enough ? 'border-accent/40' : 'border-danger/50'
                  }`}
                >
                  <CropLabel crop={item.crop} />
                  <span className="tabular-nums text-ink-muted">
                    {item.owned === null ? `× ${item.count}` : `${Math.min(item.owned, item.count)} / ${item.count}`}
                  </span>
                </li>
              )
            })}
          </ul>
          {missing.length > 0 && (
            <p className="mt-1.5 text-xs text-danger">
              {tr('Il manque : ', 'Missing: ')}
              {missing.map((item) => `${item.count - (item.owned ?? 0)} ${cropName(data, item.crop)}`).join(', ')}
            </p>
          )}
        </section>

        {(chapter.text || layout.notes) && (
          <div className="space-y-1 rounded-lg border-l-2 border-accent/50 bg-canvas/40 px-3 py-2 text-ink-muted">
            {chapter.text && <p>{chapter.text}</p>}
            {layout.notes && <p className="text-xs">{layout.notes}</p>}
          </div>
        )}
        {view.nextStage && <NextStageNote stage={view.nextStage} />}

        {view.status === 'waiting' ? (
          <p className="border-t border-line pt-3 text-xs text-ink-muted">
            {tr('Pose d’abord l’étape précédente : celle-ci se construit dessus.', 'Place the previous step first: this one is built on it.')}
          </p>
        ) : upgradeIn.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs text-ink-muted">{tr('L’étape précédente pousse dans le greenhouse :', 'The previous step grows in greenhouse:')}</span>
            {upgradeIn.map((greenhouse) => {
              const result = upgradeFor(data, context, greenhouse, view)
              return (
                <button
                  key={greenhouse}
                  type="button"
                  disabled={!result}
                  title={result ? undefined : tr('Pas la place à côté des autres fermes.', 'No room next to the other farms.')}
                  onClick={() => result && actions.upgrade(greenhouse, result)}
                  className="h-8 rounded-lg border border-accent/50 bg-accent/10 px-3 text-xs font-medium text-accent-strong transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tr(`Passer à cette étape (${greenhouse + 1})`, `Move on to this step (#${greenhouse + 1})`)}
                </button>
              )
            })}
          </div>
        ) : (
          <GreenhouseButtons presets={[layout]} context={context} placedIn={placedIn} chapterId={chapter.id} />
        )}
      </div>
    </div>
  )
  if (bare) return body

  return (
    <details
      id={`guide-${first.id}`}
      data-stages={stages.map((s) => s.id).join(' ') || undefined}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group scroll-mt-28 rounded-xl border border-line bg-panel"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 hover:bg-panel-raised [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block text-ink-muted transition-transform group-open:rotate-90">
          ▸
        </span>
        <span className="text-xs font-bold text-ink-muted tabular-nums">{number}.</span>
        <h4 className="font-semibold">{title ?? chapter.title}</h4>
        {stages.length > 1 && (
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
            {tr(`${stages.length} étapes`, `${stages.length} steps`)}
          </span>
        )}
        <span aria-hidden="true" className="flex -space-x-1">
          {icons.slice(0, 6).map((output) => (
            <WikiIcon key={output.mutation.id} name={output.mutation.name} size={20} />
          ))}
        </span>
        <span className="ml-auto">
          <StatusBadge status={status} placedIn={placedIn} />
        </span>
      </summary>

      {isOpen && body}
    </details>
  )
}
