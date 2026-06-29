/* Payload GraphQL endpoint — the frontend points GRAPHQL_API_URL here:
   http://localhost:3000/api/graphql */
import config from '@payload-config'
import { GRAPHQL_POST, GRAPHQL_GET, GRAPHQL_OPTIONS } from '@payloadcms/next/routes'

export const POST = GRAPHQL_POST(config)
export const GET = GRAPHQL_GET(config)
export const OPTIONS = GRAPHQL_OPTIONS(config)
