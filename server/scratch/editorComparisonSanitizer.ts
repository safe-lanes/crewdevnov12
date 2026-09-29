import sanitizeHtml from "sanitize-html";

// Development-only policy for the restricted Tiptap paste test. Production
// form writes do not use this endpoint.
export const comparisonAllowedTags = [
  "p", "br", "strong", "ul", "li",
];

export function sanitizeComparisonHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: comparisonAllowedTags,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    nonTextTags: ["style", "script", "textarea", "option", "noscript", "iframe", "object", "embed", "svg", "math"],
    transformTags: {
      b: "strong",
    },
    exclusiveFilter: (frame) =>
      (frame.tag === "p" || frame.tag === "li") && !frame.text.trim(),
  });
}