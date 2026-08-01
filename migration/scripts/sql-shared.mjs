// Shared mapping logic for the SQL import passes (sql-import.mjs,
// sql-import-relations.mjs, sql-import-drafts.mjs): Craft content row -> Payload
// scalar data, and relation/matrix -> Payload field builders. Draft elements carry
// the same content columns as canonical entries, so the same mappers serve both.
import { htmlToLexical, htmlToPlain } from './html-to-lexical.mjs'

export const bool = (v) => v === '1' || v === 1 || v === true
export const num = (v) => (v == null || v === '' ? undefined : Number(v))

// ---- field mapping: Craft content row -> Payload data (scalars only) -------------
// Field handles arrive already de-UID'd from the export (sql-export cleanFieldName),
// so scalarData reads clean handles like `venue`/`room`/`contact` regardless of the
// install's field-layout UID suffixes.
export function scalarData(collection, row) {
  const d = { craftId: Number(row.id), title: row.title || '(untitled)', slug: row.slug || `craft-${row.id}` }
  const rt = (v) => htmlToLexical(v)
  switch (collection) {
    case 'events':
      Object.assign(d, {
        entryType: row.typeHandle === 'festival' ? 'festival' : 'event',
        date: row.date || undefined, dateEnd: row.dateEnd || undefined,
        isMultiDay: bool(row.isMultiDay), singlePage: bool(row.singlePage),
        // Craft lightswitch with NULL means "field default" — prod SHOWS artist
        // info for those events, so null maps to true (bool(null)=false hid the
        // artist bios/schedule on 174 events — the "thin pages" parity finding).
        showArtistInfo: row.showArtistInfo == null ? true : bool(row.showArtistInfo),
        openingTime: row.openingTime || undefined, closingTime: row.closingTime || undefined,
        intro: rt(row.intro), description: rt(row.description),
        ticketLink: row.ticketLink || undefined, ticketDescription: htmlToLexical(row.ticketDescription),
        lineup: row.lineup || undefined, layout: row.layout || undefined,
        // festival theme / "skin" colours
        festivalColor: row.festivalColor || undefined,
        festivalSectionBgColor: row.festivalSectionBgColor || undefined,
        festivalSectionTextColor: row.festivalSectionTextColor || undefined,
        darkMode: bool(row.darkMode), festivalLinkInvert: bool(row.festivalLinkInvert),
      })
      break
    case 'news':
      Object.assign(d, { postDate: row.postDate || row.date || undefined, intro: rt(row.newsIntro || row.intro),
        newsContent: rt(row.newsContent), newsMediaPosition: row.newsMediaPosition || undefined })
      break
    case 'artists':
      Object.assign(d, { artistName: row.artistName || undefined, artistMeta: row.artistMeta || undefined,
        bio: rt(row.description || row.intro), shortTitle: row.shortTitle || undefined,
        openingTimes: row.openingTimes || undefined,
        isFeatured: bool(row.isFeatured), isVisible: row.isVisible == null ? true : bool(row.isVisible),
        hideMoreLink: bool(row.hideMoreLink) })
      break
    case 'performance':
      Object.assign(d, { date: row.date || undefined, time: row.time || undefined, timeEnd: row.timeEnd || undefined,
        fullTitle: row.fullTitle || undefined, ekstraInfo: row.ekstraInfo || undefined })
      break
    case 'arena':
      Object.assign(d, { artistName: row.artistName || undefined, projectTitle: row.projectTitle || undefined,
        videoUrl: row.videoUrl || undefined, pageContent: rt(row.pageContent) })
      break
  }
  return d
}

// Payload `_status` for a Craft element: Craft's global `enabled` flag maps to
// published/draft (disabled entries were hidden on the Craft site).
export const statusOf = (row) => (bool(row.enabled) ? 'published' : 'draft')

// Craft relation field -> Payload field name on the doc (per collection). Assets vs
// entries vs categories handled by what the target resolves to.
export const FIELD_MAP = {
  // events
  eventFeaturedPhoto: 'eventFeaturedPhoto', gallery: 'gallery', organizer: 'organizer',
  location: 'location', performances: 'performances', linkedEvents: 'linkedEvents',
  linkedFestival: 'linkedFestival', linkednews: 'linkednews',
  festivalSectionGraphicElements: 'festivalSectionGraphicElements',
  // artists / performance
  artistFeaturedPhoto: 'artistFeaturedPhoto', artist: 'artist', performance: 'performance',
  images: 'images',
  // news
  newsPhoto: 'newsPhoto', pagePhoto: 'pagePhoto',
}
// Fields that are single (not hasMany) on the Payload side.
export const SINGLE = new Set(['eventFeaturedPhoto', 'artistFeaturedPhoto', 'newsPhoto', 'pagePhoto', 'organizer'])
// Fields that point to media (assets) rather than entries.
export const ASSET_FIELDS = new Set(['eventFeaturedPhoto', 'artistFeaturedPhoto', 'newsPhoto', 'pagePhoto', 'gallery', 'images', 'festivalSectionGraphicElements'])

// Builders for relation/upload fields and matrix-derived fields, bound to the
// export maps. `findPayloadId(craftId) -> {col, id} | null`, `mediaId(craftAssetId)`.
export function makeBuilders({ relations, matrix, findPayloadId, mediaId }) {
  const dt = (v) => (v ? v.replace(' ', 'T') + '.000Z' : undefined)
  const hhmm = (v) => (v && v.includes(' ') ? v.split(' ')[1].slice(0, 5) : v || undefined)

  function buildProgram(craftId, siteId) {
    return (matrix.program?.[craftId]?.[siteId] || []).map((b) => ({
      date: dt(b.day_date), startTime: hhmm(b.day_startTime), endTime: hhmm(b.day_endTime),
      ticketInformation: htmlToPlain(b.day_ticketInformation),
    }))
  }
  function buildTickets(craftId, siteId) {
    return (matrix.tickets?.[craftId]?.[siteId] || []).map((b) => ({
      description: b.ticket_description || undefined, subdescription: b.ticket_subdescription || undefined,
      price: b.ticket_price || undefined, ticketLink: b.ticket_ticketLink || undefined,
      textContent: htmlToPlain(b.text_textContent),
    })).filter((t) => t.description || t.price || t.ticketLink || t.textContent)
  }
  function buildSections(craftId, siteId) {
    return (matrix.sections?.[craftId]?.[siteId] || []).map((b) => {
      // section images are a relation on the block element
      const imgs = (relations[b.id]?.images || relations[b.id]?.image || []).map(mediaId).filter(Boolean)
      return {
        sectionTitle: b.entry_sectionTitle || undefined,
        sectionBody: htmlToLexical(b.entry_sectionBody),
        ...(imgs.length ? { images: imgs } : {}),
      }
    }).filter((s) => s.sectionTitle || s.sectionBody || s.images)
  }

  // Build Payload complexContent blocks from Craft matrix blocks for one owner+site.
  function buildComplexContent(ownerCraftId, siteId) {
    const blocks = matrix.complexcontent?.[ownerCraftId]?.[siteId] || []
    const out = []
    for (const b of blocks) {
      switch (b.blockType) {
        case 'text': out.push({ blockType: 'text2', text: htmlToLexical(b.text_text || b.text) }); break
        case 'video': out.push({ blockType: 'video', videoUrl: b.video_videoUrl || b.videoUrl }); break
        case 'embed': out.push({ blockType: 'embed', code: b.embed_code || b.code }); break
        case 'imageBlock': {
          // imageBlock image is a relation on the block element; resolved via relations map
          const imgRels = relations[b.id]?.image || relations[b.id]?.imageBlock || []
          const mid = imgRels.map(mediaId).filter(Boolean)[0]
          out.push({ blockType: 'imageBlock', image: mid })
          break
        }
      }
    }
    return out.filter((b) => b.text || b.videoUrl || b.code || b.image)
  }

  // Relationship/upload fields for one source element, as Payload data.
  function buildRelationFields(sourceCraftId) {
    const data = {}
    const rels = relations[sourceCraftId] || {}
    for (const [craftField, targets] of Object.entries(rels)) {
      const pField = FIELD_MAP[craftField]
      if (!pField) continue
      let ids
      if (ASSET_FIELDS.has(craftField)) {
        ids = targets.map(mediaId).filter(Boolean)
      } else {
        ids = targets.map((t) => findPayloadId(t)?.id).filter(Boolean)
      }
      if (!ids.length) continue
      data[pField] = SINGLE.has(craftField) ? ids[0] : ids
    }
    return data
  }

  // Everything matrix/relation-derived for one owner element (nb site blocks).
  function buildRelationData(col, craftId) {
    const data = buildRelationFields(craftId)
    if (['events', 'news', 'artists', 'arena'].includes(col)) {
      const cc = buildComplexContent(craftId, 1)
      if (cc.length) data.complexContent = cc
    }
    if (col === 'events') {
      const program = buildProgram(craftId, 1)
      const tickets = buildTickets(craftId, 1)
      const sections = buildSections(craftId, 1)
      if (program.length) data.program = program
      if (tickets.length) data.tickets = tickets
      if (sections.length) data.sections = sections
    }
    return data
  }

  return { buildProgram, buildTickets, buildSections, buildComplexContent, buildRelationFields, buildRelationData }
}
