import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Largeur du contenu d'un élément (sans ses marges intérieures), mesurée avant le premier affichage
 * puis à chaque changement de taille. null tant qu'elle n'est pas connue.
 */
export function useContentWidth(element: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const node = element.current
    if (!node) return
    const measure = () => {
      const style = getComputedStyle(node)
      setWidth(Math.floor(node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [element])
  return width
}
