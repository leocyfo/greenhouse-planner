import { wikiImage } from '../../data/wikiImages'

interface McItemProps {
  readonly name: string
  /** Objet pâle (ex. aucun exemplaire en stock). */
  readonly dim?: boolean
}

/** Objet Minecraft dans une case : son image du wiki, ou ses initiales s'il n'en a pas. */
export function McItem({ name, dim = false }: McItemProps) {
  const src = wikiImage(name)
  if (!src) return <span className={`mc-c-f relative z-[1] text-sm${dim ? ' mc-dim' : ''}`}>{name.slice(0, 2)}</span>
  return <img src={src} alt="" draggable={false} className={`mc-icon${dim ? ' mc-dim' : ''}`} />
}
