import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Payload runs inside Next's app router; nothing app-specific needed for the test env.
  // Next 16.4+ writes an AGENTS.md into the project on `next dev`; not wanted here.
  agentRules: false,
}

export default withPayload(nextConfig)
