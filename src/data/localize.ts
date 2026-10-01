/**
 * Traduction des textes de mutations.json (notes, conseils, noms d'objectifs et de plans…) : un
 * fichier à part (mutations.en.json) reprend la forme du fichier d'origine avec les seuls textes
 * traduits, et remplace ceux-ci avant la validation.
 *
 * Dans une liste d'objets (mutations, plans, objectifs, astuces, crops de base, upgrades, bestiary),
 * la traduction désigne chaque objet par son identifiant (`id`, sinon `name`, sinon `mob`) plutôt
 * que par sa position ; une liste de textes (sources, bonus) est remplacée en entier.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Identifiant d'un objet d'une liste, pour y retrouver sa traduction. */
export function itemKey(item: unknown): string | null {
  if (!isRecord(item)) return null
  for (const field of ['id', 'name', 'mob']) {
    const value = item[field]
    if (typeof value === 'string') return value
  }
  return null
}

/** Données d'origine avec les textes traduits de `patch` (le reste inchangé, rien n'est modifié en place). */
export function localizeRaw(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base
  if (typeof patch === 'string' || Array.isArray(patch)) return patch
  if (!isRecord(patch)) return base
  if (Array.isArray(base)) {
    return base.map((item) => {
      const key = itemKey(item)
      return key !== null && key in patch ? localizeRaw(item, patch[key]) : item
    })
  }
  if (!isRecord(base)) return base
  const result: Record<string, unknown> = { ...base }
  for (const [field, value] of Object.entries(patch)) result[field] = localizeRaw(base[field], value)
  return result
}

/**
 * Chemins de `patch` qui ne correspondent à rien dans `base` (identifiant mal écrit, champ
 * disparu) : une traduction oubliée ne doit pas passer inaperçue (vérifié par un test).
 */
export function unmatchedPaths(base: unknown, patch: unknown, path = ''): string[] {
  if (typeof patch === 'string' || Array.isArray(patch)) return base === undefined ? [path] : []
  if (!isRecord(patch)) return []
  if (Array.isArray(base)) {
    const keys = new Set(base.map(itemKey))
    return Object.entries(patch).flatMap(([key, value]) =>
      keys.has(key) ? unmatchedPaths(base.find((item) => itemKey(item) === key), value, `${path}[${key}]`) : [`${path}[${key}]`],
    )
  }
  if (!isRecord(base)) return [path]
  return Object.entries(patch).flatMap(([field, value]) => unmatchedPaths(base[field], value, path ? `${path}.${field}` : field))
}
