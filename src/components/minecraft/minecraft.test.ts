import { describe, expect, it } from 'vitest'
import { currentTooltip, hideTooltip, registerTooltip, showTooltip } from './activeTooltip'
import { parseMcText, plainMcText, stackCountLabel } from './mcFormat'

describe('Minecraft : une seule infobulle à la fois', () => {
  it('fait passer la case survolée devant le focus clavier, qui revient quand la souris part', () => {
    const unmount = [registerTooltip('a'), registerTooltip('b')]
    showTooltip('focus', 'a')
    expect(currentTooltip()).toBe('a')
    showTooltip('hover', 'b')
    expect(currentTooltip()).toBe('b')
    hideTooltip('hover', 'b')
    expect(currentTooltip()).toBe('a')
    hideTooltip('focus', 'a')
    expect(currentTooltip()).toBeNull()
    unmount.forEach((off) => off())
  })

  it("ne ferme pas l'infobulle d'une autre case", () => {
    const unmount = [registerTooltip('a'), registerTooltip('b')]
    showTooltip('hover', 'a')
    showTooltip('hover', 'b')
    hideTooltip('hover', 'a')
    expect(currentTooltip()).toBe('b')
    hideTooltip('hover', 'b')
    expect(currentTooltip()).toBeNull()
    unmount.forEach((off) => off())
  })

  it('ignore une case démontée sans mouseleave, et la reprend si elle revient (StrictMode)', () => {
    const offFocus = registerTooltip('focus')
    const offGone = registerTooltip('gone')
    showTooltip('focus', 'focus')
    showTooltip('hover', 'gone')
    offGone()
    expect(currentTooltip()).toBe('focus')
    offFocus()
    expect(currentTooltip()).toBeNull()
    const offAgain = registerTooltip('focus')
    expect(currentTooltip()).toBe('focus')
    offAgain()
    hideTooltip('focus', 'focus')
    hideTooltip('hover', 'gone')
  })
})

describe('Minecraft : codes couleur', () => {
  it('découpe le texte selon les codes §, une couleur annulant le gras', () => {
    expect(parseMcText('§aPlot Limit§7 : §l+2', '7')).toEqual([
      { text: 'Plot Limit', color: 'a', bold: false },
      { text: ' : ', color: '7', bold: false },
      { text: '+2', color: '7', bold: true },
    ])
    expect(parseMcText('§e§lPROCHAIN§r tier', 'f')).toEqual([
      { text: 'PROCHAIN', color: 'e', bold: true },
      { text: ' tier', color: 'f', bold: false },
    ])
  })

  it('retire les codes pour les noms accessibles', () => {
    expect(plainMcText('Améliore ton tier §aGrowth Speed§7.')).toBe('Améliore ton tier Growth Speed.')
  })
})

describe('Minecraft : nombre des cases', () => {
  it('abrège au-delà de 999, arrondi vers le bas, pour tenir dans la case', () => {
    expect([7, 999, 1000, 1463, 9999, 14609, 999_999, 1_250_000, 2_000_000_000].map(stackCountLabel)).toEqual([
      '7',
      '999',
      '1k',
      '1.4k',
      '9.9k',
      '14k',
      '999k',
      '1.2M',
      '2B',
    ])
  })
})
