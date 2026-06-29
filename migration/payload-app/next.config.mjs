import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Payload runs inside Next's app router; nothing app-specific needed for the test env.
}

export default withPayload(nextConfig)
