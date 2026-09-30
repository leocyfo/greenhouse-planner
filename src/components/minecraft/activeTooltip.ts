import { useEffect, useSyncExternalStore } from 'react'

/** Ce qui ouvre une infobulle : la souris sur la case, ou le focus clavier. */
export type TooltipSource = 'hover' | 'focus'

const owners: Record<TooltipSource, string | null> = { hover: null, focus: null }
const mounted = new Set<string>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}

const isOwner = (id: string) => owners.hover === id || owners.focus === id

function setOwner(source: TooltipSource, owner: string | null) {
  if (owners[source] === owner) return
  owners[source] = owner
  notify()
}

/** Une case démontée (changement de menu, sans mouseleave) ne compte plus, sans rien effacer. */
const live = (owner: string | null) => (owner !== null && mounted.has(owner) ? owner : null)

/**
 * Une seule infobulle Minecraft à la fois, comme dans le jeu : la case survolée passe devant
 * celle qui a le focus clavier, qui retrouve la sienne quand la souris s'en va.
 */
export function currentTooltip(): string | null {
  return live(owners.hover) ?? live(owners.focus)
}

export function showTooltip(source: TooltipSource, id: string) {
  setOwner(source, id)
}

/** Ne ferme que l'infobulle de cette case : une autre a pu prendre la place entre-temps. */
export function hideTooltip(source: TooltipSource, id: string) {
  if (owners[source] === id) setOwner(source, null)
}

/** Déclare une case affichée ; renvoie de quoi la retirer. */
export function registerTooltip(id: string): () => void {
  mounted.add(id)
  if (isOwner(id)) notify()
  return () => {
    mounted.delete(id)
    if (isOwner(id)) notify()
  }
}

/** Vrai si l'infobulle de la case `id` est celle qui s'affiche. */
export function useTooltipShown(id: string): boolean {
  useEffect(() => registerTooltip(id), [id])
  return useSyncExternalStore(subscribe, () => currentTooltip() === id)
}
