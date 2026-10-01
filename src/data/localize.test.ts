import { describe, expect, it } from 'vitest'
import { loadGameData } from './load'
import { localizeRaw, unmatchedPaths } from './localize'
import english from './mutations.en.json'
import raw from './mutations.json'

/** Tous les textes d'une valeur chargée (objets, listes, Maps), avec leur chemin. */
function texts(value: unknown, path = ''): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }]
  if (value instanceof Map) return [...value].flatMap(([key, item]) => texts(item, `${path}[${String(key)}]`))
  if (Array.isArray(value)) return value.flatMap((item, index) => texts(item, `${path}[${index}]`))
  if (typeof value === 'object' && value !== null) return Object.entries(value).flatMap(([key, item]) => texts(item, `${path}.${key}`))
  return []
}

/** Marques du français : lettres accentuées, mots courants. */
const FRENCH = /[àâçéèêëîïôûùœ]|\b(le|la|les|des|une|pour|avec|dans|sur|est|sont|pas|du|aux|qui|que|chaque|jours?|plus|après|avant)\b/i

describe('données en anglais', () => {
  it('ne traduit que des champs qui existent (identifiants et chemins justes)', () => {
    expect(unmatchedPaths(raw, english)).toEqual([])
  })

  it('se chargent sans erreur, avec les mêmes nombres que les données d’origine', () => {
    const french = loadGameData(raw)
    const translated = loadGameData(localizeRaw(raw, english))
    expect(translated.ok).toBe(true)
    if (!translated.ok || !french.ok) return
    expect(translated.data.mutations.map((m) => [m.id, m.growthStages, m.conditions])).toEqual(
      french.data.mutations.map((m) => [m.id, m.growthStages, m.conditions]),
    )
    expect(translated.data.goals.find((g) => g.id === 'analyze_all')?.name).toBe('Analyze the 40 mutations')
    expect(translated.data.layouts.find((l) => l.id === 'avrg_blastberry_min')?.name).toBe('Blastberry: minimum')
  })

  it('ne laisse aucun texte en français', () => {
    const translated = loadGameData(localizeRaw(raw, english))
    if (!translated.ok) throw new Error('données anglaises invalides')
    const french = texts(translated.data).filter(({ text }) => FRENCH.test(text))
    expect(french).toEqual([])
  })

  it('ne modifie pas les données d’origine', () => {
    const before = JSON.stringify(raw)
    localizeRaw(raw, english)
    expect(JSON.stringify(raw)).toBe(before)
  })
})
