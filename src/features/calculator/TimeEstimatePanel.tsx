import { CropLabel } from '../../components/game/CropLabel'
import { getGameData } from '../../data'
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
          <dt className="text-xs text-ink-muted">Temps minimum</dt>
          <dd className="text-lg font-semibold">{formatDuration(estimate.criticalPathSeconds)}</dd>
          <dd className="text-xs text-ink-muted">{estimate.criticalPathStages} growth stages</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Durée d&apos;un growth stage</dt>
          <dd className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {formatDuration(stageSeconds)}
          </dd>
          <dd className="text-xs text-ink-muted">selon tes réglages de croissance</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Tout à la suite</dt>
          <dd className="text-lg font-semibold">{formatDuration(estimate.totalStages * stageSeconds)}</dd>
          <dd className="text-xs text-ink-muted">{estimate.totalStages} stages, sans parallèle</dd>
        </div>
      </dl>

      {estimate.criticalPath.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-ink-muted">Chemin le plus long (ce qui fixe la durée) :</p>
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
        Hypothèses : spawns instantanés et efficacité parfaite (comme le guide AVRG), {spots} emplacement
        {spots > 1 ? 's' : ''} par recette
        {randomSpawn &&
          `, ${cropName(data, { kind: 'mutation', id: randomSpawn.mutationId })} : ${cells} cases vides ≈ ${perStage.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} par stage`}
        .
      </p>

      {spots === 1 && estimate.criticalPathStages > 0 && (
        <p className="text-xs text-ink-muted">
          Avec un seul emplacement, chaque recette produit ses exemplaires l&apos;un après l&apos;autre. Les plans du
          guide AVRG en utilisent plusieurs (jusqu&apos;à 8 pour les Magic Jellybean) : augmente « Emplacements par
          recette » pour une estimation plus proche de la réalité.
        </p>
      )}

      {estimate.unknown.length > 0 && (
        <p className="text-xs text-warning">
          ⚠ Durée inconnue pour{' '}
          {estimate.unknown.map((id) => cropName(data, { kind: 'mutation', id })).join(', ')} : comptée 0,
          l&apos;estimation est partielle.
        </p>
      )}

      {decay.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <p className="font-medium text-warning">⚠ Attention à la decay (~{data.mechanics.decayDays} jours)</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink">
            {decay.map((warning) => (
              <li key={warning.mutationId}>
                {cropName(data, { kind: 'mutation', id: warning.mutationId })} : production ≈{' '}
                {formatDuration(warning.productionSeconds)}. Les mutations posées autour mourront avant la fin.
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
