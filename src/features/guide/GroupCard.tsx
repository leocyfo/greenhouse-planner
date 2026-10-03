import { useState } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { WikiIcon } from '../../components/game/WikiIcon'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import type { CropRef, GuideChapter } from '../../types/game'
import { ChapterCard } from './ChapterCard'
import { emptyGrid, farmsName, largestFirst, ownPlotOf, packFarms, planPreview } from './farmPacking'
import { FarmPreview } from './FarmPreview'
import { FarmTimingInfo } from './FarmTimingInfo'
import { FarmWarning } from './FarmWarning'
import { GreenhouseButtons } from './GreenhouseButtons'
import { chapterView, type ChapterContext, type FarmIngredient } from './guideModel'
import { StatusBadge } from './StatusBadge'

const LABEL = 'mb-1.5 text-[11px] font-bold tracking-wider text-ink-muted uppercase'
const keyOf = (crop: CropRef) => (crop.kind === 'mutation' ? `m:${crop.id}` : `b:${crop.name}`)

interface GroupCardProps {
  /** Numéros dans le guide (« 7–9 »). */
  readonly number: string
  readonly chapters: readonly GuideChapter[]
  readonly context: ChapterContext
  readonly open: boolean
}

/**
 * Des fermes qui se font en même temps (voir farmGroups) : une seule carte, avec le plan qui les
 * réunit, ce qu'elles demandent et donnent ensemble, et un onglet par ferme pour ses détails.
 */
export function GroupCard({ number, chapters, context, open }: GroupCardProps) {
  const data = getGameData()
  const [tab, setTab] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(open)
  const [wanted, setWanted] = useState(open)
  if (open !== wanted) {
    setWanted(open)
    if (open) setIsOpen(true)
  }
  const views = chapters.map((chapter) => chapterView(data, chapter, context))
  const presets = views.map((view) => view.layout)
  const shown = chapters.find((chapter) => chapter.id === tab)
  const status = views.every((view) => view.status === 'ready') ? 'ready' : views.some((view) => view.status === 'missing') ? 'missing' : views[0]?.status ?? 'missing'
  const outputs = [...new Map(views.flatMap((view) => view.outputs).map((output) => [output.mutation.id, output])).values()]

  // Ce que demandent les fermes ensemble, mutations d'abord.
  const totals = new Map<string, FarmIngredient>()
  for (const item of views.flatMap((view) => view.ingredients)) {
    const previous = totals.get(keyOf(item.crop))
    totals.set(keyOf(item.crop), { ...item, count: (previous?.count ?? 0) + item.count })
  }
  const ingredients = [...totals.values()].sort((a, b) => Number(a.crop.kind === 'base') - Number(b.crop.kind === 'base'))

  const tabs: { readonly id: string | null; readonly label: string }[] = [
    { id: null, label: tr('Ensemble', 'Together') },
    ...chapters.map((chapter) => ({ id: chapter.id, label: chapter.title })),
  ]

  return (
    <details
      id={`guide-${chapters[0]?.id ?? ''}`}
      data-stages={chapters.map((chapter) => chapter.id).join(' ')}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group scroll-mt-28 rounded-xl border border-line bg-panel"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 hover:bg-panel-raised [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block text-ink-muted transition-transform group-open:rotate-90">
          ▸
        </span>
        <span className="text-xs font-bold text-ink-muted tabular-nums">{number}.</span>
        <h4 className="font-semibold">{chapters.map((chapter) => chapter.title).join(' + ')}</h4>
        <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[11px] text-accent-strong">
          {tr(`${chapters.length} fermes en même temps`, `${chapters.length} farms at once`)}
        </span>
        <span aria-hidden="true" className="flex -space-x-1">
          {outputs.slice(0, 8).map((output) => (
            <WikiIcon key={output.mutation.id} name={output.mutation.name} size={20} />
          ))}
        </span>
        <span className="ml-auto">
          <StatusBadge status={status} />
        </span>
      </summary>

      {isOpen && (
        <div className="space-y-3 border-t border-line p-4">
          <div role="tablist" aria-label={tr('Fermes du groupe', 'Farms of the group')} className="flex flex-wrap gap-1.5">
            {tabs.map((item) => (
              <button
                key={item.id ?? 'ensemble'}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className="rounded-full border border-line px-3 py-1 text-sm text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink aria-selected:border-accent/60 aria-selected:bg-accent/15 aria-selected:font-medium aria-selected:text-accent-strong"
              >
                {item.label}
              </button>
            ))}
          </div>
          {shown ? (
            <div className="rounded-lg border border-line">
              <ChapterCard number={number} chapter={shown} context={context} open bare />
            </div>
          ) : (
            <Together presets={presets} views={views} ingredients={ingredients} outputs={outputs} context={context} />
          )}
        </div>
      )}
    </details>
  )
}

interface TogetherProps {
  readonly presets: ReturnType<typeof chapterView>['layout'][]
  readonly views: readonly ReturnType<typeof chapterView>[]
  readonly ingredients: readonly FarmIngredient[]
  readonly outputs: ReturnType<typeof chapterView>['outputs']
  readonly context: ChapterContext
}

/** Onglet « Ensemble » : le plan qui réunit les fermes, ce qu'il faut, ce qu'elles donnent, où les poser. */
function Together({ presets, views, ingredients, outputs, context }: TogetherProps) {
  const data = getGameData()
  const packed = packFarms(data, emptyGrid(data), largestFirst(data, presets), [], ownPlotOf(data))
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <div className="space-y-2">
        <FarmPreview layout={planPreview(packed.grid, packed.farms, farmsName(packed.farms))} />
        <p className="text-xs text-ink-muted">
          {tr(
            'Elles ne dépendent pas l’une de l’autre et tiennent ensemble dans un greenhouse : pose-les en même temps.',
            'They do not depend on each other and fit together in one greenhouse: place them at the same time.',
          )}
        </p>
      </div>
      <div className="min-w-0 space-y-4 text-sm">
        <FarmWarning chapters={views.map((view) => view.chapter)} />
        <section>
          <h5 className={LABEL}>{tr('Ça donne', 'It makes')}</h5>
          <ul className="flex flex-wrap gap-1.5">
            {outputs.map((output) => {
              const done = output.need !== null && output.need.missing === 0
              return (
                <li key={output.mutation.id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${done ? 'border-accent/40' : 'border-line'}`}>
                  <CropLabel crop={{ kind: 'mutation', id: output.mutation.id }} />
                  {output.need && (
                    <span className={`tabular-nums ${done ? 'text-accent-strong' : 'text-ink-muted'}`}>
                      {Math.min(output.owned, output.need.required)} / {output.need.required}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
        <FarmTimingInfo views={views} />
        <section>
          <h5 className={LABEL}>{tr('À poser', 'To place')}</h5>
          <ul className="flex flex-wrap gap-1.5">
            {ingredients.map((item) => {
              const short = item.owned !== null && item.owned < item.count
              return (
                <li
                  key={keyOf(item.crop)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${item.owned === null ? 'border-line' : short ? 'border-danger/50' : 'border-accent/40'}`}
                >
                  <CropLabel crop={item.crop} />
                  <span className="tabular-nums text-ink-muted">{item.owned === null ? `× ${item.count}` : `${Math.min(item.owned, item.count)} / ${item.count}`}</span>
                </li>
              )
            })}
          </ul>
        </section>
        <GreenhouseButtons presets={presets} context={context} />
      </div>
    </div>
  )
}
