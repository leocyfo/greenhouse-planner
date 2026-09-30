/** Point d'entrée du Cloudflare Worker (voir handler.ts et le README, « Import depuis Hypixel »). */
import { handleRequest, type Env } from './handler'

/** Durable Object du budget global des requêtes Hypixel (voir wrangler.toml). */
export { HypixelBudget } from './budget'

/** Ce que le serveur utilise du contexte d'exécution de Cloudflare. */
interface ExecutionContext {
  waitUntil(task: Promise<unknown>): void
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, { waitUntil: (task) => ctx.waitUntil(task) })
  },
}
