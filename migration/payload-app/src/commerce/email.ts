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

// Tåler null/undefined: billettypenavn kan mangle i en locale (skrevet i
// EN-visningen → null i nb) — sendTickets krasjet på .replace og e-posten
// uteble stille (ordre 6, 2026-08-04). Aldri la malen velte utsendelsen.
function escapeHtml(s: string | null | undefined): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

// Billettleveranse på e-post: QR-kodene ligger VEDLAGT som PNG (folk forventer
// QR i e-posten; inline data-URI-er strippes av bl.a. Gmail, så vedlegg er den
// robuste kanalen) + kode i klartekst + lenke til Min side. Tidspunktet står på
// billetten (dato + dørene åpner/starttid) — jf. redaktørønske 2026-08-04.
export async function sendTickets(
  payload: Payload,
  args: {
    to: string
    name: string
    eventTitle: string
    eventDate?: string | null
    doorsOpenTime?: string | null
    startTime?: string | null
    tickets: { code: string; typeName: string | null | undefined }[]
  },
): Promise<void> {
  const { to, name, eventTitle, eventDate, doorsOpenTime, startTime, tickets } = args
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

  // «fredag 27. august 2026» i Oslo-tid; tåler både ISO og tomt felt.
  const dateLine = (() => {
    if (!eventDate) return ''
    const d = new Date(eventDate)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  })()
  const hhmm = (v?: string | null) => {
    if (!v) return ''
    const plain = /^(\d{1,2})[:.](\d{2})$/.exec(v.trim())
    if (plain) return `${plain[1].padStart(2, '0')}:${plain[2]}`
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' }).format(d)
  }
  const doors = hhmm(doorsOpenTime)
  const start = hhmm(startTime)
  const timeLine = [dateLine, doors && `dørene åpner ${doors}`, !doors && start && `kl. ${start}`]
    .filter(Boolean)
    .join(' — ')

  try {
    // QR-vedlegg: samme signerte payload som Min side/skanneren bruker.
    const { qrPayloadFor } = await import('./qr')
    const QRCode = (await import('qrcode')).default
    const attachments = await Promise.all(
      tickets.map(async (t, i) => ({
        filename: `billett-${i + 1}${t.typeName ? `-${String(t.typeName).replace(/[^a-zA-Z0-9æøåÆØÅ-]+/g, '_')}` : ''}.png`,
        content: await QRCode.toBuffer(qrPayloadFor(t.code), { width: 480, margin: 2 }),
      })),
    )

    await payload.sendEmail({
      to,
      subject: `Billettene dine – ${eventTitle}`,
      attachments,
      html: `
        <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto;">
          <h1>Takk${name ? `, ${escapeHtml(name)}` : ''}!</h1>
          <p>Her er billettene dine til <strong>${escapeHtml(eventTitle)}</strong>${timeLine ? `<br/><span style="text-transform: capitalize;">${escapeHtml(timeLine)}</span>` : ''}:</p>
          <ul>
            ${tickets.map((t, i) => `<li><strong>${escapeHtml(t.typeName || 'Billett')}</strong> — kode <code>${escapeHtml(t.code)}</code> (QR: vedlegg billett-${i + 1})</li>`).join('')}
          </ul>
          <p><strong>QR-kodene ligger vedlagt</strong> — vis dem i døren. Du finner dem
          også på <a href="${frontend}/konto">Min side</a>.</p>
        </div>
      `,
    })
  } catch (err) {
    payload.logger.error({ err, to }, 'ticket email failed')
  }
}
