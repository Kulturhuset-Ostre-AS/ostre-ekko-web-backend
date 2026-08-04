import type { CollectionConfig } from 'payload'

// Public customer accounts (ticket + membership buyers) — SEPARATE from the
// admin `users` collection. Payload auto-provides /api/customers/login, logout,
// me, forgot-password etc. Registration is open (public create); customers can
// read/update only themselves. framtid.ekko.no ↔ admin.ekko.no are same-site
// (same eTLD+1), so the default Lax auth cookie works cross-subdomain.
export const Customers: CollectionConfig = {
  slug: 'customers',
  auth: {
    tokenExpiration: 60 * 60 * 24 * 14, // 14 days
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
    // Glemt passord: lenken må gå til FRONTENDEN (/konto/nytt-passord), ikke
    // Payload-admin — kundene har ingen admin-tilgang. Frontend-ruten poster
    // token + nytt passord til /api/customers/reset-password.
    forgotPassword: {
      generateEmailSubject: () => 'Nullstill passordet ditt – Østre / EKKO',
      generateEmailHTML: (args) => {
        const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
        const url = `${frontend}/konto/nytt-passord?token=${args?.token ?? ''}`
        return `
          <div style="background: #ffffff; padding: 24px; font-family: Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111111;">
            <p style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 2px solid #111; padding-bottom: 10px;">Østre&nbsp;/&nbsp;EKKO</p>
            <h1 style="font-size: 22px; margin: 18px 0 8px;">Nullstill passordet ditt</h1>
            <p style="font-size: 15px;">Noen (forhåpentligvis du) ba om å nullstille passordet for kontoen din.
            Lenken er gyldig i én time.</p>
            <p style="margin: 24px 0;">
              <a href="${url}" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 15px;">Velg nytt passord</a>
            </p>
            <p style="font-size: 13px; color: #777;">Ba du ikke om dette, kan du se bort fra e-posten — passordet er uendret.</p>
          </div>`
      },
    },
  },
  admin: {
    group: 'Medlemskap',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'createdAt'],
    description: 'Kundekontoer (billett-/medlemskjøp på nettsiden). Ikke admin-brukere.',
  },
  // Engangskode-flyt for glemt passord (commerce/auth-otp.ts): koden hashes,
  // og under panseret gjenbrukes Payloads reset-token. Feltene er skjult og
  // utilgjengelige utenfra — kun local API med overrideAccess rører dem.
  // (Feltdefinisjonene ligger i fields-listen nederst.)
  access: {
    create: () => true, // open registration
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection !== 'customers') return true // admin users see all
      return { id: { equals: req.user.id } }
    },
    update: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection !== 'customers') return true
      return { id: { equals: req.user.id } }
    },
    delete: ({ req }) => Boolean(req.user && req.user.collection !== 'customers'),
  },
  fields: [
    { name: 'name', type: 'text' },
    // OTP-feltene (se kommentar over): aldri lesbare/skrivbare via API.
    { name: 'otpCodeHash', type: 'text', hidden: true, access: { read: () => false, update: () => false } },
    { name: 'otpResetToken', type: 'text', hidden: true, access: { read: () => false, update: () => false } },
    { name: 'otpExpiresAt', type: 'date', hidden: true, access: { read: () => false, update: () => false } },
    { name: 'otpAttempts', type: 'number', hidden: true, access: { read: () => false, update: () => false } },
  ],
}
