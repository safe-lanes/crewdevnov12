import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeWordPaste, pasteNotice, REMOVAL_NOTICE } from "../../../client/scratch/restrictedPaste";
import { comparisonAllowedTags, sanitizeComparisonHtml } from "../../../server/scratch/editorComparisonSanitizer";

describe("restricted Word paste", () => {
  it("retains every nonempty paragraph of the first real Word clipboard fixture", () => {
    const raw = readFileSync("tests/fixtures/word-paste-1.html", "utf8");
    const original = new DOMParser().parseFromString(raw, "text/html");
    const result = normalizeWordPaste(raw);
    const cleaned = new DOMParser().parseFromString(result.html, "text/html");
    const text = (value: string) => value.replace(/[\s\u00a0]+/gu, " ").trim();
    const originalBlocks = Array.from(original.body.querySelectorAll("p"))
      .map((p) => text(p.textContent || "").replace(/^[·•▪o§–\-*] /u, ""))
      .filter(Boolean);
    const cleanedBlocks = Array.from(cleaned.body.querySelectorAll("p, li"))
      .map((block) => text(block.textContent || ""));

    expect(originalBlocks).toHaveLength(21);
    expect(cleanedBlocks).toEqual(originalBlocks);
    expect(cleaned.querySelectorAll("ul")).toHaveLength(1);
    expect(cleaned.querySelectorAll("ul > li")).toHaveLength(7);
    expect(cleaned.querySelectorAll("li ul, li ol")).toHaveLength(0);
    expect(Array.from(cleaned.querySelectorAll("p, li")).every((node) => !!node.textContent?.trim())).toBe(true);
    expect(cleaned.querySelectorAll("table, img, a, ol, h1, h2, h3")).toHaveLength(0);
    expect(original.querySelectorAll("table")).toHaveLength(0); // Tables require fixture 2.
    for (const number of [1, 2, 3]) {
      expect(cleanedBlocks.filter((block) => block.startsWith(`${number}. `))).toHaveLength(1);
    }
    expect(cleanedBlocks.every((block) => !/[\s\u00a0]{2}/u.test(block))).toBe(true);
    expect(result.html).not.toContain("\t");
    expect(result.removedFormatting).toBe(true);
    expect(sanitizeComparisonHtml(result.html)).toBe(result.html);
  });

  it("retains all nine numbered statements row by row in the second real Word clipboard fixture", () => {
    const raw = readFileSync("tests/fixtures/word-paste-2.html", "utf8");
    const source = new DOMParser().parseFromString(raw, "text/html");
    const result = normalizeWordPaste(raw);
    const cleaned = new DOMParser().parseFromString(result.html, "text/html");
    const sanitized = sanitizeComparisonHtml(result.html);
    const text = (value: string) => value.replace(/[\s\u00a0]+/gu, " ").trim();
    const sourceRows = Array.from(source.querySelectorAll("table tr"));
    const cleanedParagraphs = Array.from(cleaned.querySelectorAll("p")).map((p) => text(p.textContent || ""));

    expect(source.querySelectorAll("table")).toHaveLength(1);
    expect(sourceRows).toHaveLength(10); // Header plus nine statements.
    expect(sourceRows[0].textContent).toContain("Yes");
    expect(sourceRows[0].textContent).toContain("No");
    expect(cleanedParagraphs).toContain("Yes No"); // Do not special-case the header.
    for (const [index, row] of sourceRows.entries()) {
      const cellText = Array.from(row.children)
        .filter((cell) => cell.matches("th,td"))
        .map((cell) => text(cell.textContent || ""))
        .filter(Boolean)
        .join(" ");
      expect(cleanedParagraphs.filter((paragraph) => paragraph === cellText)).toHaveLength(1);
      if (index > 0) {
        expect(cellText).toMatch(new RegExp(`^${index}\\. \\S`));
        expect(cleanedParagraphs).not.toContain(`${index}.`);
      }
    }
    expect(cleanedParagraphs).toContain(
      "1. All items contained in my employment contract have been explained to me and I am aware of them.",
    );
    expect(cleanedParagraphs.filter((paragraph) => /^[1-9]\. \S/u.test(paragraph))).toHaveLength(9);
    expect(cleanedParagraphs.every((paragraph) => !/[\s\u00a0]{2}/u.test(paragraph))).toBe(true);
    expect(result.removedFormatting).toBe(true);
    expect(pasteNotice(result.removedFormatting)).toBe(REMOVAL_NOTICE);
    expect(sanitized).toBe(result.html);
    expect(sanitized).not.toMatch(/<(?:table|thead|tbody|tr|th|td)\b/i);
    expect(cleaned.querySelectorAll("table,th,td")).toHaveLength(0);
  });

  it.each(["·", "•", "▪", "o", "§", "–", "-", "*"])(
    "turns consecutive %s marker paragraphs into real flat list items",
    (marker) => {
      const result = normalizeWordPaste(
        `<p>${marker}&nbsp; First statement</p><p>${marker}     <b>Second</b> statement</p><p>After</p>`,
      );
      expect(result.html).toBe("<ul><li>First statement</li><li><strong>Second</strong> statement</li></ul><p>After</p>");
    },
  );

  it("flattens nested lists and joins each table row into one paragraph", () => {
    const result = normalizeWordPaste(
      `<ul><li>Parent<ul><li>Child</li></ul></li></ul>
       <table><tr><th><p>Policy title</p></th><td><p>Policy text</p><p></p></td></tr></table>
       <table><tr><td></td></tr></table><p><br></p><img src="x" alt="Diagram description">
       <p><span style="font-weight:bold">Bold text</span> and <a href="https://example.com">link text</a></p>`,
    );
    expect(result.html).toBe(
      "<ul><li>Parent</li><li>Child</li></ul>" +
      "<p>Policy title Policy text</p><p>Diagram description</p>" +
      "<p><strong>Bold text</strong> and link text</p>",
    );
    expect(result.removedFormatting).toBe(true);
    expect(result.html).not.toMatch(/<(?:table|img|a|h[1-6]|ol)\b/i);
  });

  it("joins a number and its statement from separate Word cells, without special-casing the header", () => {
    const result = normalizeWordPaste(
      `<table><tr><th><p>Yes</p></th><th><p>No</p></th></tr>
       <tr><td><p>1. &nbsp; </p></td><td><p>All items contained in my employment contract have been explained
       to me and I am aware of them.</p></td></tr>
       <tr><td>2.</td><td><p>Second <strong>statement</strong></p></td></tr>
       <tr><td> </td><td><p><br></p></td></tr></table>
       <table><tr><td></td></tr></table>`,
    );
    expect(result.html).toBe(
      "<p>Yes No</p>" +
      "<p>1. All items contained in my employment contract have been explained to me and I am aware of them.</p>" +
      "<p>2. Second <strong>statement</strong></p>",
    );
    expect(result.removedFormatting).toBe(true);
    expect(sanitizeComparisonHtml(result.html)).toBe(result.html);
    expect(result.html).not.toMatch(/<(?:table|tr|th|td)\b/i);
  });

  it("keeps text but drops dangerous markup before the server allowlist", () => {
    const result = normalizeWordPaste(
      "<h2>Heading text</h2><p>Before<script>alert(1)</script> after</p><p>End</p>",
    );
    expect(result.html).toBe("<p>Heading text</p><p>Before after</p><p>End</p>");
    expect(result.removedFormatting).toBe(true);
  });
});

describe("scratch server allowlist", () => {
  it("contains exactly the five specified tags and no attributes", () => {
    expect(comparisonAllowedTags).toEqual(["p", "br", "strong", "ul", "li"]);
    const result = sanitizeComparisonHtml(
      '<h2 style="color:red">Title</h2><p class="x"><b onclick="bad()">Bold</b>' +
      '<a href="https://example.com">link</a></p><ul id="x"><li>Item</li></ul>' +
      "<table><tr><td>Cell</td></tr></table><script>alert(1)</script><p><br></p>",
    );
    expect(result).toContain("<strong>Bold</strong>");
    expect(result).toContain("<ul><li>Item</li></ul>");
    expect(result).toContain("Cell");
    expect(result).not.toMatch(/(?:<h2|<table|<a|style=|class=|href=|onclick=|<script|alert\(1\)|<p><br><\/p>)/);
  });
});