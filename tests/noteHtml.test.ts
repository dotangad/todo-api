import { expect, test } from 'bun:test'
import { plainNoteHtml, safeNoteLink } from '../src/noteHtml'
import { noteHtmlText, sanitizeNoteHtml } from '../src/server/noteHtml'

test('legacy text is escaped instead of being interpreted as HTML', () => {
  expect(plainNoteHtml('<b>literal</b> & "quoted"\n\nLast line')).toBe(
    '<p>&lt;b&gt;literal&lt;/b&gt; &amp; &quot;quoted&quot;</p><p></p><p>Last line</p>',
  )
  expect(noteHtmlText(plainNoteHtml('One\n\nTwo & three'))).toBe(
    'One\n\nTwo & three',
  )
})

test('rich text retains supported formatting and provides a readable text fallback', () => {
  const html =
    '<h2>Ideas &amp; plans</h2><p><strong>Bold</strong> <em>italic</em> <u>underline</u> <s>strike</s><br />Next</p><ul><li><p>One</p></li><li><p>Two</p></li></ul><ol start="3"><li>Three</li></ol><blockquote><p>Quote</p></blockquote><pre><code>const x = 1</code></pre><hr /><a href="https://example.com">Link</a>'
  expect(sanitizeNoteHtml(html)).toBe(html)
  const text = noteHtmlText(html)
  expect(text).toContain('Ideas & plans\nBold italic underline strike\nNext')
  expect(text).toContain('One\n\nTwo')
  expect(text).toContain('const x = 1')
  expect(text).not.toContain('<')
})

test('scripts, embeds, event handlers, arbitrary styles, and unsafe URLs cannot survive sanitization', () => {
  const html = sanitizeNoteHtml(
    '<script>alert(1)</script><style>body{display:none}</style><iframe src="https://evil.test"></iframe><img src=x onerror=alert(1)><svg onload=alert(1)></svg><p style="position:fixed" onclick="alert(1)">Safe <b>text</b></p><a href="javascript:alert(1)" target="_blank" onclick="alert(1)">bad</a><a href="&#106;avascript:alert(1)">encoded</a><a href="//evil.test">relative</a><a href="data:text/html,bad">data</a><a href="https://example.com" target="_blank">good</a>',
  )
  expect(html).toBe(
    '<p>Safe text</p><a>bad</a><a>encoded</a><a>relative</a><a>data</a><a href="https://example.com">good</a>',
  )
  expect(noteHtmlText(html)).not.toContain('alert')
})

test('only explicit web or email links are accepted', () => {
  for (const href of [
    'https://example.com/path?q=1',
    'http://example.com',
    'mailto:hello@example.com',
  ])
    expect(safeNoteLink(href)).toBe(true)
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,hi',
    '//example.com',
    '/path',
    'java\nscript:alert(1)',
    'https://exa\u0000mple.com',
    'https://example.com bad',
  ])
    expect(safeNoteLink(href)).toBe(false)
})

test('formatting-only content has an empty text fallback', () => {
  for (const html of [
    '<p></p>',
    '<p><br></p>',
    '<p>&nbsp;</p>',
    '<ul><li><p></p></li></ul>',
    '<hr>',
  ])
    expect(noteHtmlText(sanitizeNoteHtml(html)).trim()).toBe('')
})
