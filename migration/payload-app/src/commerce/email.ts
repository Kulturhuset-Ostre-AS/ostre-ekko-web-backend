import type { Payload } from 'payload'

const TYPE_LABELS: Record<string, string> = {
  ordinary: 'Ordinært medlemskap',
  student: 'Studentmedlemskap',
}

// Purchase confirmation (the membership "receipt"). Per the client doc the
// physical membership card is picked up at Østre — this email is the
// confirmation + member ID, not a PDF card. Sent via the configured email
// adapter (Resend in cloud; without RESEND_API_KEY Payload logs to console).
export async function sendReceipt(
  payload: Payload,
  args: {
    to: string
    name: string
    memberId: string
    membershipType: string
    seasonLabel: string
    validUntil: Date
    amountOre: number
  },
): Promise<void> {
  const { to, name, memberId, membershipType, seasonLabel, validUntil, amountOre } = args
  const kr = (amountOre / 100).toFixed(0)
  const untilStr = validUntil.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

  try {
    await payload.sendEmail({
      to,
      subject: `Velkommen som medlem – ${seasonLabel}`,
      html: `
        <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto;">
          <h1>Takk, ${escapeHtml(name)}!</h1>
          <p>Du er nå medlem av Ekko/Østre.</p>
          <table cellpadding="6" style="border-collapse: collapse;">
            <tr><td><strong>Medlems-ID</strong></td><td>${escapeHtml(memberId)}</td></tr>
            <tr><td><strong>Type</strong></td><td>${TYPE_LABELS[membershipType] ?? membershipType}</td></tr>
            <tr><td><strong>Gyldig til</strong></td><td>${untilStr} (${escapeHtml(seasonLabel)})</td></tr>
            <tr><td><strong>Beløp</strong></td><td>${kr} kr</td></tr>
          </table>
          <p>Hent medlemsbeviset ditt på Østre ved ditt neste besøk — vis denne
          e-posten i døren. Medlemskapet gir rabatt på billetter til konserter og
          klubbkvelder, rabatt på Ekkofestivalen og utvalgte tilbud i baren.</p>
          <p>Vi sees!<br>Ekko / Østre</p>
        </div>
      `,
    })
  } catch (err) {
    // Email failure must never fail the payment — the member is registered;
    // staff can resend/verify from the admin.
    payload.logger.error({ err, to, memberId }, 'membership receipt email failed')
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

// Ticket delivery email: codes + QR payloads as links. QR rendering and Apple
// Wallet passes live on the frontend/my-page; email delivery is implemented but
// NOT yet tested (no email adapter in local dev — logs to console).
export async function sendTickets(
  payload: Payload,
  args: { to: string; name: string; eventTitle: string; tickets: { code: string; typeName: string }[] },
): Promise<void> {
  const { to, name, eventTitle, tickets } = args
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
  try {
    await payload.sendEmail({
      to,
      subject: `Billettene dine – ${eventTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto;">
          <h1>Takk${name ? `, ${escapeHtml(name)}` : ''}!</h1>
          <p>Her er billettene dine til <strong>${escapeHtml(eventTitle)}</strong>:</p>
          <ul>
            ${tickets.map((t) => `<li><strong>${escapeHtml(t.typeName)}</strong> — kode <code>${escapeHtml(t.code)}</code></li>`).join('')}
          </ul>
          <p>Du finner billettene med QR-kode på <a href="${frontend}/konto">Min side</a>.
          Vis QR-koden i døren.</p>
        </div>
      `,
    })
  } catch (err) {
    payload.logger.error({ err, to }, 'ticket email failed')
  }
}
