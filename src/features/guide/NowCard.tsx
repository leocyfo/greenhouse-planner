import type { ReactNode } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { NumberStepper } from '../../components/NumberStepper'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import type { CropRef } from '../../types/game'
import { farmsName, planPreview } from './farmPacking'
import { FarmPreview } from './FarmPreview'
import type { ChapterView, FarmIngredient, FarmOutput } from './guideModel'
import { useFarmActions } from './useFarmActions'

const LABEL = 'mb-1.5 text-[11px] font-bold tracking-wider text-ink-muted uppercase'
const ACCENT_BUTTON = 'h-9 rounded-lg bg-accent px-4 text-sm font-semibold text-canvas transition-colors hover:bg-accent-strong'
const BUTTON = 'h-9 rounded-lg border border-line px-4 text-sm text-ink transition-colors hover:bg-panel-raised'

const keyOf = (crop: CropRef) => (crop.kind === 'mutation' ? `m:${crop.id}` : `b:${crop.name}`)

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

function Outputs({ outputs }: { readonly outputs: readonly FarmOutput[] }) {
  const setOwned = useAppStore((s) => s.setOwned)
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {outputs.map((output) => {
        const done = output.need !== null && output.need.missing === 0
        return (
          <li key={output.mutation.id} className="flex items-center justify-between gap-2 rounded-lg bg-canvas/50 px-2.5 py-1.5 text-sm">
            <CropLabel crop={{ kind: 'mutation', id: output.mutation.id }} />
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
  )
}

/** Conseils d'AVRG de chaque ferme. */
function Advice({ views }: { readonly views: readonly ChapterView[] }) {
  const texts = views.flatMap((view) => [view.chapter.text, view.layout.notes].filter(Boolean).map((text) => ({ title: view.chapter.title, text })))
  if (texts.length === 0) return null
  return (
    <ul className="space-y-1 rounded-lg border-l-2 border-accent/50 bg-canvas/40 px-3 py-2 text-sm text-ink-muted">
      {texts.map(({ title, text }) => (
        <li key={`${title}-${text}`}>
          <strong className="text-ink">{title}</strong> — {text}
        </li>
      ))}
    </ul>
  )
}

function Card({ tone, title, children }: { readonly tone: 'place' | 'running'; readonly title: ReactNode; readonly children: ReactNode }) {
  return (
    <article className={`space-y-4 rounded-2xl border bg-panel p-5 ${tone === 'place' ? 'border-accent/50' : 'border-sky-400/40'}`}>
      <h4 className="text-lg font-semibold">{title}</h4>
      {children}
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
  const [grid, farms] = preview
  return (
    <Card
      tone="place"
      title={
        <>
          {alongside
            ? tr(`Ajoute au Greenhouse ${greenhouse + 1} : `, `Add to Greenhouse ${greenhouse + 1}: `)
            : tr(`Pose dans le Greenhouse ${greenhouse + 1} : `, `Place in Greenhouse ${greenhouse + 1}: `)}
          <span className="text-accent-strong">{views.map((view) => view.chapter.title).join(' + ')}</span>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <FarmPreview layout={planPreview(grid, farms, farmsName(farms))} />
        <div className="min-w-0 space-y-4">
          <section>
            <h5 className={LABEL}>{tr('Il te faut', 'You need')}</h5>
            <ul className="flex flex-wrap gap-1.5">
              {totalIngredients(views).map((item) => (
                <li key={keyOf(item.crop)} className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs">
                  <CropLabel crop={item.crop} />
                  <span className="tabular-nums text-ink-muted">× {item.count}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h5 className={LABEL}>{tr('Ça donne', 'It makes')}</h5>
            <Outputs outputs={allOutputs(views)} />
          </section>
          <Advice views={views} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => actions.place(greenhouse, views.map((view) => view.layout), mode)} className={ACCENT_BUTTON}>
              {alongside
                ? tr(`Ajouter au Greenhouse ${greenhouse + 1}`, `Add to Greenhouse ${greenhouse + 1}`)
                : tr(`Poser dans le Greenhouse ${greenhouse + 1}`, `Place in Greenhouse ${greenhouse + 1}`)}
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

/** En cours : les fermes posées, à laisser pousser ; le stock se met à jour ici en récoltant. */
export function RunningCard({ greenhouse, views }: { readonly greenhouse: number; readonly views: readonly ChapterView[] }) {
  const actions = useFarmActions()
  return (
    <Card
      tone="running"
      title={
        <>
          {tr(`En cours dans le Greenhouse ${greenhouse + 1} : `, `Growing in Greenhouse ${greenhouse + 1}: `)}
          <span className="text-sky-300">{views.map((view) => view.chapter.title).join(' + ')}</span>
        </>
      }
    >
      <p className="text-sm text-ink-muted">
        {tr(
          'Laisse pousser et récolte ; mets ton stock à jour au fur et à mesure : quand tout est là, la ferme est finie et la suite s’affiche.',
          'Let it grow and harvest; update your stock as you go: once everything is there, the farm is done and what comes next shows up.',
        )}
      </p>
      <Outputs outputs={allOutputs(views)} />
      <Advice views={views} />
      <button type="button" onClick={() => actions.open(greenhouse)} className={BUTTON}>
        {tr('Ouvrir dans la Grille', 'Open in the Grid')}
      </button>
    </Card>
  )
}
