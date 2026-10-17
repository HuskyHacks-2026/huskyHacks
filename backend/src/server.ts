import { serve } from '@hono/node-server'
import { appFromEnv } from './app'

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: appFromEnv().fetch, port }, i => console.log(`Agent Alias Vault API on http://localhost:${i.port}/api`))
