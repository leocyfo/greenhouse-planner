/** Nœuds personnalisés du graphe (React Flow). */
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { CSSProperties } from 'react'
import { WikiIcon } from '../../components/game/WikiIcon'
import { NODE_WIDTH, type MutationState } from './graphModel'
import { STATE_INFO } from './stateInfo'

// Points d'accroche invisibles : on ne relie pas les nœuds à la main.
const HANDLE_STYLE: CSSProperties = { width: 6, height: 6, background: 'transparent', border: 0 }

export type MutationNodeData = {
  readonly name: string
  readonly rarityColor: string
  readonly state: MutationState
  readonly owned: number
  readonly required: number
  readonly dimmed: boolean
}
export type MutationFlowNode = Node<MutationNodeData, 'mutation'>

export function MutationNode({ data, selected }: NodeProps<MutationFlowNode>) {
  const info = STATE_INFO[data.state]
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 text-xs shadow-md transition duration-150 hover:shadow-lg hover:shadow-black/50 hover:brightness-125 ${data.dimmed ? 'opacity-30' : ''} ${selected ? 'ring-2 ring-ink' : ''}`}
      // Couleurs de bordure côté par côté : le raccourci borderColor écraserait la bande de rareté
      // à chaque changement d'état (React ne réapplique pas borderLeftColor, qui n'a pas changé).
      style={{
        width: NODE_WIDTH,
        borderTopColor: info.color,
        borderRightColor: info.color,
        borderBottomColor: info.color,
        borderLeftColor: data.rarityColor,
        borderLeftWidth: 5,
        background: `color-mix(in srgb, ${info.color} 14%, var(--color-panel))`,
      }}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} style={HANDLE_STYLE} />
      <div className="flex items-center gap-2">
        <WikiIcon name={data.name} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate font-semibold" style={{ color: data.rarityColor }}>
              {data.name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] text-ink-muted">
            <span>
              <span aria-hidden="true">{info.icon}</span> {info.label}
            </span>
            <span className="tabular-nums">
              {data.owned}
              {data.required > 0 ? ` / ${data.required}` : ''}
            </span>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} style={HANDLE_STYLE} />
    </div>
  )
}

export type BaseCropNodeData = { readonly name: string; readonly dimmed: boolean }
export type BaseCropFlowNode = Node<BaseCropNodeData, 'baseCrop'>

export function BaseCropNode({ data }: NodeProps<BaseCropFlowNode>) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border border-line bg-panel-raised px-3 py-1 text-xs text-ink-muted transition-opacity ${data.dimmed ? 'opacity-30' : ''}`}
      style={{ width: NODE_WIDTH - 40 }}
    >
      <WikiIcon name={data.name} size={16} />
      {data.name}
      <Handle type="source" position={Position.Right} isConnectable={false} style={HANDLE_STYLE} />
    </div>
  )
}

export type ColumnLabelNodeData = { readonly label: string; readonly count: number; readonly color: string }
export type ColumnLabelFlowNode = Node<ColumnLabelNodeData, 'columnLabel'>

export function ColumnLabelNode({ data }: NodeProps<ColumnLabelFlowNode>) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold" style={{ width: NODE_WIDTH }}>
      <span aria-hidden="true" className="size-3 rounded-sm" style={{ background: data.color }} />
      {data.label}
      <span className="font-normal text-ink-muted">· {data.count}</span>
    </div>
  )
}
