/** Point d'entrée du Cloudflare Worker (voir handler.ts et le README, « Import depuis Hypixel »). */
import { handleRequest, type Env } from './handler'

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env)
  },
}
