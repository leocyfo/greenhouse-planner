/** Arbre des recettes : colonnes par étape, liens en SVG, cartes par-dessus. */
import { getGameData } from '../../data'
import type { Inventory, Plan } from '../../logic/recipes'
import { TREE_COLORS } from '../../theme/palette'
import { amountText, edgeRole, isDimmed, type MutationState, type TreeEdge, type TreeFocus, type TreeModel } from './graphModel'
import { BaseCropChip, MutationTreeCard } from './TreeCard'

const ROLE_ORDER = { none: 0, path: 1, use: 2 } as const

function edgeStyle(role: 'path' | 'use' | 'none', focused: boolean) {
  if (role === 'path') return { stroke: TREE_COLORS.path, strokeWidth: 2, opacity: 1 }
  if (role === 'use') return { stroke: TREE_COLORS.use, strokeWidth: 2, opacity: 1 }
  return { stroke: TREE_COLORS.edge, strokeWidth: 1.25, opacity: focused ? 0.1 : 0.85 }
}

interface RecipeTreeProps {
  readonly model: TreeModel
  readonly focus: TreeFocus | null
  readonly states: ReadonlyMap<string, MutationState>
  readonly plan: Plan
  readonly inventory: Inventory
  readonly triggerRef: (mutationId: string) => (element: HTMLElement | null) => void
  /** Survol ou focus d'une carte (null en la quittant). */
  readonly onActivate: (mutationId: string | null) => void
  readonly onOpen: (mutationId: string) => void
  /** Clic dans le vide : plus de mutation mise en avant. */
  readonly onClear: () => void
}

export function RecipeTree({ model, focus, states, plan, inventory, triggerRef, onActivate, onOpen, onClear }: RecipeTreeProps) {
  const data = getGameData()
  const roleOf = (edge: TreeEdge) => (focus ? edgeRole(edge, focus) : 'none')
  // Les liens mis en avant sont dessinés en dernier, donc par-dessus les autres.
  const edges = [...model.edges].sort((a, b) => ROLE_ORDER[roleOf(a)] - ROLE_ORDER[roleOf(b)])
  const amounts = new Map(
    focus ? model.edges.filter((edge) => edge.target === focus.id).map((edge) => [edge.source, amountText(edge)]) : [],
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel p-3">
      <div
        role="group"
        aria-label="Arbre des recettes, par étape"
        className="relative mx-auto"
        style={{ width: model.width, height: model.height }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClear()
        }}
      >
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0" width={model.width} height={model.height}>
          {edges.map((edge) => (
            <path
              key={edge.id}
              d={edge.path}
              fill="none"
              strokeDasharray={edge.relation === 'condition' ? undefined : '5 4'}
              className="transition-[opacity,stroke] duration-150"
              {...edgeStyle(roleOf(edge), focus !== null)}
            />
          ))}
        </svg>

        {model.columns.map((column) => (
          <div
            key={column.key}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 text-center"
            style={{ left: column.x, width: column.width }}
          >
            <p className="text-sm font-semibold">{column.title}</p>
            <p className="text-[11px] text-ink-muted">
              {column.count} {column.key === 'base' ? 'crops' : `mutation${column.count > 1 ? 's' : ''}`}
            </p>
          </div>
        ))}

        {model.nodes.map((node) => {
          const style = { position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height } as const
          if (node.kind === 'base') {
            return (
              <BaseCropChip
                key={node.id}
                name={node.id.slice('base:'.length)}
                dimmed={isDimmed(node.id, focus)}
                amount={amounts.get(node.id) ?? null}
                style={style}
              />
            )
          }
          const mutation = data.mutationsById.get(node.id)
          if (!mutation) return null
          return (
            <MutationTreeCard
              key={node.id}
              mutation={mutation}
              state={states.get(node.id) ?? 'locked'}
              owned={inventory[node.id] ?? 0}
              required={plan.needs.get(node.id)?.required ?? 0}
              step={model.columns[node.column]?.title}
              dimmed={isDimmed(node.id, focus)}
              active={focus?.id === node.id}
              amount={amounts.get(node.id) ?? null}
              style={style}
              buttonRef={triggerRef(node.id)}
              onOpen={() => onOpen(node.id)}
              onActivate={() => onActivate(node.id)}
              onDeactivate={() => onActivate(null)}
            />
          )
        })}
      </div>
    </div>
  )
}
