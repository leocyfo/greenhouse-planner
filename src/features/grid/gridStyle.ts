/** Contour intérieur d'une case du plateau (crop posé, spawn possible, conflit). */
export function ringShadow(color: string): string {
  return `inset 0 0 0 2px ${color}`
}
