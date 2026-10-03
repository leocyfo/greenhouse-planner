import type { ReactNode } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { NumberStepper } from '../../components/NumberStepper'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import type { CropRef } from '../../types/game'
import { farmsName, planPreview } from './farmPacking'
import { FarmPreview } from './FarmPreview'
import { FarmDecay, FarmTimeChip } from './FarmTimingInfo'
import { FarmWarning } from './FarmWarning'
import { NextStageNote } from './NextStageNote'
import type { ChapterView, FarmIngredient, FarmOutput, FarmUpgrade } from './guideModel'
import { useFarmActions } from './useFarmActions'

const LABEL = 'text-[11px] font-bold tracking-wider text-ink-muted uppercase'
const ACCENT_BUTTON = 'h-9 rounded-lg bg-accent px-4 text-sm font-semibold text-canvas transition-colors hover:bg-accent-strong'
const BUTTON = 'h-9 rounded-lg border border-line px-4 text-sm text-ink transition-colors hover:bg-panel-raised'

type Tone = 'place' | 'running'

const TONES: Record<Tone, { readonly border: string; readonly text: string; readonly bar: string }> = {
  place: { border: 'border-accent/50', text: 'text-accent-strong', bar: 'bg-accent' },
  running: { border: 'border-sky-400/40', text: 'text-sky-300', bar: 'bg-sky-400' },
}

const keyOf = (crop: CropRef) => (crop.kind === 'mutation' ? `m:${crop.id}` : `b:${crop.name}`)
const titles = (views: readonly ChapterView[]) => views.map((view) => view.chapter.title).join(' + ')

/** Ce que demandent toutes les fermes ensemble (mutations d'abord). */
function totalIngredients(views: readonly ChapterView[]): FarmIngredient[] {
  const total = new Map<string, FarmIngredient>()
  for (const item of views.flatMap((view) => view.ingredients)) {
    const previous = total.get(keyOf(item.crop))
    total.set(keyOf(item.crop), { ...item, count: (previous?.count ?? 0) + item.count })
  }
  const all = [...total.values()]
  return [...all.filter((item) => item.crop.kind === 'mutation'), ...all.filter((item) => item.crop.kind === 'base')]
}

/** Ce que donnent les fermes, sans doublon. */
function allOutputs(views: readonly ChapterView[]): FarmOutput[] {
  const outputs = new Map<string, FarmOutput>()
  for (const output of views.flatMap((view) => view.outputs)) outputs.set(output.mutation.id, output)
  return [...outputs.values()]
}

function Bar({ value, max, tone }: { readonly value: number; readonly max: number; readonly tone: Tone }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 100
  return (
    <span aria-hidden="true" className="block h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
      <span className={`block h-full rounded-full transition-[width] duration-500 ${percent >= 100 ? 'bg-accent' : TONES[tone].bar}`} style={{ width: `${percent}%` }} />
    </span>
  )
}

/**
 * Ce que donnent les fermes : l'avancement de toute la ferme, puis une tuile par mutation (stock /
 * besoin de la route, barre, stock modifiable).
 */
function Progress({ outputs, tone, hint }: { readonly outputs: readonly FarmOutput[]; readonly tone: Tone; readonly hint?: string }) {
  const setOwned = useAppStore((s) => s.setOwned)
  const needed = outputs.filter((output) => output.need !== null)
  const required = needed.reduce((sum, output) => sum + (output.need?.required ?? 0), 0)
  const owned = needed.reduce((sum, output) => sum + Math.min(output.owned, output.need?.required ?? 0), 0)
  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h5 className={LABEL}>{tr('Ça donne', 'It makes')}</h5>
        {required > 0 && (
          <>
            <span className="max-w-48 flex-1">
              <Bar value={owned} max={required} tone={tone} />
            </span>
            <span className="text-xs tabular-nums text-ink-muted">
              {owned} / {required}
            </span>
          </>
        )}
        {hint && <span className="text-xs text-ink-muted sm:ml-auto">{hint}</span>}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {outputs.map((output) => {
          const done = output.need !== null && output.need.missing === 0
          return (
            <li key={output.mutation.id} className={`space-y-1.5 rounded-lg border px-2.5 py-2 ${done ? 'border-accent/40 bg-accent/5' : 'border-line bg-canvas/40'}`}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <CropLabel crop={{ kind: 'mutation', id: output.mutation.id }} />
                </span>
                {output.need && (
                  <span className={`shrink-0 text-xs tabular-nums ${done ? 'text-accent-strong' : 'text-ink-muted'}`}>
                    {done ? '✓ ' : ''}
                    {Math.min(output.owned, output.need.required)} / {output.need.required}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {output.need ? <Bar value={output.owned} max={output.need.required} tone={tone} /> : <span className="flex-1" />}
                <NumberStepper value={output.owned} onChange={(count) => setOwned(output.mutation.id, count)} name={output.mutation.name} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Crops à poser : × N, ou stock / besoin pour une mutation (en rouge s'il en manque). */
function Ingredients({ items, progress = false }: { readonly items: readonly FarmIngredient[]; readonly progress?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const short = progress && item.owned !== null && item.owned < item.count
        return (
          <li key={keyOf(item.crop)} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${short ? 'border-danger/50' : 'border-line'}`}>
            <CropLabel crop={item.crop} />
            <span className="tabular-nums text-ink-muted">
              {progress && item.owned !== null ? `${Math.min(item.owned, item.count)} / ${item.count}` : `× ${item.count}`}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Conseils d'AVRG des fermes, repliables ; le nom de la ferme seulement quand il y en a plusieurs. */
function Advice({ views, open = false }: { readonly views: readonly ChapterView[]; readonly open?: boolean }) {
  const farms = views.filter((view) => view.chapter.text || view.layout.notes)
  if (farms.length === 0) return null
  return (
    <details open={open} className="group rounded-lg border border-line bg-canvas/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
          ▸
        </span>
        {tr('Conseils d’AVRG', 'AVRG’s tips')}
      </summary>
      <div className="space-y-2 border-t border-line px-3 py-2 text-sm text-ink-muted">
        {farms.map((view) => (
          <div key={view.chapter.id} className="space-y-0.5">
            {farms.length > 1 && <p className="font-semibold text-ink">{view.chapter.title}</p>}
            {view.chapter.text && <p>{view.chapter.text}</p>}
            {view.layout.notes && <p className="text-xs">{view.layout.notes}</p>}
          </div>
        ))}
      </div>
    </details>
  )
}

interface CardProps {
  readonly tone: Tone
  /** Petite ligne au-dessus du titre : ce qu'il faut faire, et où. */
  readonly kicker: string
  readonly title: string
  /** À droite de l'en-tête : durée, bouton principal. */
  readonly aside: ReactNode
  /** Aperçu du plan du greenhouse, à gauche ; sans aperçu, le contenu prend toute la largeur. */
  readonly preview: Parameters<typeof planPreview> | null
  readonly children: ReactNode
}

/** Carte de « À faire maintenant » : en-tête (quoi, où, durée, action), aperçu du plan à gauche, détails à droite. */
function Card({ tone, kicker, title, aside, preview, children }: CardProps) {
  const [grid, farms] = preview ?? []
  return (
    <article className={`overflow-hidden rounded-2xl border bg-panel ${TONES[tone].border}`}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3">
        {/* Base de 14 rem : sur un écran étroit, la durée et le bouton passent sous le titre. */}
        <div className="min-w-0 flex-1 basis-56">
          <p className={`text-[11px] font-bold tracking-wider uppercase ${TONES[tone].text}`}>{kicker}</p>
          <h4 className="text-lg font-semibold">{title}</h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">{aside}</div>
      </header>
      <div className={`grid gap-5 p-5 ${grid ? 'lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]' : ''}`}>
        {grid && farms && <FarmPreview layout={planPreview(grid, farms, farmsName(farms))} />}
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </article>
  )
}

interface PlaceCardProps {
  readonly greenhouse: number
  readonly views: readonly ChapterView[]
  readonly preview: Parameters<typeof planPreview>
  /** add : dans le plan affiché ; new : dans un nouveau plan du greenhouse. */
  readonly mode: 'add' | 'new'
  /** Des fermes poussent déjà dans le plan affiché : les nouvelles s'ajoutent à côté. */
  readonly alongside: boolean
}

/** À poser : les fermes prêtes pour ce greenhouse, ensemble (aperçu du plan, ce qu'il faut, ce qu'elles donnent). */
export function PlaceCard({ greenhouse, views, preview, mode, alongside }: PlaceCardProps) {
  const actions = useFarmActions()
  return (
    <Card
      tone="place"
      kicker={alongside ? tr(`À ajouter · Greenhouse ${greenhouse + 1}`, `To add · Greenhouse ${greenhouse + 1}`) : tr(`À poser · Greenhouse ${greenhouse + 1}`, `To place · Greenhouse ${greenhouse + 1}`)}
      title={titles(views)}
      preview={preview}
      aside={
        <>
          <FarmTimeChip views={views} />
          <button type="button" onClick={() => actions.place(greenhouse, views.map((view) => view.layout), mode)} className={ACCENT_BUTTON}>
            {alongside ? tr(`Ajouter au Greenhouse ${greenhouse + 1}`, `Add to Greenhouse ${greenhouse + 1}`) : tr(`Poser dans le Greenhouse ${greenhouse + 1}`, `Place in Greenhouse ${greenhouse + 1}`)}
          </button>
        </>
      }
    >
      <FarmWarning chapters={views.map((view) => view.chapter)} />
      <section className="space-y-2">
        <h5 className={LABEL}>{tr('Il te faut', 'You need')}</h5>
        <Ingredients items={totalIngredients(views)} />
      </section>
      <Progress outputs={allOutputs(views)} tone="place" />
      <FarmDecay views={views} />
      {views.map((view) => view.nextStage && <NextStageNote key={view.nextStage.id} stage={view.nextStage} />)}
      <Advice views={views} open />
    </Card>
  )
}

/**
 * Passer une ferme à son étape suivante (Snoozling Complex : étape 1 → 2) : aperçu du plan transformé,
 * ce qu'il faut ajouter, ce qu'elle donne.
 */
export function UpgradeCard({ upgrade }: { readonly upgrade: FarmUpgrade }) {
  const actions = useFarmActions()
  const { greenhouse, view, result } = upgrade
  return (
    <Card
      tone="place"
      kicker={tr(`Étape suivante · Greenhouse ${greenhouse + 1}`, `Next step · Greenhouse ${greenhouse + 1}`)}
      title={view.chapter.title}
      preview={[result.grid, result.farms, '']}
      aside={
        <>
          <FarmTimeChip views={[view]} />
          <button type="button" onClick={() => actions.upgrade(greenhouse, result)} className={ACCENT_BUTTON}>
            {tr('Passer à l’étape suivante', 'Move on to the next step')}
          </button>
        </>
      }
    >
      <FarmWarning chapters={[view.chapter]} />
      <section className="space-y-2">
        <h5 className={LABEL}>{tr('À ajouter', 'To add')}</h5>
        <Ingredients items={view.ingredients} />
        <p className="text-xs text-ink-muted">
          {tr('La ferme de l’étape précédente se transforme : ce qui y pousse reste.', 'The previous step’s farm is transformed: what grows there stays.')}
        </p>
      </section>
      <Progress outputs={view.outputs} tone="place" />
      <FarmDecay views={[view]} />
      <Advice views={[view]} open />
    </Card>
  )
}

/** L'étape suivante d'une ferme en cours : ce qu'il manque pour y passer, et comment. */
function NextStage({ view }: { readonly view: ChapterView }) {
  return (
    <section className="space-y-2 rounded-lg border border-dashed border-line px-3 py-2.5">
      <h5 className="text-sm font-semibold">
        {tr('Ensuite, dans ce greenhouse : ', 'Then, in this greenhouse: ')}
        {view.chapter.title}
      </h5>
      <Ingredients items={view.ingredients} progress />
      <NextStageNote stage={view.chapter} titled={false} />
    </section>
  )
}

interface RunningCardProps {
  readonly greenhouse: number
  readonly views: readonly ChapterView[]
  /** Plan affiché du greenhouse et ses fermes, pour l'aperçu. */
  readonly preview: Parameters<typeof planPreview> | null
  /** Étapes suivantes de ces fermes, pas encore prêtes. */
  readonly nextStages?: readonly ChapterView[]
}

/** En cours : les fermes posées, à laisser pousser ; le stock se met à jour ici en récoltant. */
export function RunningCard({ greenhouse, views, preview, nextStages = [] }: RunningCardProps) {
  const actions = useFarmActions()
  return (
    <Card
      tone="running"
      kicker={tr(`En cours · Greenhouse ${greenhouse + 1}`, `Growing · Greenhouse ${greenhouse + 1}`)}
      title={titles(views)}
      preview={preview}
      aside={
        <>
          <FarmTimeChip views={views} />
          <button type="button" onClick={() => actions.open(greenhouse)} className={BUTTON}>
            {tr('Ouvrir dans la Grille', 'Open in the Grid')}
          </button>
        </>
      }
    >
      <FarmWarning chapters={views.map((view) => view.chapter)} />
      <Progress
        outputs={allOutputs(views)}
        tone="running"
        hint={tr('Récolte et mets ton stock à jour : la ferme se termine quand tout est là.', 'Harvest and update your stock: the farm ends once everything is there.')}
      />
      <FarmDecay views={views} />
      {nextStages.map((view) => (
        <NextStage key={view.chapter.id} view={view} />
      ))}
      <Advice views={views} />
    </Card>
  )
}
