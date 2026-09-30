import { useCallback, useMemo, useState } from 'react'
import { formatRarity } from '../../components/labels'
import { getGameData } from '../../data'
import { useAppStore } from '../../store/appStore'
import { useGoalPlan } from '../../store/useGoalPlan'
import { GraphLegend } from './GraphLegend'
import { buildGraph, mutationState, type MutationState } from './graphModel'
import { MutationDetails } from './MutationDetails'
import { MutationGraph } from './MutationGraph'
import { STATE_INFO } from './stateInfo'

/** Onglet Encyclopédie : graphe des recettes par rareté et fiche de chaque mutation. */
export function EncyclopediaTab() {
  const data = getGameData()
  const { plan } = useGoalPlan()
  const inventory = useAppStore((s) => s.progress.inventory)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showBaseCrops, setShowBaseCrops] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | null>(null)

  const model = useMemo(() => buildGraph(data, { showBaseCrops }), [data, showBaseCrops])
  const states = useMemo(
    () => new Map(data.mutations.map((m) => [m.id, mutationState(data, m, plan.needs.get(m.id), inventory)])),
    [data, plan, inventory],
  )
  const counts = useMemo(() => {
    const result = new Map<MutationState, number>()
    for (const state of states.values()) result.set(state, (result.get(state) ?? 0) + 1)
    return result
  }, [states])

  /** Ouvre une fiche et recentre le graphe dessus. */
  const openAndFocus = useCallback((id: string) => {
    setSelectedId(id)
    setFocusRequest({ id, nonce: Date.now() })
  }, [])

  return (
    <div className="space-y-4">
      <header className="sr-only">
        <h2>Encyclopédie</h2>
        <p>Chaque mutation reliée à ses ingrédients, par rareté. Entrée sur une mutation ouvre sa fiche.</p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-56 flex-col gap-1 text-xs text-ink-muted">
          Aller à une mutation
          <select
            value={selectedId ?? ''}
            onChange={(event) => {
              if (event.target.value) openAndFocus(event.target.value)
              else setSelectedId(null)
            }}
            className="h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink"
          >
            <option value="">Choisir…</option>
            {data.rarities.map((rarity) => (
              <optgroup key={rarity} label={formatRarity(rarity)}>
                {data.mutations
                  .filter((m) => m.rarity === rarity)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {STATE_INFO[states.get(m.id) ?? 'locked'].label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showBaseCrops}
            onChange={(event) => setShowBaseCrops(event.target.checked)}
            className="size-4 accent-accent"
          />
          Afficher les crops de base
        </label>
      </div>

      <GraphLegend counts={counts} />

      <div className={`gap-4 lg:grid ${selectedId ? 'lg:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}>
        <div className="h-[70vh] min-h-[28rem] overflow-hidden rounded-xl border border-line bg-panel">
          <MutationGraph
            model={model}
            states={states}
            plan={plan}
            inventory={inventory}
            selectedId={selectedId}
            onSelect={setSelectedId}
            focusRequest={focusRequest}
          />
        </div>
        {selectedId && (
          <MutationDetails
            mutationId={selectedId}
            state={states.get(selectedId) ?? 'locked'}
            need={plan.needs.get(selectedId)}
            onClose={() => setSelectedId(null)}
            onSelect={openAndFocus}
          />
        )}
      </div>
    </div>
  )
}
