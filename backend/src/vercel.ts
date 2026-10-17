// Vercel serverless entry: the whole /api surface is the Hono app. Bundled to api/index.js by `npm run build:api`.
import { handle } from '@hono/node-server/vercel'
import { appFromEnv } from './app'

export default handle(appFromEnv())
