import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Bold, ClassicEditor, Essentials, Heading, List, Paragraph, PasteFromOffice,
  Table as CKTable, TableToolbar,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import "./editor-comparison.css";

type EditorName = "ckeditor" | "tiptap";

const ckConfig = {
  licenseKey: "GPL" as const,
  plugins: [Essentials, Paragraph, Heading, Bold, List, CKTable, TableToolbar, PasteFromOffice],
  toolbar: ["undo", "redo", "|", "heading", "bold", "|", "bulletedList", "numberedList", "|", "insertTable"],
  heading: { options: [
    { model: "paragraph" as const, title: "Paragraph", class: "ck-heading_paragraph" },
    { model: "heading1" as const, view: "h1" as const, title: "Heading 1", class: "ck-heading_heading1" },
    { model: "heading2" as const, view: "h2" as const, title: "Heading 2", class: "ck-heading_heading2" },
    { model: "heading3" as const, view: "h3" as const, title: "Heading 3", class: "ck-heading_heading3" },
    { model: "heading4" as const, view: "h4" as const, title: "Heading 4", class: "ck-heading_heading4" },
  ] },
  table: { contentToolbar: ["tableRow", "tableColumn"] },
};

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
        <span className="pane-note">Proposed HTML allowlist · no attributes</span>
      </div>
      {error ? <p role="alert" className="error">{error}</p> : (
        <>
          <div className="result-content" dangerouslySetInnerHTML={{ __html: html }} />
          <details>
            <summary>Inspect sanitized HTML</summary>
            <pre>{html}</pre>
          </details>
        </>
      )}
    </div>
  );
}

function TiptapPane({ onChange }: { onChange: (html: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        blockquote: false, code: false, codeBlock: false, horizontalRule: false,
        italic: false, strike: false, underline: false, link: false,
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: "<p>Paste your Word document here.</p>",
    onCreate: ({ editor }) => onChange(editor.getHTML()),
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const action = useCallback((run: () => void) => () => {
    editor?.chain().focus().run();
    run();
  }, [editor]);

  if (!editor) return <p>Loading Tiptap…</p>;
  const button = (label: string, command: () => void, active = false) => (
    <button key={label} type="button" className={active ? "active" : ""} onClick={action(command)}>{label}</button>
  );
  return (
    <>
      <div className="toolbar" aria-label="Tiptap formatting">
        {button("Paragraph", () => editor.chain().focus().setParagraph().run(), editor.isActive("paragraph"))}
        {[1, 2, 3, 4].map((level) => button(`H${level}`, () => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run(), editor.isActive("heading", { level })))}
        {button("Bold", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {button("Bullets", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {button("Numbers", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {button("Table", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      </div>
      <EditorContent editor={editor} className="tiptap-editor" />
    </>
  );
}

function Comparison() {
  const [ckRaw, setCkRaw] = useState("");
  const [tiptapRaw, setTiptapRaw] = useState("");
  return (
    <main>
      <header>
        <div className="eyebrow">Isolated scratch page · development only</div>
        <h1>Word paste comparison</h1>
        <p>Paste the same text from Word into each editor. The result at right is sent to the server, sanitized using the proposed allowlist, and returned for display. Nothing is saved to a form or database.</p>
      </header>
      <section className="comparison">
        <h2>01 <span>CKEditor 5</span></h2>
        <p className="description">Open-source build with Paste from Office. GPL licensing applies.</p>
        <div className="panes">
          <div className="editor-pane">
            <div className="pane-heading">Paste from Word here</div>
            <CKEditor
              editor={ClassicEditor}
              config={ckConfig}
              data="<p>Paste your Word document here.</p>"
              onReady={(editor) => setCkRaw(editor.getData())}
              onChange={(_event, editor) => setCkRaw(editor.getData())}
            />
          </div>
          <Output raw={ckRaw} />
        </div>
      </section>
      <section className="comparison">
        <h2>02 <span>Tiptap</span></h2>
        <p className="description">MIT-licensed editor with table support; no dedicated Word-paste plugin in this configuration.</p>
        <div className="panes">
          <div className="editor-pane">
            <div className="pane-heading">Paste from Word here</div>
            <TiptapPane onChange={setTiptapRaw} />
          </div>
          <Output raw={tiptapRaw} />
        </div>
      </section>
      <footer>Allowed: paragraphs, line breaks, headings 1–4, bold, bullet and numbered lists, and simple tables. All HTML attributes, images, links, styles, and merged-cell spans are removed by the server. Wide tables scroll horizontally.</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Comparison />);