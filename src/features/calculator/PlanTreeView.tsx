import { useMemo, useState } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { Tooltip } from '../../components/Tooltip'
import { getGameData } from '../../data'
import { planTreeKeys, type PlanTreeNode } from '../../logic/recipes'
import { cropName } from '../../components/game/recipeText'

/** Rôle et quantité d'un nœud pour son parent. */
function relationText(node: PlanTreeNode): string {
  switch (node.relation) {
    case 'target':
      return `cible × ${node.quantity}`
    case 'condition':
      return `× ${node.quantity} à poser${node.cells > node.quantity ? ` (${node.cells} cases)` : ''}`
    case 'consumed':
      return `× ${node.quantity} consommé${node.quantity > 1 ? 's' : ''}`
    case 'catalyst':
      return `× ${node.quantity} (catalyseur)`
  }
}

function NodeStatus({ node }: { readonly node: PlanTreeNode }) {
  if (node.crop.kind === 'base') return <span className="text-xs text-ink-muted">crop de base</span>
  const need = node.need
  if (!need) return null
  const mutation = getGameData().mutationsById.get(node.crop.id)
  const special = mutation && mutation.conditions.length === 0 ? mutation.specialCondition : null
  return (
    <>
      {need.missing > 0 ? (
        <span className="text-xs text-ink-muted">
          {need.buy ? 'à acheter au bazar' : 'total à obtenir'} : <span className="tabular-nums text-ink">{need.missing}</span>
        </span>
      ) : (
        <span className="text-xs text-accent-strong">✓ en stock ({need.owned})</span>
      )}
      {special && need.missing > 0 && !need.buy && (
        <Tooltip
          label="condition spéciale"
          content={special}
          className="rounded-md border border-line px-1.5 text-xs text-ink-muted underline decoration-dotted underline-offset-2"
        />
      )}
    </>
  )
}

interface TreeItemProps {
  readonly node: PlanTreeNode
  readonly depth: number
  readonly isOpen: (node: PlanTreeNode, depth: number) => boolean
  readonly onToggle: (node: PlanTreeNode, depth: number) => void
}

function TreeItem({ node, depth, isOpen, onToggle }: TreeItemProps) {
  const open = isOpen(node, depth)
  const hasChildren = node.children.length > 0
  const name = cropName(getGameData(), node.crop)
  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md py-0.5 pr-1 hover:bg-panel-raised/60">
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => onToggle(node, depth)}
            className="flex size-6 items-center justify-center rounded text-ink-muted hover:text-ink"
          >
            <span aria-hidden="true" className={`inline-block transition-transform ${open ? '' : '-rotate-90'}`}>
              ▾
            </span>
            <span className="sr-only">
              {open ? 'Replier' : 'Déplier'} {name}
            </span>
          </button>
        ) : (
          <span aria-hidden="true" className="size-6" />
        )}
        <CropLabel crop={node.crop} />
        <span className="text-xs text-ink-muted">{relationText(node)}</span>
        <NodeStatus node={node} />
      </div>
      {hasChildren && open && (
        <ul className="ml-3 animate-fade-up border-l border-line pl-2">
          {node.children.map((childNode) => (
            <TreeItem key={childNode.key} node={childNode} depth={depth + 1} isOpen={isOpen} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Arbre dépliable des besoins. Les cibles sont dépliées d'office ; chaque recette est répétée
 * sous chacun de ses parents, avec la quantité à poser pour ce parent.
 */
export function PlanTreeView({ tree }: { readonly tree: readonly PlanTreeNode[] }) {
  // Nœuds ouverts ou fermés à la main ; les racines sont ouvertes par défaut.
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set())
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set())
  const allKeys = useMemo(() => planTreeKeys(tree), [tree])

  const isOpen = (node: PlanTreeNode, depth: number) =>
    opened.has(node.key) || (depth === 0 && !closed.has(node.key))

  const toggle = (node: PlanTreeNode, depth: number) => {
    const open = isOpen(node, depth)
    setOpened((keys) => {
      const next = new Set(keys)
      if (open) next.delete(node.key)
      else next.add(node.key)
      return next
    })
    setClosed((keys) => {
      const next = new Set(keys)
      if (open) next.add(node.key)
      else next.delete(node.key)
      return next
    })
  }

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpened(new Set(allKeys))
            setClosed(new Set())
          }}
          className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-muted hover:text-ink"
        >
          Tout déplier
        </button>
        <button
          type="button"
          onClick={() => {
            setOpened(new Set())
            setClosed(new Set(tree.map((node) => node.key)))
          }}
          className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-muted hover:text-ink"
        >
          Tout replier
        </button>
      </div>
      <ul className="text-sm">
        {tree.map((node) => (
          <TreeItem key={node.key} node={node} depth={0} isOpen={isOpen} onToggle={toggle} />
        ))}
      </ul>
    </div>
  )
}
