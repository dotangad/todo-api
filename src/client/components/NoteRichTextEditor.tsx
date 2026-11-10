import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { plainNoteHtml, safeNoteLink } from '../../noteHtml'
import { cleanNoteHtml } from '../noteHtml'

export type NoteRichTextProps = {
  content: string
  contentHtml?: string | null
  disabled: boolean
  onChange: (value: { content: string; contentHtml: string }) => void
}

export function NoteRichText({
  content,
  contentHtml,
  disabled,
  onChange,
}: NoteRichTextProps) {
  const host = useRef<HTMLDivElement>(null)
  const initial = useRef({ content, contentHtml })
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [editor, setEditor] = useState<Editor | null>(null)
  const [, rerender] = useState(0)
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    if (!host.current) return
    const instance = new Editor({
      element: host.current,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          link: {
            openOnClick: false,
            autolink: false,
            defaultProtocol: 'https',
          },
        }),
      ],
      content:
        initial.current.contentHtml != null
          ? cleanNoteHtml(initial.current.contentHtml)
          : plainNoteHtml(initial.current.content),
      parseOptions: { preserveWhitespace: 'full' },
      autofocus: 'end',
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-label': 'Note content',
          'aria-multiline': 'true',
          'data-placeholder': 'Take a note…',
          class: 'note-rich-text',
        },
      },
      onUpdate: ({ editor }) =>
        onChangeRef.current({
          content: editor.getText({ blockSeparator: '\n' }),
          contentHtml: editor.getHTML(),
        }),
      onTransaction: () => rerender((value) => value + 1),
    })
    setEditor(instance)
    return () => instance.destroy()
  }, [])

  useLayoutEffect(() => {
    // Changing editability is UI state, not a document edit.
    editor?.setEditable(!disabled, false)
  }, [editor, disabled])

  function openLink() {
    if (!editor) return
    setUrl(editor.getAttributes('link').href ?? '')
    setLinkError('')
    setLinkOpen(true)
  }
  function applyLink() {
    if (!editor || disabled) return
    const value = url.trim()
    if (!value) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      const href = /^[a-z][a-z\d+.-]*:/i.test(value)
        ? value
        : `https://${value}`
      if (!safeNoteLink(href)) {
        setLinkError('Use an https://, http://, or mailto: link.')
        return
      }
      const chain = editor.chain().focus().extendMarkRange('link')
      if (editor.state.selection.empty && !editor.isActive('link'))
        chain
          .insertContent({
            type: 'text',
            text: value,
            marks: [{ type: 'link', attrs: { href } }],
          })
          .run()
      else chain.setLink({ href }).run()
    }
    setLinkOpen(false)
  }

  const tools = editor
    ? [
        {
          label: 'Bold',
          icon: Bold,
          active: editor.isActive('bold'),
          run: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: 'Italic',
          icon: Italic,
          active: editor.isActive('italic'),
          run: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          label: 'Underline',
          icon: Underline,
          active: editor.isActive('underline'),
          run: () => editor.chain().focus().toggleUnderline().run(),
        },
        {
          label: 'Strikethrough',
          icon: Strikethrough,
          active: editor.isActive('strike'),
          run: () => editor.chain().focus().toggleStrike().run(),
        },
        {
          label: 'Heading',
          icon: Heading2,
          active: editor.isActive('heading', { level: 2 }),
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: 'Subheading',
          icon: Heading3,
          active: editor.isActive('heading', { level: 3 }),
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          label: 'Bullet list',
          icon: List,
          active: editor.isActive('bulletList'),
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: 'Numbered list',
          icon: ListOrdered,
          active: editor.isActive('orderedList'),
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          label: 'Quote',
          icon: Quote,
          active: editor.isActive('blockquote'),
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          label: 'Code block',
          icon: Code2,
          active: editor.isActive('codeBlock'),
          run: () => editor.chain().focus().toggleCodeBlock().run(),
        },
        {
          label: 'Link',
          icon: Link,
          active: editor.isActive('link'),
          run: openLink,
        },
        {
          label: 'Clear formatting',
          icon: RemoveFormatting,
          run: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
        },
        {
          label: 'Undo',
          icon: Undo2,
          disabled: !editor.can().undo(),
          run: () => editor.chain().focus().undo().run(),
        },
        {
          label: 'Redo',
          icon: Redo2,
          disabled: !editor.can().redo(),
          run: () => editor.chain().focus().redo().run(),
        },
      ]
    : []

  return (
    <div class="note-rich-editor">
      <fieldset class="note-formatting" aria-label="Text formatting">
        {tools.map(
          ({ label, icon: Icon, active, run, disabled: unavailable }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={active}
              disabled={disabled || unavailable}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                editor?.view.focus()
                run()
              }}
            >
              <Icon size={16} aria-hidden="true" />
            </button>
          ),
        )}
      </fieldset>
      {linkOpen && (
        <div class="note-link-editor">
          <input
            type="text"
            aria-label="Link URL"
            placeholder="https://example.com"
            autoFocus
            value={url}
            disabled={disabled}
            onInput={(event) => {
              setUrl(event.currentTarget.value)
              setLinkError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyLink()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                setLinkOpen(false)
                editor?.commands.focus()
              }
            }}
          />
          <button
            type="button"
            class="note-text-button"
            disabled={disabled}
            onClick={applyLink}
          >
            Apply link
          </button>
          <button
            type="button"
            class="note-text-button"
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().extendMarkRange('link').unsetLink().run()
              setLinkOpen(false)
            }}
          >
            Remove link
          </button>
          <button
            type="button"
            class="note-text-button"
            onClick={() => {
              setLinkOpen(false)
              editor?.commands.focus()
            }}
          >
            Cancel link
          </button>
          {linkError && (
            <span class="note-error" role="alert">
              {linkError}
            </span>
          )}
        </div>
      )}
      <div ref={host} />
    </div>
  )
}
