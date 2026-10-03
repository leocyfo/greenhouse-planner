import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import type { LayoutPreset } from '../../types/game'
import { ownPlotOf } from './farmPacking'
import { placementFor, type ChapterContext } from './guideModel'
import { useFarmActions } from './useFarmActions'

interface GreenhouseButtonsProps {
  /** La ferme, ou les fermes à poser ensemble. */
  readonly presets: readonly LayoutPreset[]
  readonly context: ChapterContext
  /** Greenhouses où la ferme pousse déjà : « Ouvrir ». */
  readonly placedIn?: readonly number[]
  /** Chapitre à montrer dans la Grille quand on ouvre un greenhouse. */
  readonly chapterId?: string
}

/**
 * Un bouton par greenhouse : poser la ferme (ou les fermes ensemble), l'ajouter à côté de celles qui
 * poussent si elle tient, « Plein » sinon (rien n'est remplacé), ou l'ouvrir là où elle pousse.
 */
export function GreenhouseButtons({ presets, context, placedIn = [], chapterId }: GreenhouseButtonsProps) {
  const data = getGameData()
  const actions = useFarmActions()
  const several = presets.length > 1
  // Une ferme seule sur son greenhouse (Chorus Fruit) : rien ne doit y pousser à côté.
  const alone = presets.some(ownPlotOf(data))
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <span className="text-xs text-ink-muted">{tr('Greenhouse :', 'Greenhouse:')}</span>
      {actions.greenhouses.map((greenhouse) => {
        const locked = !actions.unlocked.includes(greenhouse)
        const here = placedIn.includes(greenhouse)
        const placement = locked || here ? null : placementFor(data, context, greenhouse, presets)
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
                : several
                  ? tr(`Poser ensemble dans le ${greenhouse + 1}`, `Place together in #${greenhouse + 1}`)
                  : tr(`Poser dans le ${greenhouse + 1}`, `Place in #${greenhouse + 1}`)
        const title = locked
          ? tr('Greenhouse verrouillé (Ethereal Vines)', 'Greenhouse locked (Ethereal Vines)')
          : full
            ? alone
              ? tr('Elle doit être seule sur son greenhouse : attends que les fermes qui y poussent finissent.', 'It must be alone in its greenhouse: wait for the farms growing there to finish.')
              : tr('Pas la place à côté des fermes qui y poussent encore.', 'No room next to the farms still growing there.')
            : alongside
              ? several
                ? tr('Elles tiennent à côté des fermes qui y poussent : elles s’y ajoutent.', 'They fit next to the farms growing there: they are added.')
                : tr('Elle tient à côté des fermes qui y poussent : elle s’y ajoute.', 'It fits next to the farms growing there: it is added.')
              : undefined
        return (
          <button
            key={greenhouse}
            type="button"
            disabled={locked || full}
            title={title}
            onClick={() => {
              if (here) actions.open(greenhouse, chapterId)
              else if (placement && placement.mode !== 'full') actions.place(greenhouse, presets, placement.mode)
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
  )
}
