/**
 * Codes de mise en forme de Minecraft dans un texte : §0 à §f pour la couleur, §l pour le gras,
 * §r pour revenir au style par défaut. Comme dans le jeu, une couleur annule le gras.
 */

export type McColor = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f'

export interface McSegment {
  readonly text: string
  readonly color: McColor
  readonly bold: boolean
}

const CODE = /§([0-9a-flr])/gi

export function parseMcText(text: string, defaultColor: McColor = 'f'): McSegment[] {
  const segments: McSegment[] = []
  let color = defaultColor
  let bold = false
  let last = 0
  for (const match of text.matchAll(CODE)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), color, bold })
    const code = (match[1] ?? 'r').toLowerCase()
    if (code === 'l') {
      bold = true
    } else if (code === 'r') {
      color = defaultColor
      bold = false
    } else {
      color = code as McColor
      bold = false
    }
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), color, bold })
  return segments
}

/** Le texte sans ses codes (noms accessibles, textes hors infobulle). */
export function plainMcText(text: string): string {
  return text.replace(CODE, '')
}
