import { useId, useRef, type FocusEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { wikiImage } from '../../data/wikiImages'
import { usePopupPosition } from '../usePopupPosition'
import { hideTooltip, showTooltip, useTooltipShown } from './activeTooltip'
import { stackCountLabel } from './mcFormat'
import { McText } from './McText'

/** Couleur de la vitre (stained glass pane) qui remplit la case. */
export type PaneColor = 'gray' | 'lime' | 'yellow' | 'red'

/** Objet Minecraft de chaque vitre : sa texture vient du wiki (couleur CSS à défaut). */
const PANE_ITEM: Record<PaneColor, string> = {
  gray: 'Gray Stained Glass Pane',
  lime: 'Lime Stained Glass Pane',
  yellow: 'Yellow Stained Glass Pane',
  red: 'Red Stained Glass Pane',
}

function Pane({ color }: { readonly color: PaneColor }) {
  const src = wikiImage(PANE_ITEM[color])
  return src ? <img src={src} alt="" draggable={false} className="mc-pane-img" /> : <span className={`mc-pane mc-pane--${color}`} />
}

interface McSlotProps {
  readonly pane?: PaneColor
  readonly icon?: ReactNode
  /** Nombre affiché en bas à droite, comme la taille d'une pile d'objets (abrégé dès 1000). */
  readonly count?: number
  /** Plus petit nombre affiché : 2 comme dans le jeu (une pile de 1 n'a pas de chiffre), ou 1. */
  readonly countFrom?: number
  /** Marque en haut à gauche (ex. ✓). */
  readonly badge?: ReactNode
  /** Reflet violet des objets enchantés. */
  readonly glint?: boolean
  /** Case assombrie (ne correspond pas aux filtres). */
  readonly muted?: boolean
  /** Lignes de l'infobulle, avec codes couleur Minecraft ; une chaîne vide = ligne vide. */
  readonly tooltip?: readonly string[]
  /** Nom accessible (case cliquable, ou case d'information avec infobulle). */
  readonly label?: string
  /** Sans action, la case est décorative, ou une simple information si elle a une infobulle. */
  readonly onClick?: () => void
  readonly onButtonRef?: (element: HTMLButtonElement | null) => void
}

/**
 * Case d'inventaire Minecraft. Cliquable, c'est un bouton ; avec une infobulle mais sans action,
 * une information atteignable au clavier. L'infobulle s'ouvre au survol ou au focus clavier (pas
 * au tap : sur mobile, les mêmes infos sont données ailleurs), une seule à la fois.
 */
export function McSlot({
  pane,
  icon,
  count,
  countFrom = 2,
  badge,
  glint = false,
  muted = false,
  tooltip,
  label,
  onClick,
  onButtonRef,
}: McSlotProps) {
  const id = useId()
  const triggerRef = useRef<HTMLElement | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const open = useTooltipShown(id)
  const position = usePopupPosition(open, triggerRef, popupRef, 'right')

  const content = (
    <>
      {pane && <Pane color={pane} />}
      {icon}
      {glint && <span aria-hidden="true" className="mc-glint" />}
      {badge && (
        <span aria-hidden="true" className="mc-badge animate-pop">
          {badge}
        </span>
      )}
      {count !== undefined && count >= countFrom && (
        <span key={count} className="mc-count animate-bump">
          {stackCountLabel(count)}
        </span>
      )}
    </>
  )
  const className = `mc-slot${muted ? ' mc-muted' : ''}`
  if (!onClick && !tooltip) {
    return (
      <div className={className} aria-hidden="true">
        {content}
      </div>
    )
  }

  const showOnKeyboardFocus = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.matches(':focus-visible')) showTooltip('focus', id)
  }
  const triggerProps = {
    'aria-describedby': open && tooltip ? id : undefined,
    onMouseEnter: () => showTooltip('hover', id),
    onMouseLeave: () => hideTooltip('hover', id),
    onFocus: showOnKeyboardFocus,
    onBlur: () => hideTooltip('focus', id),
    className,
  }

  return (
    <>
      {onClick ? (
        <button
          ref={(element) => {
            triggerRef.current = element
            onButtonRef?.(element)
          }}
          type="button"
          aria-label={label}
          onClick={onClick}
          {...triggerProps}
        >
          {content}
        </button>
      ) : (
        <div
          ref={(element) => {
            triggerRef.current = element
          }}
          role="img"
          aria-label={label}
          tabIndex={0}
          {...triggerProps}
        >
          {content}
        </div>
      )}
      {/* Hors de la fenêtre : l'infobulle garde sa taille quelle que soit l'échelle de la fenêtre. */}
      {open &&
        tooltip &&
        createPortal(
          <div
            ref={popupRef}
            id={id}
            role="tooltip"
            style={{
              position: 'fixed',
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }}
            className="mc-tooltip animate-tooltip-in"
          >
            {tooltip.map((line, index) => (
              <p key={index}>{line ? <McText text={line} defaultColor="7" /> : ' '}</p>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
