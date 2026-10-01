/** Arbre des recettes : colonnes par rareté ou par étape, liens en SVG, cartes par-dessus. */
import { plural } from '../../components/labels'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import type { Inventory, Plan } from '../../logic/recipes'
import { rarityColor, TREE_COLORS } from '../../theme/palette'
import { amountText, edgeRole, isDimmed, type MutationState, type TreeEdge, type TreeFocus, type TreeModel } from './graphModel'
import { BaseCropChip, MutationTreeCard } from './TreeCard'

const ROLE_ORDER = { none: 0, path: 1, use: 2 } as const
/** Les cartes glissent vers leur nouvelle place (vue filtrée, largeur) ; les liens arrivent ensuite. */
const MOVE = 'transition-[left,top] duration-[240ms] ease-out'
const EDGES_DELAY = '180ms'
const FILL = { width: '100%', height: '100%' } as const

function edgeStyle(role: 'path' | 'use' | 'none', focused: boolean) {
  if (role === 'path') return { stroke: TREE_COLORS.path, strokeWidth: 2, opacity: 1 }
  if (role === 'use') return { stroke: TREE_COLORS.use, strokeWidth: 2, opacity: 1 }
  return { stroke: TREE_COLORS.edge, strokeWidth: 1.5, opacity: focused ? 0.12 : 0.9 }
}

interface RecipeTreeProps {
  /** null tant que la largeur disponible n'est pas mesurée. */
  readonly model: TreeModel | null
  /** Change avec la vue (tout l'arbre, mutation choisie, mode) : les liens réapparaissent en fondu. */
  readonly viewKey: string
  readonly label: string
  /** Zone mesurée : l'espace entre les colonnes suit sa largeur. */
  readonly boxRef: (element: HTMLElement | null) => void
  readonly focus: TreeFocus | null
  /** Recherche en cours : seules ces mutations restent en pleine lumière. */
  readonly matches: ReadonlySet<string> | null
  /** « Tout le chemin » ou objectif choisi : quantité totale de chaque nœud. */
  readonly totals: ReadonlyMap<string, number> | null
  /** Pour quoi sont ces totaux, dans leur infobulle (« 1 Blastberry », « Rose Dragon Pet »). */
  readonly totalsFor: string
  readonly selectedId: string | null
  readonly states: ReadonlyMap<string, MutationState>
  readonly plan: Plan
  readonly inventory: Inventory
  readonly triggerRef: (mutationId: string) => (element: HTMLElement | null) => void
  /** Survol ou focus d'une carte (null en la quittant). */
  readonly onActivate: (mutationId: string | null) => void
  /** Clic sur une carte : la choisir, ou ouvrir sa fiche si elle l'est déjà. */
  readonly onChoose: (mutationId: string) => void
  /**
   * Bande à gauche de l'arbre, avec une flèche : ▶ agrandit (crops de base, ou tout le chemin de la
   * mutation choisie), ◀ revient à la vue réduite.
   */
  readonly expander: { readonly expanded: boolean; readonly onToggle: () => void; readonly label: string } | null
}

export function RecipeTree({
  model,
  viewKey,
  label,
  boxRef,
  focus,
  matches,
  totals,
  totalsFor,
  selectedId,
  states,
  plan,
  inventory,
  triggerRef,
  onActivate,
  onChoose,
  expander,
}: RecipeTreeProps) {
  const data = getGameData()
  const roleOf = (edge: TreeEdge) => (focus ? edgeRole(edge, focus) : 'none')
  // Les liens mis en avant sont dessinés en dernier, donc par-dessus les autres.
  const edges = model ? [...model.edges].sort((a, b) => ROLE_ORDER[roleOf(a)] - ROLE_ORDER[roleOf(b)]) : []
  // Quantités : le total pour la mutation choisie (« Tout le chemin »), sinon celles de la recette
  // de la mutation mise en avant.
  const amounts = new Map<string, { readonly text: string; readonly title?: string }>(
    totals
      ? [...totals].map(([id, total]) => [
          id,
          { text: `×${total}`, title: tr(`${total} au total pour ${totalsFor}`, `${total} in total for ${totalsFor}`) },
        ])
      : focus && model
        ? model.edges.filter((edge) => edge.target === focus.id).map((edge) => [edge.source, { text: amountText(edge) }])
        : [],
  )
  const dimmedNode = (id: string) => (matches ? !matches.has(id) : isDimmed(id, focus))

  return (
    <div className="flex rounded-xl border border-line bg-panel">
      {expander && (
        <button
          type="button"
          aria-expanded={expander.expanded}
          aria-label={expander.label}
          title={expander.label}
          onClick={expander.onToggle}
          className="flex w-8 shrink-0 items-center justify-center rounded-l-xl border-r border-line bg-white/5 text-ink/80 transition-colors hover:bg-panel-raised hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 10 12" className={`size-3.5 transition-transform duration-200 ${expander.expanded ? 'rotate-180' : ''}`}>
            <path d="M1 0.5 9.5 6 1 11.5Z" fill="currentColor" />
          </svg>
        </button>
      )}
      <div ref={boxRef} className="min-w-0 flex-1 overflow-x-auto p-3">
        {model && (
          <div
            role="group"
            aria-label={label}
            className="relative mx-auto transition-[height] duration-[240ms] ease-out"
            style={{ width: model.width, height: model.height }}
          >
            <svg
              key={viewKey}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 animate-fade-in overflow-visible"
              style={{ animationDelay: EDGES_DELAY, animationFillMode: 'both' }}
              width={model.width}
              height={model.height}
            >
              {edges.map((edge) => (
                <path
                  key={edge.id}
                  d={edge.path}
                  fill="none"
                  strokeDasharray={edge.relation === 'condition' ? undefined : '5 4'}
                  className="transition-[opacity,stroke] duration-150"
                  {...edgeStyle(roleOf(edge), focus !== null || matches !== null)}
                />
              ))}
            </svg>

            {model.headers.map((header) => (
              <div
                key={header.key}
                aria-hidden="true"
                className="pointer-events-none absolute top-0 text-center transition-[left,width] duration-[240ms] ease-out"
                style={{ left: header.x, width: header.width }}
              >
                <p className="text-sm font-semibold" style={header.rarity ? { color: rarityColor(header.rarity) } : undefined}>
                  {header.title}
                </p>
                <p className="text-[11px] text-ink-muted">
                  {plural(header.count, header.key === 'base' ? 'crop' : 'mutation')}
                </p>
              </div>
            ))}

            {model.nodes.map((node) => {
              const mutation = node.kind === 'mutation' ? data.mutationsById.get(node.id) : undefined
              const selected = node.id === selectedId
              return (
                <div
                  key={node.id}
                  className={`absolute animate-fade-in ${MOVE}`}
                  style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                >
                  {mutation ? (
                    <MutationTreeCard
                      mutation={mutation}
                      state={states.get(node.id) ?? 'locked'}
                      owned={inventory[node.id] ?? 0}
                      required={plan.needs.get(node.id)?.required ?? 0}
                      step={tr(`Étape ${node.step}`, `Step ${node.step}`)}
                      selected={selected}
                      active={focus?.id === node.id}
                      dimmed={dimmedNode(node.id)}
                      amount={amounts.get(node.id) ?? null}
                      actionLabel={
                        selected ? tr('Choisie. Ouvrir la fiche', 'Chosen. Open the sheet') : tr("Ne garder que ce qu'il faut pour la faire", 'Keep only what it takes to make it')
                      }
                      style={FILL}
                      buttonRef={triggerRef(node.id)}
                      onOpen={() => onChoose(node.id)}
                      onActivate={() => onActivate(node.id)}
                      onDeactivate={() => onActivate(null)}
                    />
                  ) : node.kind === 'base' ? (
                    <BaseCropChip
                      name={node.id.slice('base:'.length)}
                      dimmed={dimmedNode(node.id)}
                      amount={amounts.get(node.id) ?? null}
                      style={FILL}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
