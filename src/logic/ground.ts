/**
 * Sol d'une case de la grille : le nom d'une surface du JSON (Dirt, Sand…), ou l'un des
 * deux états spéciaux ci-dessous. Les « # » évitent toute confusion avec un nom de surface.
 */

/** Bloc cassé (douve du Devourer) : rien ne peut y pousser ni y être posé. */
export const BROKEN_GROUND = '#broken'

/** Case pas encore débloquée (greenhouse 1 : 12 cases au départ, puis 1 Ethereal Vine par case). */
export const LOCKED_GROUND = '#locked'

export function isUsableGround(ground: string): boolean {
  return ground !== BROKEN_GROUND && ground !== LOCKED_GROUND
}
