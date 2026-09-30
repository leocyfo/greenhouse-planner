import { useEffect, useMemo, useState } from 'react'
import { formatRarity } from '../../components/labels'
import { getGameData } from '../../data'
import { useAppStore } from '../../store/appStore'
import { useGoalPlan } from '../../store/useGoalPlan'
import { useMutationDialog } from '../inventory/useMutationDialog'
import { FocusBar } from './FocusBar'
import { buildTree, focusOn, mutationState, type MutationState } from './graphModel'
import { RecipeTree } from './RecipeTree'
import { STATE_INFO } from './stateInfo'
import { MutationTreeCard } from './TreeCard'
import { TreeLegend } from './TreeLegend'

/**
 * Onglet Encyclopédie : l'arbre des recettes par étape. Survoler une mutation met en avant tout son
 * chemin et ce qu'elle permet de faire ; cliquer ouvre sa fiche et garde la mise en avant.
 */
export function EncyclopediaTab() {
  const data = getGameData()
  const { plan } = useGoalPlan()
  const inventory = useAppStore((s) => s.progress.inventory)
  const [showBaseCrops, setShowBaseCrops] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const dialog = useMutationDialog()
  const dialogOpen = dialog.dialog !== null

  const model = useMemo(() => buildTree(data, { showBaseCrops }), [data, showBaseCrops])
  const states = useMemo(
    () => new Map(data.mutations.map((m) => [m.id, mutationState(data, m, plan.needs.get(m.id), inventory)])),
    [data, plan, inventory],
  )
  const counts = useMemo(() => {
    const result = new Map<MutationState, number>()
    for (const state of states.values()) result.set(state, (result.get(state) ?? 0) + 1)
    return result
  }, [states])
  const activeId = hoveredId ?? pinnedId
  const focus = useMemo(() => (activeId ? focusOn(model.edges, activeId) : null), [model, activeId])

  /** Ouvre la fiche et garde la mutation en avant, pour retrouver son chemin en fermant la fiche. */
  const open = (id: string) => {
    setPinnedId(id)
    dialog.open(id)
  }

  // Échap retire la mise en avant ; fiche ouverte, Échap ferme d'abord la fiche.
  useEffect(() => {
    if (!pinnedId || dialogOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinnedId(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [pinnedId, dialogOpen])

  return (
    <div className="space-y-4">
      <header className="sr-only">
        <h2>Encyclopédie</h2>
        <p>Arbre des recettes : chaque mutation dans la colonne de son étape, reliée à ses ingrédients. Entrée ouvre la fiche.</p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-56 flex-col gap-1 text-xs text-ink-muted">
          Trouver une mutation
          <select
            value={pinnedId ?? ''}
            onChange={(event) => {
              const id = event.target.value
              if (!id) return setPinnedId(null)
              open(id)
              document.getElementById(`arbre-${id}`)?.scrollIntoView({ block: 'nearest', inline: 'center' })
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

      <TreeLegend counts={counts} />
      <FocusBar focus={focus} state={activeId ? states.get(activeId) : undefined} />
      <RecipeTree
        model={model}
        focus={focus}
        states={states}
        plan={plan}
        inventory={inventory}
        triggerRef={dialog.triggerRef}
        onActivate={setHoveredId}
        onOpen={open}
        onClear={() => setPinnedId(null)}
      />

      {model.specials.length > 0 && (
        <section aria-labelledby="specials-title" className="space-y-2">
          <div>
            <h3 id="specials-title" className="text-sm font-semibold">
              Conditions spéciales
            </h3>
            <p className="text-xs text-ink-muted">Hors de l&apos;arbre : aucune recette à poser, une condition à part (voir la fiche).</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {model.specials.map((id) => {
              const mutation = data.mutationsById.get(id)
              if (!mutation) return null
              return (
                <MutationTreeCard
                  key={id}
                  mutation={mutation}
                  state={states.get(id) ?? 'special'}
                  owned={inventory[id] ?? 0}
                  required={plan.needs.get(id)?.required ?? 0}
                  style={{ width: 200, height: 48 }}
                  buttonRef={dialog.triggerRef(id)}
                  onOpen={() => dialog.open(id)}
                />
              )
            })}
          </div>
        </section>
      )}

      {dialog.dialog}
    </div>
  )
}
