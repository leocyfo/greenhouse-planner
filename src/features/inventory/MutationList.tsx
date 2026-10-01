import { formatRarity } from '../../components/labels'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import type { GoalPlan } from '../../store/useGoalPlan'
import { rarityColor } from '../../theme/palette'
import type { Mutation } from '../../types/game'
import { MutationCard } from './MutationCard'
import { useMutationDialog } from './useMutationDialog'

interface MutationListProps {
  /** Mutations qui passent les filtres. */
  readonly mutations: readonly Mutation[]
  readonly goalPlan: GoalPlan
  readonly onResetFilters: () => void
}

/**
 * Vue Liste, à la manière du wiki de skymutations.eu : une section par rareté (avec « tout
 * cocher »), une carte par mutation ; un clic sur la carte ouvre la fiche complète.
 */
export function MutationList({ mutations, goalPlan, onResetFilters }: MutationListProps) {
  const data = getGameData()
  const inventory = useAppStore((s) => s.progress.inventory)
  const setAnalyzedMany = useAppStore((s) => s.setAnalyzedMany)
  const { plan, analyzed } = goalPlan
  const dialog = useMutationDialog()
  const groups = data.rarities
    .map((rarity) => ({ rarity, mutations: mutations.filter((m) => m.rarity === rarity) }))
    .filter((group) => group.mutations.length > 0)

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
        <p className="text-sm text-ink-muted">{tr('Aucune mutation ne correspond à ces filtres.', 'No mutation matches these filters.')}</p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-panel-raised"
        >
          {tr('Réinitialiser les filtres', 'Reset the filters')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="text-xs text-ink-muted">
        {tr(
          'Clique sur une carte pour sa fiche complète · grande case : analysée · « Tout cocher » marque toutes les mutations affichées de la rareté.',
          'Click a card for its full sheet · big box: analyzed · “Tick all” marks every shown mutation of that rarity.',
        )}
      </p>
      {groups.map((group) => {
        const ids = group.mutations.map((mutation) => mutation.id)
        const allAnalyzed = ids.every((id) => analyzed.has(id))
        const color = rarityColor(group.rarity)
        const label = formatRarity(group.rarity)
        return (
          <section key={group.rarity} aria-labelledby={`rarity-${group.rarity}`}>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2">
              <h3
                id={`rarity-${group.rarity}`}
                className="flex items-center gap-2.5 text-lg font-bold tracking-[0.15em] uppercase"
                style={{ color }}
              >
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: color }} />
                {label}
                <span className="text-sm font-normal tracking-normal text-ink-muted normal-case">· {ids.length}</span>
              </h3>
              <button
                type="button"
                onClick={() => setAnalyzedMany(ids, !allAnalyzed)}
                aria-label={tr(
                  `${allAnalyzed ? 'Décocher' : 'Cocher'} « analysée » pour les ${ids.length} mutations ${label} affichées`,
                  `${allAnalyzed ? 'Untick' : 'Tick'} “analyzed” for the ${ids.length} ${label} mutations shown`,
                )}
                className={`rounded border px-2 py-1 text-[10px] font-bold tracking-wide uppercase transition-colors ${allAnalyzed ? 'border-danger/60 text-danger hover:bg-danger/10' : 'border-accent/60 text-accent-strong hover:bg-accent/10'}`}
              >
                {allAnalyzed ? tr('Tout décocher', 'Untick all') : tr('Tout cocher', 'Tick all')}
              </button>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.mutations.map((mutation) => (
                <MutationCard
                  key={mutation.id}
                  mutation={mutation}
                  need={plan.needs.get(mutation.id)}
                  owned={inventory[mutation.id] ?? 0}
                  analyzed={analyzed.has(mutation.id)}
                  onOpen={() => dialog.open(mutation.id)}
                  openRef={dialog.triggerRef(mutation.id)}
                />
              ))}
            </ul>
          </section>
        )
      })}
      {dialog.dialog}
    </div>
  )
}
