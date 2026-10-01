import { useLayoutEffect, useState } from 'react'

/**
 * Largeur du contenu d'un élément (sans ses marges intérieures), mesurée avant le premier affichage
 * puis à chaque changement de taille. null tant qu'elle n'est pas connue.
 *
 * Renvoie une ref à poser sur l'élément : s'il est retiré puis remis (objectif sans arbre, puis un
 * autre), la mesure suit le nouvel élément. Un élément retiré de la page ne se mesure pas (sa largeur
 * vaudrait NaN et toutes les cartes de l'arbre se retrouveraient à gauche).
 */
export function useContentWidth(): readonly [(element: HTMLElement | null) => void, number | null] {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!node) return
    const measure = () => {
      if (!node.isConnected) return
      const style = getComputedStyle(node)
      const next = Math.floor(node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))
      if (Number.isFinite(next)) setWidth(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return [setNode, width]
}
