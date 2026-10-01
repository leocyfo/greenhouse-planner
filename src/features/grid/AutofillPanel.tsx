/**
 * Plan automatique (onglet Grille) : pour une mutation, le site cherche un plan qui donne le nombre
 * d'emplacements voulu avec le moins de mutations possible (logic/autofill), sur les cases
 * utilisables du plan affiché, et l'ajoute comme nouveau plan du greenhouse.
 */
import { useId, useMemo, useState } from 'react'
import { formatRarity } from '../../components/labels'
import { NumberStepper } from '../../components/NumberStepper'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { autofillTargets, type AutofillResult } from '../../logic/autofill'
import { isUsableGround } from '../../logic/ground'
import { nextActions } from '../../logic/nextAction'
import { useAppStore } from '../../store/appStore'
import type { GridLayoutState } from '../../store/state'
import { useGoalPlan } from '../../store/useGoalPlan'
import { useAutofill } from './useAutofill'

/** Emplacements demandables : au-delà, un greenhouse de 10 x 10 ne suffit de toute façon plus. */
const MAX_SPOTS = 25

interface AutofillPanelProps {
  readonly greenhouse: number
  /** Plan affiché : ses cases verrouillées ou cassées sont gardées et évitées. */
  readonly layout: GridLayoutState
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'done'; readonly name: string; readonly wanted: number; readonly result: AutofillResult }
  | { readonly kind: 'error'; readonly text: string }

export function AutofillPanel({ greenhouse, layout }: AutofillPanelProps) {
  const data = getGameData()
  const { width, height } = data.mechanics.greenhouse
  const inventory = useAppStore((s) => s.progress.inventory)
  const addGeneratedLayout = useAppStore((s) => s.addGeneratedLayout)
  const { plan } = useGoalPlan()
  const run = useAutofill()
  const selectId = useId()
  const targets = useMemo(() => autofillTargets(data), [data])
  // Par défaut : la prochaine mutation recommandée (Tableau de bord), si elle se remplit.
  const recommended = useMemo(() => nextActions(data, plan, inventory).recommended, [data, plan, inventory])
  const [targetId, setTargetId] = useState(
    () => targets.find((m) => m.id === recommended)?.id ?? targets.find((m) => m.side === 1)?.id ?? '',
  )
  const target = data.mutationsById.get(targetId)
  const [spots, setSpots] = useState(4)
  const [onlyStock, setOnlyStock] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const create = async () => {
    if (!target) return
    setStatus({ kind: 'busy' })
    const stock = onlyStock
      ? new Map(target.conditions.flatMap((c) => (c.crop.kind === 'mutation' ? [[c.crop.id, inventory[c.crop.id] ?? 0] as const] : [])))
      : null
    // Un plan neuf : seules les cases verrouillées ou cassées du plan affiché restent ; ailleurs,
    // le sol de départ (Dirt), sans les sols peints pour un autre plan.
    const surface = data.surfaces[0] ?? ''
    const ground = layout.ground.map((value) => (isUsableGround(value) ? surface : value))
    const outcome = await run({ targetId: target.id, spots, width, height, ground, stock })
    if (!outcome.ok) return setStatus({ kind: 'error', text: outcome.reason })
    const name = tr(`Auto : ${target.name} (${outcome.result.spots})`, `Auto: ${target.name} (${outcome.result.spots})`)
    addGeneratedLayout(greenhouse, name, outcome.result.ground, outcome.result.placements)
    setStatus({ kind: 'done', name, wanted: spots, result: outcome.result })
  }

  return (
    <Panel title={tr('Plan automatique', 'Automatic plan')}>
      <p className="mb-3 text-xs text-ink-muted">
        {tr(
          'Le site cherche un plan qui donne ces emplacements avec le moins de mutations possible, sur les cases libres de ce plan (les cases verrouillées ou cassées sont évitées). Il est ajouté comme nouveau plan.',
          'The site looks for a plan that gives these spots with as few mutations as possible, on the free cells of this plan (locked or broken cells are avoided). It is added as a new plan.',
        )}
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void create()
        }}
      >
        <label htmlFor={selectId} className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-ink-muted">
          {tr('Mutation', 'Mutation')}
          <select
            id={selectId}
            value={targetId}
            onChange={(event) => {
              const next = data.mutationsById.get(event.target.value)
              setTargetId(event.target.value)
              setSpots(next && next.side > 1 ? 1 : 4)
              setStatus({ kind: 'idle' })
            }}
            className="h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink"
          >
            {data.rarities.map((rarity) => (
              <optgroup key={rarity} label={formatRarity(rarity)}>
                {targets
                  .filter((m) => m.rarity === rarity)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          <span aria-hidden="true">{tr('Emplacements', 'Spots')}</span>
          <NumberStepper
            value={spots}
            onChange={setSpots}
            name={tr('Emplacements', 'Spots')}
            inputLabel={tr('Emplacements voulus', 'Wanted spots')}
            min={1}
            max={MAX_SPOTS}
          />
        </div>
        <button
          type="submit"
          disabled={!target || status.kind === 'busy'}
          aria-busy={status.kind === 'busy'}
          className="h-9 rounded-lg bg-accent px-3 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          {status.kind === 'busy' ? tr('Calcul…', 'Working…') : tr('Créer le plan', 'Create the plan')}
        </button>
      </form>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyStock}
          onChange={(event) => setOnlyStock(event.target.checked)}
          className="size-4 accent-accent"
        />
        {tr('Seulement avec les mutations de mon stock', 'Only with the mutations in my stock')}
      </label>
      <AutofillStatus status={status} />
    </Panel>
  )
}

/** Résultat du dernier calcul, lu par les lecteurs d'écran. */
function AutofillStatus({ status }: { readonly status: Status }) {
  const data = getGameData()
  if (status.kind === 'idle' || status.kind === 'busy') return <p role="status" className="sr-only" />
  if (status.kind === 'error') {
    return (
      <p role="status" className="mt-3 text-sm text-warning">
        {status.text}
      </p>
    )
  }
  const { name, wanted, result } = status
  const crops = [
    ...[...result.mutations].map(([id, count]) => `${count} ${data.mutationsById.get(id)?.name ?? id}`),
    ...[...result.baseCrops].map(([crop, count]) => `${count} ${crop}`),
  ]
  return (
    <div role="status" className="mt-3 animate-fade-in space-y-1 text-sm">
      <p>
        {tr(`Plan « ${name} » ajouté : `, `Plan “${name}” added: `)}
        <strong>{result.spots}</strong> {tr(`emplacement${result.spots > 1 ? 's' : ''}`, `spot${result.spots !== 1 ? 's' : ''}`)}
        {result.spots < wanted ? tr(` sur ${wanted} voulus (pas plus de place ou de stock)`, ` out of ${wanted} wanted (no more room or stock)`) : ''}.
      </p>
      <p className="text-ink-muted">{crops.join(' · ')}</p>
      {result.conflicts > 0 && (
        <p className="text-warning">
          {tr(
            `⚠ ${result.conflicts} case${result.conflicts > 1 ? 's' : ''} d'emplacement où une autre mutation peut aussi apparaître (le plan évite les conflits qu'il peut ; ceux-ci viennent des ingrédients mêmes).`,
            `⚠ ${result.conflicts} spot cell${result.conflicts !== 1 ? 's' : ''} where another mutation can also appear (the plan avoids the conflicts it can; these come from the ingredients themselves).`,
          )}
        </p>
      )}
    </div>
  )
}
