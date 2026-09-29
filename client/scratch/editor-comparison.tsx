import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { normalizeWordPaste, pasteNotice } from "./restrictedPaste";
import "./editor-comparison.css";

function useSanitizedOutput(raw: string) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const sequence = useRef(0);

  useEffect(() => {
    const current = ++sequence.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/scratch/editor-comparison/sanitize", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: raw,
        });
        if (!response.ok) throw new Error(`Sanitizer returned ${response.status}`);
        const result: { html: string } = await response.json();
        if (current === sequence.current) {
          setHtml(result.html);
          setError("");
        }
      } catch (cause) {
        if (current === sequence.current) {
          setHtml("");
          setError(cause instanceof Error ? cause.message : "Sanitization failed");
        }
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [raw]);

  return { html, error };
}

function Output({ raw }: { raw: string }) {
  const { html, error } = useSanitizedOutput(raw);
  return (
    <div className="output-pane">
      <div className="pane-heading">
        <span>Server-sanitized result</span>
        <span className="pane-note">p · br · strong · ul · li · no attributes</span>
      </div>
      {error ? <p role="alert" className="error">{error}</p> : (
        <>
          <div className="result-content restricted-content" data-testid="sanitized-result" dangerouslySetInnerHTML={{ __html: html }} />
          <details>
            <summary>Inspect sanitized HTML</summary>
            <pre>{html}</pre>
          </details>
        </>
      )}
    </div>
  );
}

function ScratchEditor() {
  const [editorHtml, setEditorHtml] = useState("");
  const [rawClipboardHtml, setRawClipboardHtml] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const removedOnPaste = useRef(false);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false, orderedList: false,
        blockquote: false, code: false, codeBlock: false, horizontalRule: false,
        italic: false, strike: false, underline: false, link: false,
        listKeymap: false,
      }),
    ],
    content: "",
    editorProps: {
      transformPastedHTML: (html) => {
        const result = normalizeWordPaste(html);
        removedOnPaste.current = result.removedFormatting;
        return result.html;
      },
      handlePaste: (_view, event) => {
        const raw = event.clipboardData?.getData("text/html") || "";
        setRawClipboardHtml(raw || null);
        if (raw) {
          setNotice(pasteNotice(removedOnPaste.current));
          return false; // ProseMirror inserts the transformed HTML slice.
        }
        const text = event.clipboardData?.getData("text/plain") || "";
        if (!text) return false;
        // Plain-text clipboard fallback, so marker paragraphs still become
        // bullets when a Word/browser combination supplies no HTML.
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
      handleKeyDown: (_view, event) => {
        // No manual nesting of bullet lists on this restricted editor.
        return event.key === "Tab" && !!editorRef.current?.isActive("bulletList");
      },
    },
    onCreate: ({ editor }) => {
      editorRef.current = editor;
      setEditorHtml(editor.getHTML());
    },
    onDestroy: () => { editorRef.current = null; },
    onUpdate: ({ editor }) => setEditorHtml(editor.getHTML()),
  });

  function downloadRawPaste() {
    if (rawClipboardHtml === null) return;
    const url = URL.createObjectURL(new Blob([rawClipboardHtml], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "word-clipboard-raw.html";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main>
      <header>
        <div className="eyebrow">Isolated scratch page · development only</div>
        <h1>Restricted Word paste test</h1>
        <p>Paste from Word into the Tiptap editor. Bullets should appear in the editor immediately; the panel beside it shows what the server's five-tag sanitizer returns. Nothing is saved to a form or database.</p>
      </header>
      <div className="capture">
        <div>
          <strong>Raw clipboard HTML stays in this browser.</strong>
          <p>After pasting, download the raw HTML and attach that file in chat so it can become the real Word-paste test fixture. The raw clipboard HTML is not sent to the server or written to logs.</p>
        </div>
        <button type="button" onClick={downloadRawPaste} disabled={!rawClipboardHtml}>Download raw paste HTML</button>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
      <div className="panes">
        <div className="editor-pane">
          <div className="pane-heading">Tiptap · paste from Word here</div>
          {editor ? (
            <>
              <div className="toolbar" aria-label="Tiptap formatting">
                <button type="button" onClick={() => editor.chain().focus().setParagraph().run()}>Paragraph</button>
                <button type="button" className={editor.isActive("bold") ? "active" : ""} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
                <button type="button" className={editor.isActive("bulletList") ? "active" : ""} onClick={() => editor.chain().focus().toggleBulletList().run()}>Bullets</button>
              </div>
              <EditorContent editor={editor} className="tiptap-editor restricted-content" />
            </>
          ) : <p className="loading">Loading editor…</p>}
        </div>
        <Output raw={editorHtml} />
      </div>
      <footer>Only paragraphs, line breaks, bold and flat bullet lists are supported. Each nonempty table row becomes one ordinary paragraph; images, styling and other unsupported formatting are removed. The production application does not serve this page.</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ScratchEditor />);