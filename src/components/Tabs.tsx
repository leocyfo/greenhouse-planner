import { useEffect, useRef, type KeyboardEvent } from 'react'
import { tabElementId, tabPanelId } from './tabIds'

interface TabItem<T extends string> {
  readonly id: T
  readonly label: string
}

interface TabsProps<T extends string> {
  readonly tabs: readonly TabItem<T>[]
  readonly selected: T
  readonly onSelect: (id: T) => void
  /** Préfixe des ids DOM, à réutiliser pour le panneau (voir tabIds.ts). */
  readonly idPrefix: string
  /** Nom accessible de la liste d'onglets. */
  readonly label: string
  readonly className?: string
  /** Onglets soulignés (par défaut) ou en pastilles (barre du haut). */
  readonly variant?: 'underline' | 'pills'
}

const TAB_CLASSES = {
  underline: {
    base: 'border-b-2 px-3 py-2.5',
    selected: 'border-accent text-ink',
    idle: 'border-transparent text-ink-muted hover:border-line hover:text-ink',
  },
  pills: {
    base: 'rounded-lg px-3 py-1.5',
    selected: 'bg-accent/15 font-semibold text-accent-strong',
    idle: 'text-ink-muted hover:bg-white/5 hover:text-ink',
  },
} as const

/**
 * Liste d'onglets accessible (motif ARIA « tabs ») : flèches gauche/droite, Début et Fin
 * pour naviguer au clavier. L'onglet actif est souligné (ou en pastille grasse), pas seulement
 * coloré.
 */
export function Tabs<T extends string>({
  tabs,
  selected,
  onSelect,
  idPrefix,
  label,
  className = '',
  variant = 'underline',
}: TabsProps<T>) {
  const style = TAB_CLASSES[variant]
  const list = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<T, HTMLButtonElement>())

  // Sur petit écran la barre défile : on garde l'onglet actif visible en faisant défiler la
  // barre elle-même. Pas de scrollIntoView : dans Chrome, il déplace aussi le point de départ
  // de la touche Tab, qui sauterait alors le lien d'évitement et les onglets au chargement.
  useEffect(() => {
    const container = list.current
    const button = buttons.current.get(selected)
    if (!container || !button) return
    const bar = container.getBoundingClientRect()
    const box = button.getBoundingClientRect()
    if (box.left < bar.left) container.scrollLeft -= bar.left - box.left
    else if (box.right > bar.right) container.scrollLeft += box.right - bar.right
  }, [selected])

  function focusTab(index: number) {
    const tab = tabs[index]
    if (!tab) return
    onSelect(tab.id)
    buttons.current.get(tab.id)?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1
    const target =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (target === null) return
    event.preventDefault()
    focusTab(target)
  }

  return (
    <div ref={list} role="tablist" aria-label={label} className={`flex gap-1 overflow-x-auto ${className}`}>
      {tabs.map((tab, index) => {
        const isSelected = tab.id === selected
        return (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) buttons.current.set(tab.id, element)
              else buttons.current.delete(tab.id)
            }}
            type="button"
            role="tab"
            id={tabElementId(idPrefix, tab.id)}
            aria-selected={isSelected}
            aria-controls={tabPanelId(idPrefix, tab.id)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`shrink-0 whitespace-nowrap text-sm font-medium transition-colors ${style.base} ${
              isSelected ? style.selected : style.idle
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
