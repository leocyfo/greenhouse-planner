import { CropLabel } from '../../components/game/CropLabel'
import { getGameData } from '../../data'
import { formatDecimal, tr } from '../../i18n/locale'
import { formatDuration } from '../../logic/format'
import { useAppStore } from '../../store/appStore'
import type { CalculatorResult } from './calculatorResult'
import { cropName } from '../../components/game/recipeText'

/** Estimation du temps : chemin le plus long, hypothèses et alertes. */
export function TimeEstimatePanel({ result }: { readonly result: CalculatorResult }) {
  const data = getGameData()
  const spots = useAppStore((s) => s.calculator.spots)
  const cells = useAppStore((s) => s.calculator.lonelilyCells)
  const { estimate, stageSeconds, randomSpawn, decay } = result

  const perStage = randomSpawn ? (randomSpawn.perStage.min + randomSpawn.perStage.max) / 2 : 0

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-muted">{tr('Temps minimum', 'Minimum time')}</dt>
          <dd className="text-lg font-semibold">{formatDuration(estimate.criticalPathSeconds)}</dd>
          <dd className="text-xs text-ink-muted">{estimate.criticalPathStages} growth stages</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">{tr("Durée d'un growth stage", 'Length of a growth stage')}</dt>
          <dd className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {formatDuration(stageSeconds)}
          </dd>
          <dd className="text-xs text-ink-muted">{tr('selon tes réglages de croissance', 'from your growth settings')}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">{tr('Tout à la suite', 'All in a row')}</dt>
          <dd className="text-lg font-semibold">{formatDuration(estimate.totalStages * stageSeconds)}</dd>
          <dd className="text-xs text-ink-muted">{tr(`${estimate.totalStages} stages, sans parallèle`, `${estimate.totalStages} stages, nothing in parallel`)}</dd>
        </div>
      </dl>

      {estimate.criticalPath.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-ink-muted">{tr('Chemin le plus long (ce qui fixe la durée) :', 'Longest path (what sets the duration):')}</p>
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {estimate.criticalPath.map((id, index) => {
              const entry = estimate.schedule.get(id)
              return (
                <li key={id} className="flex items-center gap-1.5">
                  {index > 0 && <span aria-hidden="true" className="text-ink-muted">→</span>}
                  <CropLabel crop={{ kind: 'mutation', id }} />
                  {entry && (
                    <span className="text-xs text-ink-muted">
                      ({entry.startStage}–{entry.finishStage})
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <p className="text-xs text-ink-muted">
        {tr(
          `Hypothèses : spawns instantanés et efficacité parfaite (comme le guide AVRG), ${spots} emplacement${spots > 1 ? 's' : ''} par recette`,
          `Assumptions: instant spawns and perfect efficiency (like the AVRG guide), ${spots} spot${spots !== 1 ? 's' : ''} per recipe`,
        )}
        {randomSpawn &&
          tr(
            `, ${cropName(data, { kind: 'mutation', id: randomSpawn.mutationId })} : ${cells} cases vides ≈ ${formatDecimal(perStage, 2)} par stage`,
            `, ${cropName(data, { kind: 'mutation', id: randomSpawn.mutationId })}: ${cells} empty cells ≈ ${formatDecimal(perStage, 2)} per stage`,
          )}
        .
      </p>

      {spots === 1 && estimate.criticalPathStages > 0 && (
        <p className="text-xs text-ink-muted">
          {tr(
            "Avec un seul emplacement, chaque recette produit ses exemplaires l'un après l'autre. Les plans du guide AVRG en utilisent plusieurs (jusqu'à 8 pour les Magic Jellybean) : augmente « Emplacements par recette » pour une estimation plus proche de la réalité.",
            'With a single spot, each recipe makes its copies one after the other. The AVRG guide layouts use several (up to 8 for the Magic Jellybean): raise “Spots per recipe” for an estimate closer to reality.',
          )}
        </p>
      )}

      {estimate.unknown.length > 0 && (
        <p className="text-xs text-warning">
          {tr(
            `⚠ Durée inconnue pour ${estimate.unknown.map((id) => cropName(data, { kind: 'mutation', id })).join(', ')} : comptée 0, l'estimation est partielle.`,
            `⚠ Unknown duration for ${estimate.unknown.map((id) => cropName(data, { kind: 'mutation', id })).join(', ')}: counted as 0, the estimate is partial.`,
          )}
        </p>
      )}

      {decay.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <p className="font-medium text-warning">
            {tr(`⚠ Attention à la decay (~${data.mechanics.decayDays} jours)`, `⚠ Watch out for decay (~${data.mechanics.decayDays} days)`)}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink">
            {decay.map((warning) => (
              <li key={warning.mutationId}>
                {tr(
                  `${cropName(data, { kind: 'mutation', id: warning.mutationId })} : production ≈ ${formatDuration(warning.productionSeconds)}. Les mutations posées autour mourront avant la fin.`,
                  `${cropName(data, { kind: 'mutation', id: warning.mutationId })}: production ≈ ${formatDuration(warning.productionSeconds)}. The mutations placed around will die before the end.`,
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
