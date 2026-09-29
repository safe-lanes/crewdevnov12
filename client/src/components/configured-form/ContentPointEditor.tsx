import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { normalizeWordPaste, pasteNotice } from "../../../../shared/v2/forms-engine/restrictedPaste";

/** The scratch editor's restricted extensions and clipboard handling, reused in the real form. */
export function ContentPointEditor({ html, onChange, disabled }: {
  html: string;
  onChange: (html: string) => void;
  disabled: boolean;
}) {
  const [notice, setNotice] = useState("");
  const removedOnPaste = useRef(false);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({
      heading: false, orderedList: false,
      blockquote: false, code: false, codeBlock: false, horizontalRule: false,
      italic: false, strike: false, underline: false, link: false,
      listKeymap: false,
    })],
    content: html,
    editorProps: {
      transformPastedHTML: (raw) => {
        const result = normalizeWordPaste(raw);
        removedOnPaste.current = result.removedFormatting;
        return result.html;
      },
      handlePaste: (_view, event) => {
        const raw = event.clipboardData?.getData("text/html") || "";
        if (raw) {
          setNotice(pasteNotice(removedOnPaste.current));
          return false;
        }
        const text = event.clipboardData?.getData("text/plain") || "";
        if (!text) return false;
        const doc = document.createElement("div");
        const paragraphs = text.split(/\r?\n/).map((line) => {
          doc.textContent = line;
          return `<p>${doc.innerHTML}</p>`;
        }).join("");
        const result = normalizeWordPaste(paragraphs);
        setNotice(pasteNotice(result.removedFormatting));
        editorRef.current?.commands.insertContent(result.html);
        return true;
      },
      handleKeyDown: (_view, event) => event.key === "Tab" && !!editorRef.current?.isActive("bulletList"),
    },
    onCreate: ({ editor }) => { editorRef.current = editor; },
    onDestroy: () => { editorRef.current = null; },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false });
  }, [editor, html]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);

  return (
    <div className="rounded-md border border-gray-200 bg-white" data-testid="content-point-editor">
      {!disabled && editor && (
        <div className="flex gap-2 border-b p-2" aria-label="Content formatting">
          <button type="button" onClick={() => editor.chain().focus().setParagraph().run()}>Paragraph</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>Bullets</button>
        </div>
      )}
      <EditorContent editor={editor} className="min-h-32 p-3 [&_.tiptap]:min-h-28 [&_.tiptap]:outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_p]:mb-2 [&_li_p]:mb-0" data-testid="content-point-input" />
      {notice && <p role="status" className="border-t bg-amber-50 px-3 py-2 text-sm" data-testid="content-paste-notice">{notice}</p>}
    </div>
  );
}