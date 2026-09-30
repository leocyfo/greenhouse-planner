// Police pixel du style Minecraft, chargée seulement là où une fenêtre Minecraft s'affiche.
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/700.css'
import { useId, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { McSlot } from './McSlot'

export const MC_COLUMNS = 9

interface McWindowProps {
  readonly title: string
  readonly rows: number
  /** Contenu des cases par index (rangée × 9 + colonne) ; les autres reçoivent une vitre grise. */
  readonly slots: ReadonlyMap<number, ReactNode>
  readonly onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  /** Agrandit la fenêtre à toute la largeur disponible, sans dépasser la hauteur de l'écran. */
  readonly fit?: boolean
}

/** Fenêtre de coffre Minecraft : titre et grille de cases de 9 colonnes. */
export function McWindow({ title, rows, slots, onKeyDown, fit = false }: McWindowProps) {
  const titleId = useId()
  const frame = (
    <div
      role="group"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className={`mc mc-window${fit ? ' mc-window--fit' : ''}`}
      // Nombre de rangées, pour que l'échelle tienne dans la hauteur de l'écran (index.css).
      style={fit ? ({ '--mc-rows': rows } as CSSProperties) : undefined}
    >
      <p id={titleId} className="mc-title">
        {title}
      </p>
      <div className="mc-grid">
        {Array.from({ length: rows * MC_COLUMNS }, (_, index) => (
          <div key={index}>{slots.get(index) ?? <McSlot pane="gray" />}</div>
        ))}
      </div>
    </div>
  )
  return fit ? <div className="mc-fit">{frame}</div> : frame
}
