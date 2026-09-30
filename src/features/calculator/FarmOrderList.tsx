import { CropLabel } from '../../components/game/CropLabel'
import { SizeBadge, SoilBadge, StagesBadge } from '../../components/game/MutationBadges'
import { getGameData } from '../../data'
import { formatDuration } from '../../logic/format'
import type { CalculatorResult } from './calculatorResult'
import { recipeLines, scheduleText } from '../../components/game/recipeText'

/** Liste de courses : les mutations à obtenir, ingrédients d'abord (ordre de farm). */
export function FarmOrderList({ result }: { readonly result: CalculatorResult }) {
  const data = getGameData()
  const { plan, estimate, decay } = result

  if (plan.farmOrder.length === 0) {
    return <p className="text-sm text-accent-strong">✓ Tout est déjà en stock.</p>
  }

  return (
    <ol className="space-y-2">
      {plan.farmOrder.map((id, index) => {
        const mutation = data.mutationsById.get(id)
        const need = plan.needs.get(id)
        const entry = estimate.schedule.get(id)
        if (!mutation || !need) return null
        const warning = decay.find((w) => w.mutationId === id)
        return (
          <li key={id} className="rounded-lg border border-line bg-canvas/40 p-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink-muted">{index + 1}.</span>
              <CropLabel crop={{ kind: 'mutation', id }} />
              <span className="text-sm">
                à obtenir <strong className="tabular-nums">{need.missing}</strong>
              </span>
              <span className="text-xs text-ink-muted">
                (besoin {need.required}, en stock {need.owned}
                {need.basis === 'avrg-optimum' ? ', total AVRG' : ''})
              </span>
            </div>
            <div className="mt-2 space-y-1.5 pl-8">
              <div className="flex flex-wrap gap-1.5">
                <SoilBadge surface={mutation.surface} />
                <SizeBadge size={mutation.size} />
                <StagesBadge stages={mutation.growthStages} />
              </div>
              {recipeLines(data, mutation).map((line) => (
                <p key={line} className="text-sm text-ink-muted">
                  {line}
                </p>
              ))}
              {entry && <p className="text-xs text-ink-muted">{scheduleText(entry)}</p>}
              {warning && (
                <p className="text-xs text-warning">
                  ⚠ Production ≈ {formatDuration(warning.productionSeconds)} : les mutations posées autour meurent
                  après ~{formatDuration(warning.limitSeconds)}. Prévois de les remplacer, ou ajoute des emplacements.
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
