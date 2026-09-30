import { getGameData } from '../../data'
import { rarityColor } from '../../theme/palette'
import type { CropRef } from '../../types/game'
import { WikiIcon } from './WikiIcon'

interface CropLabelProps {
  readonly crop: CropRef
  /** Image du wiki devant le nom (à la taille du texte). */
  readonly icon?: boolean
}

/** Nom d'un crop : mutation dans la couleur de sa rareté, crop de base en couleur neutre. */
export function CropLabel({ crop, icon = true }: CropLabelProps) {
  const mutation = crop.kind === 'mutation' ? getGameData().mutationsById.get(crop.id) : undefined
  const name = crop.kind === 'base' ? crop.name : (mutation?.name ?? crop.id)
  return (
    <span
      className={`inline-flex items-center gap-1.5 align-middle ${crop.kind === 'base' ? 'text-ink' : 'font-medium'}`}
      style={{ color: mutation ? rarityColor(mutation.rarity) : undefined }}
    >
      {icon && <WikiIcon name={name} className="size-[1.3em]" />}
      {name}
    </span>
  )
}
