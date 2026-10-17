// Vercel serverless entry: the whole /api surface is the Hono app in backend/src.
import { handle } from '@hono/node-server/vercel'
import { appFromEnv } from '../backend/src/app'

export default handle(appFromEnv())
