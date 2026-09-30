/**
 * Budget global des requêtes Hypixel. Un seul Durable Object tient le compte pour tout le serveur,
 * donc un compte exact même avec des visiteurs du monde entier. Il n'accorde jamais plus de
 * 240 requêtes sur 5 minutes glissantes (limite de la clé : 300) et coupe tout dès que Hypixel
 * annonce un quota presque vide (la clé peut servir ailleurs) : le serveur ne dépasse jamais la
 * limite, ce qui pourrait valoir un bannissement de la clé.
 */
import { isRecord } from './util'

/** Fenêtre du quota Hypixel. */
const WINDOW_MS = 5 * 60 * 1000
/** Requêtes accordées au plus sur 5 minutes glissantes : 60 de marge sous la limite de la clé. */
export const BUDGET = 240
/** Quota annoncé par Hypixel à partir duquel plus rien n'est accordé jusqu'au quota suivant. */
const MIN_REMAINING = 20
const STATE_KEY = 'state'

export interface BudgetState {
  /** Dates (ms) des requêtes accordées, les plus anciennes d'abord. */
  readonly calls: readonly number[]
  /** Rien n'est accordé avant cette date (ms) : quota presque vide selon Hypixel. */
  readonly pausedUntil: number
}

const EMPTY: BudgetState = { calls: [], pausedUntil: 0 }

/** Accorde une requête (wait : null) ou donne l'attente, en secondes. */
export function takeFromBudget(state: BudgetState, now: number): { readonly state: BudgetState; readonly wait: number | null } {
  const calls = state.calls.filter((time) => now - time < WINDOW_MS)
  const secondsUntil = (time: number) => Math.max(1, Math.ceil((time - now) / 1000))
  if (now < state.pausedUntil) return { state: { ...state, calls }, wait: secondsUntil(state.pausedUntil) }
  const oldest = calls[0]
  if (calls.length >= BUDGET && oldest !== undefined) {
    return { state: { ...state, calls }, wait: secondsUntil(oldest + WINDOW_MS) }
  }
  return { state: { ...state, calls: [...calls, now] }, wait: null }
}

/** Quota annoncé par Hypixel : presque vide, plus rien n'est accordé jusqu'au quota suivant. */
export function reportToBudget(state: BudgetState, remaining: number, resetSeconds: number, now: number): BudgetState {
  if (remaining > MIN_REMAINING) return state
  return { ...state, pausedUntil: Math.max(state.pausedUntil, now + resetSeconds * 1000) }
}

function toBudgetState(value: unknown): BudgetState {
  if (!isRecord(value) || !Array.isArray(value.calls) || typeof value.pausedUntil !== 'number') return EMPTY
  return { calls: value.calls.filter((time): time is number => typeof time === 'number'), pausedUntil: value.pausedUntil }
}

/** Ce que le budget utilise du stockage d'un Durable Object. */
export interface DurableStorage {
  get(key: string): Promise<unknown>
  put(key: string, value: unknown): Promise<void>
}

/**
 * Durable Object du budget (voir wrangler.toml). Chaque demande lit l'état, le modifie et l'écrit
 * sans autre attente entre les deux : Cloudflare ne livre aucune autre demande pendant ce temps.
 */
export class HypixelBudget {
  private readonly storage: DurableStorage

  constructor(state: { readonly storage: DurableStorage }) {
    this.storage = state.storage
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)
    // Le corps est lu avant l'état, pour qu'aucune attente ne sépare la lecture de l'écriture.
    const body: unknown = pathname === '/report' ? await request.json().catch(() => null) : null
    const state = toBudgetState(await this.storage.get(STATE_KEY))
    const now = Date.now()
    if (pathname === '/take') {
      const result = takeFromBudget(state, now)
      await this.storage.put(STATE_KEY, result.state)
      const answer: BudgetAnswer = { used: result.state.calls.length, wait: result.wait }
      return Response.json(answer)
    }
    if (pathname === '/report' && isRecord(body) && typeof body.remaining === 'number' && typeof body.resetSeconds === 'number') {
      await this.storage.put(STATE_KEY, reportToBudget(state, body.remaining, body.resetSeconds, now))
      return new Response(null, { status: 204 })
    }
    return new Response(null, { status: 400 })
  }
}

/** Ce que le serveur utilise de la liaison du Durable Object (voir wrangler.toml). */
export interface BudgetNamespace {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(url: string, init?: RequestInit): Promise<Response> }
}

export interface BudgetAnswer {
  /** Requêtes accordées sur les 5 dernières minutes, celle-ci comprise. */
  readonly used: number
  /** null : requête accordée ; sinon, secondes à attendre. */
  readonly wait: number | null
}

export interface RequestBudget {
  /** Demande une requête Hypixel. */
  take(): Promise<BudgetAnswer>
  /** Quota annoncé par Hypixel après une requête ; transmis seulement s'il est presque vide. */
  report(remaining: number, resetSeconds: number): Promise<void>
}

/** Budget commun à tout le serveur : une seule instance, nommée « hypixel ». */
export function budgetClient(namespace: BudgetNamespace): RequestBudget {
  const stub = namespace.get(namespace.idFromName('hypixel'))
  return {
    async take() {
      const body: unknown = await (await stub.fetch('https://budget/take', { method: 'POST' })).json()
      if (!isRecord(body) || typeof body.used !== 'number' || !(body.wait === null || typeof body.wait === 'number')) {
        throw new Error('réponse illisible')
      }
      return { used: body.used, wait: body.wait }
    },
    async report(remaining, resetSeconds) {
      if (remaining > MIN_REMAINING) return
      await stub.fetch('https://budget/report', { method: 'POST', body: JSON.stringify({ remaining, resetSeconds }) })
    },
  }
}
