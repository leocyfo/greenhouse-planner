/** Services de Cloudflare simulés en mémoire, pour les tests du serveur. */
import { HypixelBudget, type BudgetNamespace, type DurableStorage } from '../budget'
import type { KvStore } from '../handler'

/** Stockage d'un Durable Object. */
export function memoryStorage(): DurableStorage {
  const entries = new Map<string, unknown>()
  return {
    get: async (key) => structuredClone(entries.get(key)),
    put: async (key, value) => {
      entries.set(key, structuredClone(value))
    },
  }
}

/** Workers KV. */
export function memoryCache(): KvStore {
  const entries = new Map<string, string>()
  return {
    get: async (key) => {
      const value = entries.get(key)
      return value === undefined ? null : JSON.parse(value)
    },
    put: async (key, value) => {
      entries.set(key, value)
    },
  }
}

/** Liaison du Durable Object du budget : toutes les demandes vont à la même instance. */
export function budgetNamespace(storage: DurableStorage = memoryStorage()): BudgetNamespace {
  const budget = new HypixelBudget({ storage })
  return {
    idFromName: (name) => name,
    get: () => ({ fetch: (url, init) => budget.fetch(new Request(url, init)) }),
  }
}
