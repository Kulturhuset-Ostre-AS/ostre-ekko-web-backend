/* THIS FILE WAS GENERATED FROM THE PAYLOAD 3 TEMPLATE — root layout for /admin + /api. */
import type { ServerFunctionClient } from 'payload'
import config from '@payload-config'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { importMap } from './admin/importMap'
import React from 'react'

// Payload admin base styles — REQUIRED, or the admin renders unstyled.
// TWO stylesheets are needed and both must be imported explicitly here:
//   - @payloadcms/next/css : defines the theme CSS variables (--theme-elevation-*, etc.)
//   - @payloadcms/ui/css   : the admin component styles (nav, cards, forms, …)
// The ui styles reference the theme vars, so next/css must come first. (The raw
// dist/*.css subpaths are blocked by the packages' `exports` maps; use these `…/css`
// exports.)
import '@payloadcms/next/css'
import '@payloadcms/ui/css'
import './custom.scss'

type Args = { children: React.ReactNode }

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({ ...args, config, importMap })
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
