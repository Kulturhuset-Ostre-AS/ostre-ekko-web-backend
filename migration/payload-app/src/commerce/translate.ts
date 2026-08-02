import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest, headersWithCors } from 'payload'

// Maskinoversettelse nb -> en som UTKAST, på redaktørens forespørsel:
//   POST /api/translate/draft  { collection, id }   (kun admin-brukere)
// Leser nb-innholdet, oversetter tekstfeltene (inkl. tekstnodene inne i
// lexical-riktekst) med Google Cloud Translation (samme GCP-prosjekt; kjøre-
// kontoen har roles/cloudtranslate.user), og lagrer som EN-UTKAST via
// draft=true — publiseres ALDRI automatisk. Redaktøren åpner EN-visningen,
// justerer forslaget og publiserer selv.

const json = (req: PayloadRequest, status: number, body: unknown) =>
  Response.json(body, { status, headers: headersWithCors({ headers: new Headers(), req }) })

// Oversettbare felter per collection: [rene tekstfelter, lexical-riktekstfelter]
const FIELDS: Record<string, { plain: string[]; lexical: string[] }> = {
  events: { plain: ['title'], lexical: ['intro', 'description', 'ticketDescription'] },
  news: { plain: ['title'], lexical: ['intro', 'newsContent'] },
  artists: { plain: ['title', 'shortTitle'], lexical: ['bio'] },
  arena: { plain: ['title', 'projectTitle'], lexical: ['pageContent'] },
}

async function accessToken(): Promise<string> {
  // Cloud Run: metadata-serveren gir kjørekontoens token.
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null)
  if (!r?.ok) throw new Error('Fant ikke GCP-credentials (kjører du lokalt? Oversettelse krever Cloud Run/ADC)')
  return (await r.json()).access_token
}

async function translateStrings(strings: string[], from: string, to: string): Promise<string[]> {
  if (!strings.length) return []
  const project = process.env.GCS_PROJECT_ID
  if (!project) throw new Error('GCS_PROJECT_ID mangler')
  const token = await accessToken()
  const out: string[] = []
  for (let i = 0; i < strings.length; i += 100) {
    const chunk = strings.slice(i, i + 100)
    const r = await fetch(`https://translation.googleapis.com/v3/projects/${project}/locations/global:translateText`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: chunk,
        mimeType: 'text/plain',
        sourceLanguageCode: from === 'nb' ? 'no' : from,
        targetLanguageCode: to === 'nb' ? 'no' : to,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!r.ok) throw new Error(`Translation API ${r.status}: ${(await r.text()).slice(0, 150)}`)
    const d = await r.json()
    out.push(...d.translations.map((t: { translatedText: string }) => t.translatedText))
  }
  return out
}

/** Samler alle tekstnodene i et lexical-tre (referanser, så de kan skrives tilbake). */
function collectLexicalTexts(root: unknown): { node: { text: string } }[] {
  const found: { node: { text: string } }[] = []
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return
    if (typeof n.text === 'string' && n.text.trim()) found.push({ node: n })
    if (Array.isArray(n.children)) n.children.forEach(walk)
  }
  walk((root as any)?.root)
  return found
}

const translateDraft: Endpoint = {
  path: '/translate/draft',
  method: 'post',
  handler: async (req) => {
    if (!req.user || req.user.collection !== 'users') return json(req, 403, { error: 'krever admin-innlogging' })
    await addDataAndFileToRequest(req)
    const { collection, id } = (req.data || {}) as { collection?: string; id?: number | string }
    const spec = collection ? FIELDS[collection] : undefined
    if (!spec || !id) return json(req, 400, { error: 'collection og id kreves (events/news/artists/arena)' })

    const doc = await req.payload
      .findByID({ collection: collection as any, id, depth: 0, locale: 'nb', fallbackLocale: null, draft: true })
      .catch(() => null)
    if (!doc) return json(req, 404, { error: 'dokument ikke funnet' })

    // Samle alle strenger i én batch: rene felter + lexical-tekstnoder.
    const strings: string[] = []
    const plainIdx: Record<string, number> = {}
    for (const f of spec.plain) {
      const v = (doc as any)[f]
      if (typeof v === 'string' && v.trim()) { plainIdx[f] = strings.length; strings.push(v) }
    }
    const lexicalCopies: Record<string, unknown> = {}
    const lexicalRefs: Record<string, { node: { text: string } }[]> = {}
    for (const f of spec.lexical) {
      const v = (doc as any)[f]
      if (!v) continue
      const copy = JSON.parse(JSON.stringify(v))
      const refs = collectLexicalTexts(copy)
      if (!refs.length) continue
      lexicalCopies[f] = copy
      lexicalRefs[f] = refs
      for (const r of refs) strings.push(r.node.text)
    }
    if (!strings.length) return json(req, 400, { error: 'ingen oversettbart innhold på norsk' })

    const translated = await translateStrings(strings, 'nb', 'en')

    const data: Record<string, unknown> = {}
    for (const [f, i] of Object.entries(plainIdx)) data[f] = translated[i]
    let cursor = Object.keys(plainIdx).length
    for (const f of Object.keys(lexicalCopies)) {
      for (const r of lexicalRefs[f]) r.node.text = translated[cursor++]
      data[f] = lexicalCopies[f]
    }

    // Lagres som EN-UTKAST — publiseres aldri automatisk. For collections uten
    // versions (arena? har versions) gjelder vanlig lagring i en-locale.
    await req.payload.update({ collection: collection as any, id, locale: 'en', draft: true, data })

    return json(req, 200, { fields: Object.keys(data), strings: strings.length })
  },
}

export const translateEndpoints: Endpoint[] = [translateDraft]
