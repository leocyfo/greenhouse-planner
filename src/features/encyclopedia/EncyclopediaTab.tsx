import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { goToTab } from '../../app/navigation'
import { SegmentedControl } from '../../components/SegmentedControl'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { isManualSpecial } from '../../logic/nextAction'
import { useAppStore } from '../../store/appStore'
import { useGoalPlan } from '../../store/useGoalPlan'
import { useMutationDialog } from '../inventory/useMutationDialog'
import { FocusBar } from './FocusBar'
import {
  buildTree,
  chainTotals,
  focusOn,
  mutationState,
  type MutationState,
  type TreeArrangement,
  type TreeMode,
} from './graphModel'
import { searchMutations } from './searchMutations'
import { MutationSearch } from './MutationSearch'
import { RecipeTree } from './RecipeTree'
import { MutationTreeCard } from './TreeCard'
import { TreeLegend } from './TreeLegend'
import { useContentWidth } from './useContentWidth'

/** Rangements des colonnes de l'arbre. */
const arrangements = () =>
  [
    {
      value: 'rarity',
      label: tr('Par rareté', 'By rarity'),
      description: tr('Une colonne par rareté, de Common à Legendary.', 'One column per rarity, from Common to Legendary.'),
    },
    {
      value: 'step',
      label: tr('Par étape', 'By step'),
      description: tr(
        "Dans l'ordre de fabrication : chaque mutation une colonne après son ingrédient le plus avancé.",
        'In crafting order: each mutation one column after its most advanced ingredient.',
      ),
    },
  ] as const

/**
 * Onglet Encyclopédie : l'arbre des recettes, colonnes par rareté (ou par étape), sur toute la
 * largeur de la page. Survoler
 * une mutation met en avant son chemin ; la choisir (clic) ne garde que ce qu'il faut pour la faire,
 * avant et après ou tout le chemin ; un second clic ouvre sa fiche.
 */
export function EncyclopediaTab() {
  const data = getGameData()
  const { plan } = useGoalPlan()
  const inventory = useAppStore((s) => s.progress.inventory)
  const calculateOnly = useAppStore((s) => s.calculateOnly)
  const [query, setQuery] = useState('')
  const [showBaseCrops, setShowBaseCrops] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<TreeMode>('neighbors')
  const [arrangement, setArrangement] = useState<TreeArrangement>('rarity')
  const arrangementName = useId()
  const treeBox = useRef<HTMLDivElement>(null)
  const availableWidth = useContentWidth(treeBox)
  const dialog = useMutationDialog()
  const dialogOpen = dialog.dialog !== null

  const specials = useMemo(() => data.mutations.filter((m) => isManualSpecial(data, m)), [data])
  const model = useMemo(
    () =>
      availableWidth === null
        ? null
        : buildTree(data, { arrangement, showBaseCrops, selection: selectedId ? { id: selectedId, mode } : null, availableWidth }),
    [data, arrangement, showBaseCrops, selectedId, mode, availableWidth],
  )
  const states = useMemo(
    () => new Map(data.mutations.map((m) => [m.id, mutationState(data, m, plan.needs.get(m.id), inventory)])),
    [data, plan, inventory],
  )
  const counts = useMemo(() => {
    const result = new Map<MutationState, number>()
    for (const state of states.values()) result.set(state, (result.get(state) ?? 0) + 1)
    return result
  }, [states])
  // Une carte qui disparaît (vue filtrée) ne signale pas la sortie du pointeur : on l'ignore.
  const shown = useMemo(() => new Set(model?.nodes.map((node) => node.id)), [model])
  const activeId = [hoveredId, selectedId].find((id) => id !== null && shown.has(id)) ?? null
  const focus = useMemo(() => (model && activeId ? focusOn(model.edges, activeId) : null), [model, activeId])
  const results = useMemo(() => searchMutations(data.mutations, query), [data, query])
  const matches = useMemo(() => (query.trim() ? new Set(results.map((m) => m.id)) : null), [query, results])
  const selectedInTree = selectedId !== null && shown.has(selectedId)
  const totals = useMemo(
    () => (selectedId && selectedInTree && mode === 'chain' ? chainTotals(data, selectedId) : null),
    [data, selectedId, selectedInTree, mode],
  )

  /** Choisit une mutation ; déjà choisie (ou sans recette, hors de l'arbre), ouvre sa fiche. */
  const choose = (id: string) => {
    if (id === selectedId || specials.some((m) => m.id === id)) dialog.open(id)
    else setSelectedId(id)
  }
  /** Le Calculateur, avec cette seule mutation (autant que demandent les objectifs, au moins 1). */
  const calculate = (id: string) => {
    calculateOnly(id, Math.max(plan.needs.get(id)?.required ?? 0, 1))
    goToTab('calculateur')
  }
  /** Retour à tout l'arbre : le bouton disparaît, le focus passe à la carte qui était choisie. */
  const showAll = () => {
    if (selectedId) document.getElementById(`arbre-${selectedId}`)?.focus()
    setSelectedId(null)
  }

  // Échap revient à tout l'arbre et retire la mise en avant (y compris celle du focus rendu à une
  // carte à la fermeture de la fiche) ; fiche ouverte, Échap ferme d'abord la fiche.
  useEffect(() => {
    if ((!selectedId && !hoveredId) || dialogOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSelectedId(null)
      setHoveredId(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedId, hoveredId, dialogOpen])

  const selectedName = selectedId ? data.mutationsById.get(selectedId)?.name : undefined
  const treeLabel = selectedName
    ? tr(
        `Arbre des recettes : ${selectedName}, ${mode === 'neighbors' ? 'avant et après' : 'tout le chemin'}`,
        `Recipe tree: ${selectedName}, ${mode === 'neighbors' ? 'before and after' : 'whole path'}`,
      )
    : tr(`Arbre des recettes, ${arrangement === 'rarity' ? 'par rareté' : 'par étape'}`, `Recipe tree, ${arrangement === 'rarity' ? 'by rarity' : 'by step'}`)

  return (
    <div className="space-y-4">
      <header className="sr-only">
        <h2>{tr('Encyclopédie', 'Encyclopedia')}</h2>
        <p>
          {tr(
            "Arbre des recettes : chaque mutation dans la colonne de sa rareté (ou de son étape), reliée à ses ingrédients. Entrée sur une mutation ne garde que ce qu'il faut pour la faire ; Entrée à nouveau ouvre sa fiche ; Échap revient à tout l'arbre. La recherche propose les mutations dont le nom correspond.",
            'Recipe tree: each mutation in the column of its rarity (or step), linked to its ingredients. Enter on a mutation keeps only what it takes to make it; Enter again opens its sheet; Esc goes back to the whole tree. The search suggests the mutations whose name matches.',
          )}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <MutationSearch query={query} results={results} states={states} onQueryChange={setQuery} onChoose={choose} />
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          <span aria-hidden="true">{tr('Colonnes', 'Columns')}</span>
          <SegmentedControl legend={tr('Colonnes', 'Columns')} name={arrangementName} options={arrangements()} value={arrangement} onChange={setArrangement} />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showBaseCrops}
            onChange={(event) => setShowBaseCrops(event.target.checked)}
            className="size-4 accent-accent"
          />
          {tr('Afficher les crops de base', 'Show base crops')}
        </label>
      </div>

      <TreeLegend counts={counts} />
      <FocusBar
        selectedId={selectedId}
        hoveredId={activeId}
        states={states}
        mode={mode}
        onModeChange={setMode}
        showsTotals={totals !== null}
        onOpenSheet={dialog.open}
        onCalculate={calculate}
        onClear={showAll}
      />
      <RecipeTree
        model={model}
        viewKey={`${arrangement}:${selectedId ?? 'tout'}:${mode}:${showBaseCrops}`}
        label={treeLabel}
        boxRef={treeBox}
        focus={focus}
        matches={matches}
        totals={totals}
        selectedId={selectedId}
        states={states}
        plan={plan}
        inventory={inventory}
        triggerRef={dialog.triggerRef}
        onActivate={setHoveredId}
        onChoose={choose}
      />

      {specials.length > 0 && (
        <section aria-labelledby="specials-title" className="space-y-2">
          <div>
            <h3 id="specials-title" className="text-sm font-semibold">
              {tr('Conditions spéciales', 'Special conditions')}
            </h3>
            <p className="text-xs text-ink-muted">
              {tr(
                "Hors de l'arbre : aucune recette à poser, une condition à part (voir la fiche).",
                'Outside the tree: no recipe to lay out, a separate condition (see the sheet).',
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {specials.map((mutation) => (
              <MutationTreeCard
                key={mutation.id}
                mutation={mutation}
                state={states.get(mutation.id) ?? 'special'}
                owned={inventory[mutation.id] ?? 0}
                required={plan.needs.get(mutation.id)?.required ?? 0}
                style={{ width: 200, height: 48 }}
                buttonRef={dialog.triggerRef(mutation.id)}
                onOpen={() => dialog.open(mutation.id)}
              />
            ))}
          </div>
        </section>
      )}

      {dialog.dialog}
    </div>
  )
}
