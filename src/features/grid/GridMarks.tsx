/** Petits symboles de la grille, partagés par le plateau et la légende (sans texte). */
import { GRID_COLORS } from '../../theme/palette'

export type EffectTone = 'positive' | 'negative' | 'mixed'
export type WaterTone = 'ok' | 'short'

const EFFECT_COLOR: Record<EffectTone, string> = {
  positive: GRID_COLORS.effectPositive,
  negative: GRID_COLORS.effectNegative,
  mixed: GRID_COLORS.effectMixed,
}

/** Pastille des effets reçus : verte (positifs), rouge (négatifs), jaune (les deux). */
export function EffectDot({ tone, className = '' }: { readonly tone: EffectTone; readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 rounded-full ring-1 ring-black/60 ${className}`}
      style={{ background: EFFECT_COLOR[tone] }}
    />
  )
}

/** Goutte d'eau : bleue si l'eau tient jusqu'à la récolte, rouge si le crop sera à sec avant. */
export function WaterDrop({ tone, className = '' }: { readonly tone: WaterTone; readonly className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 10 12" className={`inline-block h-3 w-2.5 ${className}`}>
      <path
        d="M5 0.5 C5 0.5 1 5.2 1 7.8 A4 4 0 0 0 9 7.8 C9 5.2 5 0.5 5 0.5 Z"
        fill={tone === 'ok' ? GRID_COLORS.waterOk : GRID_COLORS.waterShort}
        stroke="rgb(0 0 0 / 0.6)"
        strokeWidth="0.8"
      />
    </svg>
  )
}
