import { describe, expect, it } from 'vitest'
import { BUDGET, HypixelBudget, reportToBudget, takeFromBudget, type BudgetState } from './budget'
import { memoryStorage } from './test/fakes'

const NOW = 1_700_000_000_000
const SECOND = 1000
const MINUTE = 60 * SECOND
const EMPTY: BudgetState = { calls: [], pausedUntil: 0 }

describe('budget des requêtes Hypixel', () => {
  it(`accorde au plus ${BUDGET} requêtes sur 5 minutes glissantes`, () => {
    let state = EMPTY
    for (let i = 0; i < BUDGET; i++) {
      const result = takeFromBudget(state, NOW + i * SECOND)
      expect(result.wait).toBeNull()
      state = result.state
    }
    // La première requête libère sa place 5 minutes après avoir été accordée.
    const full = takeFromBudget(state, NOW + BUDGET * SECOND)
    expect(full.wait).toBe(5 * 60 - BUDGET)
    expect(takeFromBudget(full.state, NOW + 5 * MINUTE).wait).toBeNull()
  })

  it("coupe tout quand Hypixel annonce un quota presque vide, jusqu'au quota suivant", () => {
    expect(reportToBudget(EMPTY, 150, 200, NOW)).toBe(EMPTY)
    const paused = reportToBudget(EMPTY, 12, 90, NOW)
    expect(takeFromBudget(paused, NOW + 30 * SECOND).wait).toBe(60)
    expect(takeFromBudget(paused, NOW + 90 * SECOND).wait).toBeNull()
  })

  it('garde le compte dans le stockage du Durable Object, entre deux demandes', async () => {
    const storage = memoryStorage()
    const take = async () => (await new HypixelBudget({ storage }).fetch(new Request('https://budget/take', { method: 'POST' }))).json()
    expect(await take()).toEqual({ used: 1, wait: null })
    expect(await take()).toEqual({ used: 2, wait: null })

    const report = { method: 'POST', body: JSON.stringify({ remaining: 0, resetSeconds: 120 }) }
    expect((await new HypixelBudget({ storage }).fetch(new Request('https://budget/report', report))).status).toBe(204)
    expect(await take()).toEqual({ used: 2, wait: expect.any(Number) })
  })
})
