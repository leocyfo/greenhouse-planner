import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  /** Fermeture par un clic à côté ; Échap est géré par le contenu. */
  readonly onClose: () => void
  /** Le contenu porte role="dialog", aria-modal et son titre (aria-labelledby). */
  readonly children: ReactNode
  /** Largeur maximale de la fenêtre (classe Tailwind). */
  readonly width?: string
}

/**
 * Petite fenêtre au-dessus de la page : fond assombri, fenêtre centrée (en bas sur mobile).
 * Tab reste dans la fenêtre et la page derrière ne défile pas.
 */
export function Modal({ onClose, children, width = 'max-w-xl' }: ModalProps) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !box.current) return
      const focusable = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      const index = focusable.indexOf(document.activeElement as HTMLElement)
      if (event.shiftKey && index <= 0) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && index === focusable.length - 1) {
        event.preventDefault()
        first.focus()
      }
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 animate-fade-in bg-black/65" onClick={onClose} />
      <div ref={box} className={`relative w-full animate-pop-in ${width}`}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
