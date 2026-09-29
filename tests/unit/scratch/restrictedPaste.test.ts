import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeWordPaste } from "../../../client/scratch/restrictedPaste";
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

  it.each(["·", "•", "▪", "o", "§", "–", "-", "*"])(
    "turns consecutive %s marker paragraphs into real flat list items",
    (marker) => {
      const result = normalizeWordPaste(
        `<p>${marker}&nbsp; First statement</p><p>${marker}     <b>Second</b> statement</p><p>After</p>`,
      );
      expect(result.html).toBe("<ul><li>First statement</li><li><strong>Second</strong> statement</li></ul><p>After</p>");
    },
  );

  it("flattens nested lists and preserves table cell text as paragraphs", () => {
    const result = normalizeWordPaste(
      `<ul><li>Parent<ul><li>Child</li></ul></li></ul>
       <table><tr><th><p>Policy title</p></th><td><p>Policy text</p><p></p></td></tr></table>
       <table><tr><td></td></tr></table><p><br></p><img src="x" alt="Diagram description">
       <p><span style="font-weight:bold">Bold text</span> and <a href="https://example.com">link text</a></p>`,
    );
    expect(result.html).toBe(
      "<ul><li>Parent</li><li>Child</li></ul>" +
      "<p>Policy title</p><p>Policy text</p><p>Diagram description</p>" +
      "<p><strong>Bold text</strong> and link text</p>",
    );
    expect(result.removedFormatting).toBe(true);
    expect(result.html).not.toMatch(/<(?:table|img|a|h[1-6]|ol)\b/i);
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