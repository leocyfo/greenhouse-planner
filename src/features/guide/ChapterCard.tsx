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
import { chapterView, placementFor, type ChapterContext } from './guideModel'
import { StatusBadge } from './StatusBadge'
import { useFarmActions } from './useFarmActions'

interface ChapterCardProps {
  readonly number: number
  readonly chapter: GuideChapter
  readonly context: ChapterContext
  /** Ouvert d'emblée (ferme en cours, proposée ou demandée depuis la Grille). */
  readonly open: boolean
}

/**
 * Un chapitre du guide AVRG : la ferme (aperçu), ce qu'elle demande (stock vérifié), ce qu'elle
 * donne (stock modifiable) et ses conseils ; puis où la poser parmi les greenhouses débloqués.
 */
export function ChapterCard({ number, chapter, context, open }: ChapterCardProps) {
  const data = getGameData()
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
  const { layout, ingredients, outputs, placedIn, status } = view
  const missing = ingredients.filter((item) => item.owned !== null && item.owned < item.count)

  return (
    <details
      id={`guide-${chapter.id}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group scroll-mt-28 rounded-xl border border-line bg-panel"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 hover:bg-panel-raised [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block text-ink-muted transition-transform group-open:rotate-90">
          ▸
        </span>
        <span className="text-xs font-bold text-ink-muted tabular-nums">{number}.</span>
        <h4 className="font-semibold">{chapter.title}</h4>
        <span aria-hidden="true" className="flex -space-x-1">
          {outputs.slice(0, 6).map((output) => (
            <WikiIcon key={output.mutation.id} name={output.mutation.name} size={20} />
          ))}
        </span>
        <span className="ml-auto">
          <StatusBadge status={status} placedIn={placedIn} />
        </span>
      </summary>

      {isOpen && (
      <div className="grid gap-5 border-t border-line p-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div className="space-y-2">
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

          <section>
            <h5 className="mb-1.5 text-[11px] font-bold tracking-wider text-ink-muted uppercase">{tr('À poser', 'To place')}</h5>
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

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs text-ink-muted">{tr('Greenhouse :', 'Greenhouse:')}</span>
            {actions.greenhouses.map((greenhouse) => {
              const locked = !actions.unlocked.includes(greenhouse)
              const here = placedIn.includes(greenhouse)
              // Ajoutée à côté des fermes en cours si elle tient ; greenhouse libre : nouveau plan ;
              // plein : rien n'est remplacé.
              const placement = locked || here ? null : placementFor(data, context, greenhouse, [layout])
              const full = placement?.mode === 'full'
              const alongside = placement?.mode === 'add' && (context.greenhouses[greenhouse]?.active.length ?? 0) > 0
              const label = locked
                ? `🔒 ${greenhouse + 1}`
                : here
                  ? tr(`Ouvrir le ${greenhouse + 1}`, `Open #${greenhouse + 1}`)
                  : full
                    ? tr(`Plein (${greenhouse + 1})`, `Full (#${greenhouse + 1})`)
                    : alongside
                      ? tr(`Ajouter au ${greenhouse + 1}`, `Add to #${greenhouse + 1}`)
                      : tr(`Poser dans le ${greenhouse + 1}`, `Place in #${greenhouse + 1}`)
              const title = locked
                ? tr('Greenhouse verrouillé (Ethereal Vines)', 'Greenhouse locked (Ethereal Vines)')
                : full
                  ? tr('Pas la place à côté des fermes qui y poussent encore.', 'No room next to the farms still growing there.')
                  : alongside
                    ? tr('Elle tient à côté des fermes qui y poussent : elle s’y ajoute.', 'It fits next to the farms growing there: it is added.')
                    : undefined
              return (
                <button
                  key={greenhouse}
                  type="button"
                  disabled={locked || full}
                  title={title}
                  onClick={() => {
                    if (here) actions.open(greenhouse, chapter.id)
                    else if (placement && placement.mode !== 'full') actions.place(greenhouse, [layout], placement.mode)
                  }}
                  className={`h-8 rounded-lg border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    here ? 'border-sky-400/50 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20' : 'border-accent/50 bg-accent/10 text-accent-strong hover:bg-accent/20'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      )}
    </details>
  )
}
