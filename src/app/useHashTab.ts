import { useCallback, useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function readHash(): string {
  return window.location.hash
}

/**
 * Onglet courant stocké dans l'URL (#/inventaire) : le lien est partageable, le bouton
 * « retour » du navigateur fonctionne, et aucun routeur n'est nécessaire sur GitHub Pages.
 */
export function useHashTab<T extends string>(ids: readonly T[], fallback: T): [T, (id: T) => void] {
  const hash = useSyncExternalStore(subscribe, readHash)
  const requested = hash.replace(/^#\/?/, '')
  const current = ids.find((id) => id === requested) ?? fallback

  const select = useCallback((id: T) => {
    window.location.hash = `/${id}`
  }, [])

  return [current, select]
}
