import { wikiImage } from '../../data/wikiImages'

interface WikiIconProps {
  /** Nom affiché de la mutation, du crop ou de l'objet. */
  readonly name: string
  /** Côté en pixels. */
  readonly size?: number
  /** Texte alternatif ; vide par défaut, car le nom est presque toujours écrit à côté. */
  readonly alt?: string
  readonly className?: string
}

/** Image du wiki (crédits en bas de page) ; rien si le wiki n'en a pas. */
export function WikiIcon({ name, size = 20, alt = '', className = '' }: WikiIconProps) {
  const src = wikiImage(name)
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`inline-block shrink-0 object-contain ${className}`}
    />
  )
}
