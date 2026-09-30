/** Cartes de l'arbre des recettes : une mutation (bouton qui ouvre sa fiche) ou un crop de base. */
import type { CSSProperties } from 'react'
import { WikiIcon } from '../../components/game/WikiIcon'
import { formatRarity } from '../../components/labels'
import { rarityColor, TREE_COLORS } from '../../theme/palette'
import type { Mutation } from '../../types/game'
import type { MutationState } from './graphModel'
import { STATE_INFO } from './stateInfo'

/** Quantité affichée sur une carte : son texte (« ×6 ») et, s'il y a lieu, son explication. */
export interface CardAmount {
  readonly text: string
  readonly title?: string
}

/** Quantité de l'ingrédient (recette mise en avant, ou total du chemin), à la couleur du chemin. */
function AmountPill({ amount }: { readonly amount: CardAmount }) {
  return (
    <span
      title={amount.title}
      className="shrink-0 animate-pop rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
      style={{ color: TREE_COLORS.path, background: `color-mix(in srgb, ${TREE_COLORS.path} 16%, transparent)` }}
    >
      {amount.text}
    </span>
  )
}

interface MutationTreeCardProps {
  readonly mutation: Mutation
  readonly state: MutationState
  readonly owned: number
  readonly required: number
  /** Étape de la mutation (« Étape 2 »), pour le nom accessible. */
  readonly step?: string
  readonly dimmed?: boolean
  /** Mise en avant (survol, focus clavier). */
  readonly active?: boolean
  /** Mutation choisie : l'arbre ne garde que ce qu'il faut pour la faire. */
  readonly selected?: boolean
  readonly amount?: CardAmount | null
  /** Ce que fait le clic, pour le nom accessible (« Ouvrir la fiche » par défaut). */
  readonly actionLabel?: string
  readonly style?: CSSProperties
  readonly buttonRef?: (element: HTMLElement | null) => void
  readonly onOpen: () => void
  /** Survol ou focus clavier : met la mutation en avant. */
  readonly onActivate?: () => void
  readonly onDeactivate?: () => void
}

export function MutationTreeCard({
  mutation,
  state,
  owned,
  required,
  step,
  dimmed = false,
  active = false,
  selected = false,
  amount = null,
  actionLabel = 'Ouvrir la fiche',
  style,
  buttonRef,
  onOpen,
  onActivate,
  onDeactivate,
}: MutationTreeCardProps) {
  const info = STATE_INFO[state]
  const color = rarityColor(mutation.rarity)
  const stock = `${owned}${required > 0 ? ` / ${required}` : ''}`
  const label = [
    mutation.name,
    formatRarity(mutation.rarity),
    step,
    info.label,
    `${owned} en stock${required > 0 ? ` sur ${required} demandés` : ''}`,
    amount ? (amount.title ?? `${amount.text} dans la recette`) : undefined,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <button
      ref={buttonRef}
      id={`arbre-${mutation.id}`}
      type="button"
      aria-label={`${label}. ${actionLabel}.`}
      onClick={onOpen}
      onPointerEnter={onActivate}
      onPointerLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className={`flex items-center gap-2 rounded-lg border px-2 text-left shadow-sm shadow-black/30 transition duration-150 hover:brightness-125 motion-safe:active:scale-[0.97] ${dimmed ? 'opacity-25' : ''} ${selected ? 'shadow-lg ring-2 ring-accent' : active ? 'shadow-lg ring-2 ring-ink/70' : ''}`}
      // Bordures côté par côté : le raccourci borderColor écraserait la bande de rareté à chaque
      // changement d'état (React ne réapplique pas borderLeftColor, qui n'a pas changé).
      style={{
        ...style,
        borderTopColor: `color-mix(in srgb, ${info.color} 55%, transparent)`,
        borderRightColor: `color-mix(in srgb, ${info.color} 55%, transparent)`,
        borderBottomColor: `color-mix(in srgb, ${info.color} 55%, transparent)`,
        borderLeftColor: color,
        borderLeftWidth: 4,
        background: `color-mix(in srgb, ${info.color} 12%, var(--color-panel-solid))`,
      }}
    >
      <WikiIcon name={mutation.name} size={28} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-semibold" style={{ color }}>
          {mutation.name}
        </span>
        <span className="block text-[11px] text-ink-muted tabular-nums">
          <span aria-hidden="true">{info.icon}</span> {stock}
        </span>
      </span>
      {amount && <AmountPill amount={amount} />}
    </button>
  )
}

interface BaseCropChipProps {
  readonly name: string
  readonly dimmed: boolean
  readonly amount: CardAmount | null
  readonly style: CSSProperties
}

export function BaseCropChip({ name, dimmed, amount, style }: BaseCropChipProps) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border border-line bg-panel-raised pr-1 pl-2.5 text-xs text-ink-muted transition-opacity duration-150 ${dimmed ? 'opacity-25' : ''}`}
      style={style}
    >
      <WikiIcon name={name} size={16} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {amount && <AmountPill amount={amount} />}
    </div>
  )
}
