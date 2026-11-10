import DOMPurify from 'dompurify'
import { noteHtmlTags } from '../noteHtml'

export function cleanNoteHtml(html: string, preview = false) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: noteHtmlTags,
    // Previews are inside the card's edit button, so links must not be interactive.
    ALLOWED_ATTR: preview ? ['start'] : ['href', 'start'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/|mailto:)/i,
  })
}
