import { useEffect, useId, useRef, useState } from 'react'

export interface MenuAction {
  readonly label: string
  readonly onSelect: () => void
  /** Action destructrice (supprimer…) : en rouge. */
  readonly danger?: boolean
}

/**
 * Bouton « ⋯ » qui ouvre une petite liste d'actions (bouton de divulgation : la liste suit le
 * bouton dans l'ordre du clavier). Fermée par Échap, un clic en dehors ou après une action.
 */
export function ActionMenu({ label, actions }: { readonly label: string; readonly actions: readonly MenuAction[] }) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink aria-expanded:bg-panel-raised aria-expanded:text-ink"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ⋯
        </span>
      </button>
      {open && (
        <ul
          id={listId}
          className="absolute top-full left-0 z-30 mt-1 min-w-44 animate-fade-up rounded-xl border border-line bg-panel-solid p-1 shadow-xl shadow-black/40"
        >
          {actions.map((action) => (
            <li key={action.label}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  action.onSelect()
                }}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-panel-raised ${
                  action.danger ? 'text-danger' : 'text-ink'
                }`}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
