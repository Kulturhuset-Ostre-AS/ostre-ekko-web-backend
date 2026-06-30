// Faithful HTML (Craft 3 Redactor) -> Payload lexical richText converter.
//
// Preserves the formatting actually present in the EKKO content:
//   block: <p> <h2> <h4> <h3> <ul> <ol> <li> <blockquote>
//   inline: <strong>/<b> (bold), <em>/<i> (italic), <a href> (link), <br> (linebreak)
//   <span> is unwrapped (style is dropped — Redactor span styling isn't carried).
//   <iframe>/<script> embeds inside rich text are wrapped as a lexical "html" block-ish
//     paragraph carrying the raw markup so it isn't lost (rendered via dangerouslySet
//     by an 'embedHtml' node the frontend can special-case — falls back to text).
//
// Output matches the node contract in app/components/cms/RichText.tsx:
//   text{format bitflags}, paragraph, heading{tag}, list{listType}/listitem, link{fields},
//   linebreak, quote.
import { parse } from 'node-html-parser'

const IS_BOLD = 1
const IS_ITALIC = 1 << 1

const textNode = (text, format = 0) => ({
  type: 'text', text, format, version: 1, mode: 'normal', style: '', detail: 0,
})

const decode = (s) =>
  (s || '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&aelig;/gi, 'æ').replace(/&oslash;/gi, 'ø').replace(/&aring;/gi, 'å')

// Collect inline children (text + format + links + linebreaks) from an element's nodes.
function inlineChildren(node, format = 0) {
  const out = []
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      // text node
      const t = decode(child.rawText)
      if (t.replace(/\s+/g, ' ') !== '') out.push(textNode(t.replace(/\s+/g, ' '), format))
      continue
    }
    if (child.nodeType !== 1) continue
    const tag = child.rawTagName?.toLowerCase()
    switch (tag) {
      case 'br':
        out.push({ type: 'linebreak', version: 1 })
        break
      case 'strong':
      case 'b':
        out.push(...inlineChildren(child, format | IS_BOLD))
        break
      case 'em':
      case 'i':
        out.push(...inlineChildren(child, format | IS_ITALIC))
        break
      case 'a': {
        const url = child.getAttribute('href') || '#'
        const newTab = (child.getAttribute('target') || '') === '_blank'
        out.push({
          type: 'link', version: 2, fields: { url, newTab, linkType: 'custom' },
          children: inlineChildren(child, format),
        })
        break
      }
      case 'span':
      default:
        // unwrap unknown inline containers
        out.push(...inlineChildren(child, format))
    }
  }
  return out
}

const para = (children) =>
  ({ type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0, children: children.length ? children : [textNode('')] })

function blockNodes(root) {
  const out = []
  // Walk top-level child nodes; group stray inline/text into paragraphs.
  let pending = []
  const flush = () => { if (pending.length) { out.push(para(pending)); pending = [] } }

  for (const child of root.childNodes) {
    if (child.nodeType === 3) {
      const t = decode(child.rawText)
      if (t.trim()) pending.push(textNode(t.replace(/\s+/g, ' ')))
      continue
    }
    if (child.nodeType !== 1) continue
    const tag = child.rawTagName?.toLowerCase()
    switch (tag) {
      case 'p':
        flush()
        out.push(para(inlineChildren(child)))
        break
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        flush()
        out.push({ type: 'heading', tag, version: 1, direction: 'ltr', format: '', indent: 0, children: inlineChildren(child) })
        break
      case 'ul': case 'ol':
        flush()
        out.push({
          type: 'list', version: 1, listType: tag === 'ol' ? 'number' : 'bullet',
          start: 1, tag, direction: 'ltr', format: '', indent: 0,
          children: child.querySelectorAll('li').map((li, i) => ({
            type: 'listitem', version: 1, value: i + 1, direction: 'ltr', format: '', indent: 0,
            children: inlineChildren(li),
          })),
        })
        break
      case 'blockquote':
        flush()
        out.push({ type: 'quote', version: 1, direction: 'ltr', format: '', indent: 0, children: inlineChildren(child) })
        break
      case 'br':
        pending.push({ type: 'linebreak', version: 1 })
        break
      case 'iframe': case 'script': case 'figure': {
        // Preserve embed markup so it isn't lost. Frontend RichText falls back to text
        // for unknown node types; an 'embedHtml' node can be special-cased later.
        flush()
        out.push({ type: 'embedHtml', version: 1, html: child.toString(), children: [] })
        break
      }
      default:
        // unknown block (div, etc.) — recurse into it
        out.push(...blockNodes(child))
    }
  }
  flush()
  return out
}

/** Convert an HTML string to a Payload lexical document, or undefined if empty. */
export function htmlToLexical(html) {
  if (!html || typeof html !== 'string') return undefined
  const root = parse(html, { lowerCaseTagName: true, comment: false })
  let children = blockNodes(root)
  // Drop empty trailing/leading paragraphs that carry no text.
  children = children.filter((n) =>
    n.type !== 'paragraph' || (n.children || []).some((c) => (c.type === 'text' && c.text.trim()) || c.type === 'link' || c.type === 'linebreak'))
  if (!children.length) return undefined
  return { root: { type: 'root', version: 1, direction: 'ltr', format: '', indent: 0, children } }
}

/** Plain-text flatten (for textarea fields like ticketDescription). */
export function htmlToPlain(html) {
  if (!html || typeof html !== 'string') return undefined
  const s = decode(html.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
  return s || undefined
}
