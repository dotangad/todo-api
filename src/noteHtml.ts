// The editor, server sanitizer, and card previews share a deliberately small schema.
export const noteHtmlTags = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'hr',
]

export function plainNoteHtml(text: string) {
  const escaped = text.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  )
  return escaped
    .split(/\r?\n/)
    .map((line) => `<p>${line}</p>`)
    .join('')
}

export function safeNoteLink(value: string) {
  return (
    /^(https?:\/\/|mailto:)/i.test(value) &&
    !/\s/.test(value) &&
    ![...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
}
