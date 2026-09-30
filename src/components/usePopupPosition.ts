import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react'

const MARGIN = 8

/** Où placer la bulle : sous le déclencheur, ou à sa droite (comme les infobulles Minecraft). */
export type PopupSide = 'below' | 'right'

export interface PopupPosition {
  readonly top: number
  readonly left: number
}

/**
 * Position fixe d'une bulle ouverte près de son déclencheur. Elle bascule de l'autre côté s'il
 * manque de place (au-dessus, ou à gauche), ne sort jamais de l'écran et suit le défilement de
 * la page (sur mobile, un tap fait souvent défiler légèrement).
 */
export function usePopupPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  popupRef: RefObject<HTMLElement | null>,
  side: PopupSide = 'below',
): PopupPosition | null {
  const [position, setPosition] = useState<PopupPosition | null>(null)

  const update = useCallback(() => {
    const trigger = triggerRef.current
    const popup = popupRef.current
    if (!trigger || !popup) return
    const t = trigger.getBoundingClientRect()
    const p = popup.getBoundingClientRect()
    const clampLeft = (left: number) => Math.min(Math.max(MARGIN, left), Math.max(MARGIN, window.innerWidth - MARGIN - p.width))
    if (side === 'right') {
      const right = t.right + MARGIN
      const left = right + p.width <= window.innerWidth - MARGIN ? right : t.left - MARGIN - p.width
      const top = Math.min(Math.max(MARGIN, t.top - 4), Math.max(MARGIN, window.innerHeight - MARGIN - p.height))
      setPosition({ top, left: clampLeft(left) })
      return
    }
    let top = t.bottom + 6
    if (top + p.height > window.innerHeight - MARGIN) top = Math.max(MARGIN, t.top - 6 - p.height)
    setPosition({ top, left: clampLeft(t.left + t.width / 2 - p.width / 2) })
  }, [triggerRef, popupRef, side])

  useLayoutEffect(() => {
    if (open) update()
  }, [open, update])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, update])

  return position
}
