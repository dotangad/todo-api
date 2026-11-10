import { decodeHTML } from 'entities'
import sanitizeHtml from 'sanitize-html'
import { noteHtmlTags, safeNoteLink } from '../noteHtml'

export function sanitizeNoteHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: noteHtmlTags,
    allowedAttributes: { a: ['href'], ol: ['start'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attributes): sanitizeHtml.Tag => ({
        tagName: 'a',
        attribs: safeNoteLink(attributes.href ?? '')
          ? { href: attributes.href ?? '' }
          : {},
      }),
    },
  })
}

export function noteHtmlText(html: string) {
  const withBreaks = html.replace(
    /<br\s*\/?\s*>|<\/(?:p|h[23]|li|blockquote|pre)>/gi,
    '\n',
  )
  return decodeHTML(
    sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} }),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
