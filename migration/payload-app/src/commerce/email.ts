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

// Billettleveranse + KVITTERING i samme e-post (redaktørønske 2026-08-04).
// QR-kodene ligger VEDLAGT som PNG (inline data-URI-er strippes av bl.a.
// Gmail, så vedlegg er den robuste kanalen). Layouten bruker tabeller og
// inline-stiler — det eneste e-postklienter rendrer forutsigbart.
// `order` er valgfri: gjensending fra Min side har ingen kjøpskontekst og
// sender da bare billettdelen.
export async function sendTickets(
  payload: Payload,
  args: {
    to: string
    name: string
    eventTitle: string
    eventDate?: string | null
    doorsOpenTime?: string | null
    startTime?: string | null
    venue?: string | null
    tickets: { code: string; typeName: string | null | undefined }[]
    order?: {
      id: number | string
      createdAt?: string | null
      items?: { name?: string | null; quantity?: number | null; unitPriceOre?: number | null }[] | null
      amountOre?: number | null
      provider?: string | null
    } | null
  },
): Promise<void> {
  const { to, name, eventTitle, eventDate, doorsOpenTime, startTime, venue, tickets, order } = args
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

  // «fredag 27. august 2026» i Oslo-tid; tåler både ISO og tomt felt.
  const longDate = (v?: string | null) => {
    if (!v) return ''
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  }
  const hhmm = (v?: string | null) => {
    if (!v) return ''
    const plain = /^(\d{1,2})[:.](\d{2})$/.exec(v.trim())
    if (plain) return `${plain[1].padStart(2, '0')}:${plain[2]}`
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' }).format(d)
  }
  const kr = (ore?: number | null) => (typeof ore === 'number' ? `${(ore / 100).toFixed(0)} kr` : '')

  const dateLine = longDate(eventDate)
  const doors = hhmm(doorsOpenTime)
  const start = hhmm(startTime)

  // Stilene gjenbrukes i begge tabellene.
  const th = 'text-align: left; padding: 8px 12px; border-bottom: 2px solid #111; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em;'
  const td = 'padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 14px;'
  const label = 'padding: 4px 12px 4px 0; color: #555; font-size: 14px; vertical-align: top; white-space: nowrap;'
  const value = 'padding: 4px 0; font-size: 14px;'

  const infoRows = [
    dateLine && `<tr><td style="${label}">Dato</td><td style="${value}; text-transform: capitalize;">${escapeHtml(dateLine)}</td></tr>`,
    venue && `<tr><td style="${label}">Sted</td><td style="${value}">${escapeHtml(venue)}</td></tr>`,
    doors && `<tr><td style="${label}">Dørene åpner</td><td style="${value}">${doors}</td></tr>`,
    start && `<tr><td style="${label}">Starttid</td><td style="${value}">${start}</td></tr>`,
  ].filter(Boolean).join('')

  const receiptSection = order
    ? `
      <h2 style="font-size: 16px; margin: 28px 0 8px; border-top: 2px solid #111; padding-top: 20px;">Kvittering</h2>
      <table cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
        <tr><td style="${label}">Ordrenummer</td><td style="${value}">${escapeHtml(String(order.id))}</td></tr>
        ${order.createdAt ? `<tr><td style="${label}">Kjøpsdato</td><td style="${value}; text-transform: capitalize;">${escapeHtml(longDate(order.createdAt))} kl. ${hhmm(order.createdAt)}</td></tr>` : ''}
        <tr><td style="${label}">Kjøper</td><td style="${value}">${escapeHtml(name || to)} &lt;${escapeHtml(to)}&gt;</td></tr>
        ${order.provider ? `<tr><td style="${label}">Betaling</td><td style="${value}">${escapeHtml(order.provider === 'mock' ? 'Testbetaling (mock)' : order.provider)}</td></tr>` : ''}
      </table>
      <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-top: 12px;">
        <tr><th style="${th}">Vare</th><th style="${th}; text-align: right;">Antall</th><th style="${th}; text-align: right;">Pris</th><th style="${th}; text-align: right;">Sum</th></tr>
        ${(order.items ?? []).map((l) => `
          <tr>
            <td style="${td}">${escapeHtml(l.name || 'Billett')}</td>
            <td style="${td}; text-align: right;">${l.quantity ?? 1}</td>
            <td style="${td}; text-align: right;">${kr(l.unitPriceOre)}</td>
            <td style="${td}; text-align: right;">${kr((l.unitPriceOre ?? 0) * (l.quantity ?? 1))}</td>
          </tr>`).join('')}
        <tr><td colspan="3" style="padding: 10px 12px; text-align: right; font-weight: bold;">Totalt</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: bold; border-top: 2px solid #111;">${kr(order.amountOre)}</td></tr>
      </table>`
    : ''

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
      subject: order ? `Kvittering og billetter – ${eventTitle}` : `Billettene dine – ${eventTitle}`,
      attachments,
      html: `
        <div style="background: #ffffff; padding: 24px; font-family: Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111111;">
          <p style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 2px solid #111; padding-bottom: 10px; color: #111111;">Østre&nbsp;/&nbsp;EKKO</p>
          <h1 style="font-size: 22px; margin: 18px 0 4px;">Takk${name ? `, ${escapeHtml(name)}` : ''}!</h1>
          <p style="font-size: 15px; margin: 4px 0 16px;">Her er billettene dine til <strong>${escapeHtml(eventTitle)}</strong>.</p>
          ${infoRows ? `<table cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 8px;">${infoRows}</table>` : ''}

          <h2 style="font-size: 16px; margin: 20px 0 8px;">Billetter</h2>
          <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%;">
            <tr><th style="${th}">Type</th><th style="${th}">Kode</th><th style="${th}">QR</th></tr>
            ${tickets.map((t, i) => `
              <tr>
                <td style="${td}">${escapeHtml(t.typeName || 'Billett')}</td>
                <td style="${td}"><code style="font-size: 13px;">${escapeHtml(t.code)}</code></td>
                <td style="${td}">vedlegg <strong>billett-${i + 1}</strong></td>
              </tr>`).join('')}
          </table>
          <p style="font-size: 14px; background: #f4f4f4; padding: 10px 12px; border-radius: 4px;">
            <strong>QR-kodene ligger vedlagt</strong> — vis dem i døren.
            Du finner dem også på <a href="${frontend}/konto" style="color: #111;">Min side</a>.
          </p>
          ${receiptSection}
          <p style="font-size: 12px; color: #777; margin-top: 28px; border-top: 1px solid #ddd; padding-top: 12px;">
            Østre — hus for lydkunst og elektronisk musikk<br/>
            Østre Skostredet 3, 5017 Bergen · post@oestre.no
          </p>
        </div>
      `,
    })
  } catch (err) {
    payload.logger.error({ err, to }, 'ticket email failed')
  }
}
