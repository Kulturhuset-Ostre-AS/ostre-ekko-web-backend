/* Payload GraphQL endpoint — the frontend points GRAPHQL_API_URL here:
   http://localhost:3000/api/graphql
   In Payload 3 the GraphQL handler is POST-only. */
import config from '@payload-config'
import { GRAPHQL_POST, REST_OPTIONS } from '@payloadcms/next/routes'

export const POST = GRAPHQL_POST(config)
// Reuse the REST OPTIONS handler for CORS preflight on the GraphQL route.
export const OPTIONS = REST_OPTIONS(config)
