import { serve } from '@hono/node-server'
import { createApp } from './app'

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: createApp().fetch, port }, i => console.log(`Agent Alias Vault API on http://localhost:${i.port}`))
