/** Development-only clipboard conversion for the restricted Content experiment. */
export const REMOVAL_NOTICE =
  "Tables and images were removed. For statements the seafarer must answer, use Yes/No points.";

export interface PasteResult {
  html: string;
  removedFormatting: boolean;
}

type Block = { kind: "paragraph" | "bullet"; content: DocumentFragment };

const BULLET_PREFIX = /^[\s\u00a0]*[·•▪o§–\-*][\s\u00a0]+/u;
const DISCARD_CONTENT = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "META", "LINK",
  "SVG", "MATH", "IFRAME", "OBJECT", "EMBED",
]);
const BLOCK_TAGS = new Set([
  "P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE",
  "UL", "OL", "TABLE", "PRE", "SECTION", "ARTICLE", "HEADER", "FOOTER",
]);
const REMOVED_FORMATTING = new Set([
  "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "OL", "TABLE",
  "IMG", "A", "EM", "I", "U", "S", "STRIKE", "PRE", "HR", "FIGURE",
]);

function meaningful(fragment: DocumentFragment): boolean {
  return !!fragment.textContent?.replace(/\u200b/g, "").trim();
}

function stripPrefix(fragment: DocumentFragment, length: number, doc: Document): void {
  const walker = doc.createTreeWalker(fragment, 4 /* SHOW_TEXT */);
  let remaining = length;
  while (remaining > 0) {
    const node = walker.nextNode();
    if (!node) break;
    const text = node.textContent || "";
    const used = Math.min(remaining, text.length);
    node.textContent = text.slice(used);
    remaining -= used;
  }
}

function normalizeWhitespace(fragment: DocumentFragment, doc: Document): void {
  const walker = doc.createTreeWalker(fragment, 4 /* SHOW_TEXT */);
  const nodes: Node[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node);
  let previousEndsWithSpace = false;
  for (const textNode of nodes) {
    let text = (textNode.textContent || "").replace(/[\s\u00a0]+/gu, " ");
    if (previousEndsWithSpace) text = text.replace(/^ /, "");
    textNode.textContent = text;
    if (text) previousEndsWithSpace = text.endsWith(" ");
  }
  const populated = nodes.filter((textNode) => !!textNode.textContent);
  if (populated.length) {
    populated[0].textContent = (populated[0].textContent || "").replace(/^ /, "");
    const last = populated[populated.length - 1];
    last.textContent = (last.textContent || "").replace(/ $/, "");
  }
}

export function normalizeWordPaste(rawHtml: string): PasteResult {
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  const blocks: Block[] = [];
  let removedFormatting = false;

  function inline(node: Node, parent: Node): void {
    if (node.nodeType === 3) {
      parent.appendChild(doc.createTextNode(node.textContent || ""));
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const tag = element.tagName.toUpperCase();
    if (element.hasAttribute("style") || element.hasAttribute("class") || element.attributes.length > 0) {
      // An allowed bold tag has no formatting to remove unless it has attributes.
      removedFormatting ||= element.attributes.length > 0;
    }
    if (DISCARD_CONTENT.has(tag)) {
      removedFormatting = true;
      return;
    }
    if (tag === "IMG") {
      removedFormatting = true;
      const alt = element.getAttribute("alt");
      if (alt) parent.appendChild(doc.createTextNode(alt));
      return;
    }
    if (tag === "BR") {
      parent.appendChild(doc.createElement("br"));
      return;
    }
    if (REMOVED_FORMATTING.has(tag) || (tag !== "STRONG" && tag !== "B" && tag !== "SPAN")) {
      removedFormatting = true;
    }
    const bold = tag === "STRONG" || tag === "B" ||
      /(?:^|;)\s*font-weight\s*:\s*(?:bold|[6-9]00)\b/i.test(element.getAttribute("style") || "");
    const container = bold ? doc.createElement("strong") : parent;
    for (const child of Array.from(element.childNodes)) inline(child, container);
    if (bold) parent.appendChild(container);
  }

  function addParagraph(content: DocumentFragment, list = false): void {
    if (!meaningful(content)) return;
    normalizeWhitespace(content, doc);
    const prefix = (content.textContent || "").match(BULLET_PREFIX);
    if (prefix) {
      stripPrefix(content, prefix[0].length, doc);
      list = true;
    }
    if (meaningful(content)) blocks.push({ kind: list ? "bullet" : "paragraph", content });
  }

  function addInline(nodes: Node[], list = false): void {
    const content = doc.createDocumentFragment();
    for (const node of nodes) inline(node, content);
    addParagraph(content, list);
  }

  function listItems(list: Element, bullet: boolean): void {
    if (!bullet) removedFormatting = true;
    for (const child of Array.from(list.children)) {
      if (child.tagName.toUpperCase() !== "LI") continue;
      const content = Array.from(child.childNodes).filter(
        (node) => node.nodeType !== 1 || !["UL", "OL"].includes((node as Element).tagName.toUpperCase()),
      );
      addInline(content, bullet);
      for (const nested of Array.from(child.children)) {
        if (nested.tagName.toUpperCase() === "UL" || nested.tagName.toUpperCase() === "OL") {
          listItems(nested, nested.tagName.toUpperCase() === "UL");
        }
      }
    }
  }

  function children(parent: Element): void {
    let pending: Node[] = [];
    const flush = () => {
      if (pending.length) addInline(pending);
      pending = [];
    };
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType !== 1 || !BLOCK_TAGS.has((node as Element).tagName.toUpperCase())) {
        pending.push(node);
      } else {
        flush();
        block(node as Element);
      }
    }
    flush();
  }

  function block(element: Element): void {
    const tag = element.tagName.toUpperCase();
    if (element.attributes.length > 0 || REMOVED_FORMATTING.has(tag)) removedFormatting = true;
    if (tag === "TABLE") {
      // Keep each row together, including its number and statement in separate
      // cells. Empty rows and tables contribute no paragraph.
      for (const row of Array.from(element.querySelectorAll("tr"))) {
        const rowContent = doc.createDocumentFragment();
        for (const cell of Array.from(row.children)) {
          if (!cell.matches("th,td")) continue;
          const cellContent = doc.createDocumentFragment();
          for (const child of Array.from(cell.childNodes)) {
            if (child.nodeType === 1 && BLOCK_TAGS.has((child as Element).tagName.toUpperCase())) {
              // Word can put several paragraphs in one cell. Separate their
              // text while retaining any bold inline content.
              cellContent.appendChild(doc.createTextNode(" "));
              inline(child, cellContent);
              cellContent.appendChild(doc.createTextNode(" "));
            } else {
              inline(child, cellContent);
            }
          }
          normalizeWhitespace(cellContent, doc);
          if (!meaningful(cellContent)) continue;
          if (meaningful(rowContent)) rowContent.appendChild(doc.createTextNode(" "));
          rowContent.appendChild(cellContent);
        }
        addParagraph(rowContent);
      }
      return;
    }
    if (tag === "UL" || tag === "OL") {
      listItems(element, tag === "UL");
      return;
    }
    if (tag === "P" || /^H[1-6]$/.test(tag) || tag === "BLOCKQUOTE" || tag === "PRE") {
      addInline(Array.from(element.childNodes));
      return;
    }
    children(element);
  }

  children(doc.body);

  const result = doc.createElement("div");
  let currentList: HTMLUListElement | null = null;
  for (const item of blocks) {
    if (item.kind === "bullet") {
      if (!currentList) {
        currentList = doc.createElement("ul");
        result.appendChild(currentList);
      }
      const li = doc.createElement("li");
      li.appendChild(item.content);
      currentList.appendChild(li);
    } else {
      currentList = null;
      const p = doc.createElement("p");
      p.appendChild(item.content);
      result.appendChild(p);
    }
  }
  return { html: result.innerHTML, removedFormatting };
}