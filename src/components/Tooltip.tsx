import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePopupPosition } from './usePopupPosition'

interface TooltipProps {
  /** Contenu du bouton déclencheur. */
  readonly label: ReactNode
  /** Nom accessible du déclencheur, si `label` ne suffit pas (icône seule…). */
  readonly ariaLabel?: string
  readonly content: ReactNode
  readonly className?: string
}

/**
 * Info-bulle accessible : s'ouvre au survol, au focus clavier ou au tap (mobile), se ferme
 * avec Échap ou en touchant ailleurs. Elle suit son déclencheur quand la page défile et reste
 * toujours à l'écran (voir usePopupPosition).
 */
export function Tooltip({ label, ariaLabel, content, className = '' }: TooltipProps) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const position = usePopupPosition(open, triggerRef, popupRef)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <span className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        className={`cursor-help ${className}`}
      >
        {label}
      </button>
      {/* Dans le body : une carte animée (transform) déplacerait une bulle fixe restée à l'intérieur. */}
      {open &&
        createPortal(
          <div
            ref={popupRef}
            id={id}
            role="tooltip"
            style={{ position: 'fixed', top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
            className="z-50 max-w-xs animate-tooltip-in rounded-lg border border-line bg-panel-raised px-3 py-2 text-left text-xs leading-relaxed text-ink shadow-xl shadow-black/40"
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  )
}
