import { parseMcText, type McColor } from './mcFormat'

interface McTextProps {
  /** Texte avec codes Minecraft (§a, §7, §l…). */
  readonly text: string
  readonly defaultColor?: McColor
}

/** Texte coloré à la manière de Minecraft, avec l'ombre portée du jeu. */
export function McText({ text, defaultColor = 'f' }: McTextProps) {
  return (
    <>
      {parseMcText(text, defaultColor).map((segment, index) => (
        <span key={index} className={`mc-c-${segment.color}${segment.bold ? ' font-bold' : ''}`}>
          {segment.text}
        </span>
      ))}
    </>
  )
}
