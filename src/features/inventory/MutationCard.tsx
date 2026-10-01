import { HarvestBadge, SizeBadge, SoilBadge, StagesBadge } from '../../components/game/MutationBadges'
import { WikiIcon } from '../../components/game/WikiIcon'
import { NumberStepper } from '../../components/NumberStepper'
import { tr } from '../../i18n/locale'
import type { MutationNeed } from '../../logic/recipes'
import { useAppStore } from '../../store/appStore'
import { rarityColor } from '../../theme/palette'
import type { Mutation } from '../../types/game'

const MONO = 'font-mono uppercase leading-tight'

interface MutationCardProps {
  readonly mutation: Mutation
  readonly need: MutationNeed | undefined
  readonly owned: number
  readonly analyzed: boolean
  /** Ouvre la fiche complète (clic n'importe où sur la carte). */
  readonly onOpen: () => void
  readonly openRef: (element: HTMLElement | null) => void
}

/**
 * Carte d'une mutation, à la manière du wiki de skymutations.eu. Toute la carte ouvre la fiche :
 * le nom est un bouton étiré sur la carte (::after), et la case « analysée », le compteur et les
 * badges à infobulle passent au-dessus. Survol : la carte se soulève ; clic sur la carte (pas sur le
 * compteur) : elle s'enfonce.
 */
export function MutationCard({ mutation, need, owned, analyzed, onOpen, openRef }: MutationCardProps) {
  const setOwned = useAppStore((s) => s.setOwned)
  const setAnalyzed = useAppStore((s) => s.setAnalyzed)

  return (
    <li
      className={`group relative flex cursor-pointer flex-col rounded-lg border bg-panel p-3 transition duration-150 ease-out hover:bg-panel-raised hover:shadow-lg hover:shadow-black/40 motion-safe:hover:-translate-y-0.5 motion-safe:has-[.card-open:active]:translate-y-0 motion-safe:has-[.card-open:active]:scale-[0.98] ${analyzed ? 'border-accent/70' : 'border-line hover:border-ink-muted/50'}`}
    >
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-canvas">
              <WikiIcon
                name={mutation.name}
                size={32}
                className="transition-transform duration-150 motion-safe:group-hover:scale-115"
              />
            </span>
            <div className="min-w-0">
              <button
                ref={openRef}
                type="button"
                onClick={onOpen}
                aria-label={tr(`Fiche de ${mutation.name}`, `${mutation.name} sheet`)}
                className="card-open block max-w-full cursor-pointer truncate text-left text-base leading-tight font-bold after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
                style={{ color: rarityColor(mutation.rarity) }}
              >
                {mutation.name}
              </button>
              {analyzed && <p className={`${MONO} mt-0.5 animate-fade-in text-[10px] text-accent-strong`}>{tr('Analysée', 'Analyzed')}</p>}
            </div>
          </div>
          <label title={tr('Analysée', 'Analyzed')} className="relative z-10 flex shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={analyzed}
              onChange={(event) => setAnalyzed(mutation.id, event.target.checked)}
              aria-label={tr(`${mutation.name} analysée`, `${mutation.name} analyzed`)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded border border-line bg-canvas text-ink-muted/30 transition-colors peer-checked:animate-pop peer-checked:border-accent peer-checked:bg-accent/15 peer-checked:text-accent-strong peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
            >
              ✓
            </span>
          </label>
        </div>

        {/* Les badges à infobulle (boutons) passent au-dessus du bouton étiré. */}
        <div className="mt-2.5 flex flex-wrap gap-1.5 [&_button]:relative [&_button]:z-10">
          <SoilBadge surface={mutation.surface} />
          <SizeBadge size={mutation.size} />
          <StagesBadge stages={mutation.growthStages} />
          <HarvestBadge mutation={mutation} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <div className="relative z-10">
          <NumberStepper value={owned} onChange={(count) => setOwned(mutation.id, count)} name={mutation.name} />
        </div>
        <NeedSummary need={need} owned={owned} />
      </div>
    </li>
  )
}

/** Besoin selon les objectifs cochés : « besoin 3 / 36 », puis ce qui manque (ou complété). */
function NeedSummary({ need, owned }: { readonly need: MutationNeed | undefined; readonly owned: number }) {
  if (!need) return <p className={`${MONO} text-right text-[10px] text-ink-muted`}>{tr('Non demandée', 'Not requested')}</p>
  const complete = need.missing === 0
  return (
    <div className={`${MONO} text-right`}>
      <p className="text-xs tabular-nums">
        <span className="text-ink-muted">{tr('Besoin ', 'Need ')}</span>
        <span className={`font-bold ${complete ? 'text-accent-strong' : 'text-warning'}`}>
          {complete && '✓ '}
          {owned} / {need.required}
        </span>
      </p>
      <p className="mt-0.5 text-[10px] text-ink-muted">
        {complete ? (
          <span className="text-accent-strong">{tr('complété', 'complete')}</span>
        ) : (
          <span className="text-danger">{tr(`manque ${need.missing}`, `${need.missing} missing`)}</span>
        )}
        {need.buy ? tr(' · au bazar', ' · at the bazaar') : ''}
        {need.basis === 'avrg-optimum' && (
          <abbr title={tr('Total recommandé par le guide AVRG (mode Optimum)', 'Total recommended by the AVRG guide (Optimum mode)')} className="no-underline">
            {' '}
            · AVRG
          </abbr>
        )}
      </p>
    </div>
  )
}
