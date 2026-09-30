import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeTypes,
  type ReactFlowProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo } from 'react'
import { formatRarity } from '../../components/labels'
import { getGameData } from '../../data'
import type { Inventory, Plan } from '../../logic/recipes'
import { EDGE_COLORS, FALLBACK_COLOR, rarityColor } from '../../theme/palette'
import { NODE_WIDTH, type GraphEdge, type GraphModel, type MutationState } from './graphModel'
import { BaseCropNode, ColumnLabelNode, MutationNode } from './nodes'
import { STATE_INFO } from './stateInfo'

const NODE_TYPES: NodeTypes = { mutation: MutationNode, baseCrop: BaseCropNode, columnLabel: ColumnLabelNode }

/** Textes d'accessibilité de React Flow, en français. */
const ARIA_LABELS: ReactFlowProps['ariaLabelConfig'] = {
  'node.a11yDescription.default': 'Appuie sur Entrée ou Espace pour ouvrir la fiche de cette mutation.',
  'node.a11yDescription.keyboardDisabled': 'Appuie sur Entrée ou Espace pour ouvrir la fiche de cette mutation.',
  'edge.a11yDescription.default': 'Lien entre un ingrédient et une recette.',
  'controls.ariaLabel': 'Contrôles du graphe',
  'controls.zoomIn.ariaLabel': 'Zoomer',
  'controls.zoomOut.ariaLabel': 'Dézoomer',
  'controls.fitView.ariaLabel': 'Tout afficher',
  'controls.interactive.ariaLabel': "Bloquer ou débloquer l'interaction",
  'minimap.ariaLabel': 'Mini-carte',
  'handle.ariaLabel': 'Point de liaison',
}

function edgeLabel(edge: GraphEdge): string {
  if (edge.relation === 'consumed') return `consomme ${edge.units}`
  if (edge.relation === 'catalyst') return `catalyseur ${edge.units}`
  return `× ${edge.units}${edge.cells !== edge.units ? ` (${edge.cells} cases)` : ''}`
}

export interface MutationGraphProps {
  readonly model: GraphModel
  readonly states: ReadonlyMap<string, MutationState>
  readonly plan: Plan
  readonly inventory: Inventory
  readonly selectedId: string | null
  readonly onSelect: (id: string | null) => void
  /** Demande de recentrage sur une mutation (nonce pour répéter la même demande). */
  readonly focusRequest: { readonly id: string; readonly nonce: number } | null
}

export function MutationGraph(props: MutationGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  )
}

function GraphCanvas({ model, states, plan, inventory, selectedId, onSelect, focusRequest }: MutationGraphProps) {
  const data = getGameData()
  const { setCenter } = useReactFlow()

  // Mutation sélectionnée, ses ingrédients et ce qu'elle permet de faire : le reste est estompé.
  const highlighted = useMemo(() => {
    if (!selectedId) return null
    const ids = new Set([selectedId])
    for (const edge of model.edges) {
      if (edge.target === selectedId) ids.add(edge.source)
      if (edge.source === selectedId) ids.add(edge.target)
    }
    return ids
  }, [model, selectedId])

  const nodes = useMemo<Node[]>(() => {
    const labels: Node[] = model.columns.map((column) => ({
      id: `column:${column.key}`,
      type: 'columnLabel',
      position: { x: column.x, y: model.labelY },
      data: { label: column.label, count: column.count, color: column.key === 'base' ? FALLBACK_COLOR : rarityColor(column.key) },
      selectable: false,
      draggable: false,
      focusable: false,
    }))
    const items: Node[] = model.nodes.map((node) => {
      const dimmed = highlighted !== null && !highlighted.has(node.id)
      if (node.kind === 'base') {
        return {
          id: node.id,
          type: 'baseCrop',
          position: { x: node.x + 20, y: node.y + 10 },
          data: { name: node.id.slice('base:'.length), dimmed },
          selectable: false,
          focusable: false,
        }
      }
      const mutation = data.mutationsById.get(node.id)
      const state = states.get(node.id) ?? 'locked'
      const owned = inventory[node.id] ?? 0
      const required = plan.needs.get(node.id)?.required ?? 0
      return {
        id: node.id,
        type: 'mutation',
        position: { x: node.x, y: node.y },
        selected: node.id === selectedId,
        ariaLabel: `${mutation?.name ?? node.id}, ${formatRarity(mutation?.rarity ?? '')}, ${STATE_INFO[state].label}`,
        data: {
          name: mutation?.name ?? node.id,
          rarityColor: rarityColor(mutation?.rarity ?? ''),
          state,
          owned,
          required,
          dimmed,
        },
      }
    })
    return [...labels, ...items]
  }, [model, states, plan, inventory, selectedId, highlighted, data])

  const edges = useMemo<Edge[]>(
    () =>
      model.edges.map((edge) => {
        const connected = selectedId !== null && (edge.source === selectedId || edge.target === selectedId)
        const color = connected ? EDGE_COLORS.highlighted : EDGE_COLORS.normal
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          animated: connected,
          selectable: false,
          focusable: false,
          zIndex: connected ? 1 : 0,
          style: {
            stroke: color,
            strokeWidth: connected ? 2 : 1,
            strokeDasharray: edge.relation === 'condition' ? undefined : '5 4',
            opacity: selectedId !== null && !connected ? 0.2 : 1,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
          label: connected ? edgeLabel(edge) : undefined,
          labelStyle: { fill: '#e7e9ee', fontSize: 11 },
          labelBgStyle: { fill: '#161920' },
          labelBgPadding: [4, 2],
        }
      }),
    [model, selectedId],
  )

  // Recentrage demandé depuis « Aller à une mutation » ou la fiche.
  useEffect(() => {
    if (!focusRequest) return
    const node = model.nodes.find((n) => n.id === focusRequest.id)
    if (node) void setCenter(node.x + NODE_WIDTH / 2, node.y + 26, { zoom: 1.1, duration: 400 })
  }, [focusRequest, model, setCenter])

  // Sélection à la souris comme au clavier (Entrée ou Espace sur un nœud).
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'select' && change.selected && data.mutationsById.has(change.id)) {
          onSelect(change.id)
          return
        }
      }
    },
    [data, onSelect],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodesChange={onNodesChange}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.08 }}
      minZoom={0.2}
      maxZoom={2}
      colorMode="dark"
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      ariaLabelConfig={ARIA_LABELS}
    >
      <Background gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
