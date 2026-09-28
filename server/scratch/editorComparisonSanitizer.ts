import sanitizeHtml from "sanitize-html";

// Deliberately narrower than sanitize-html's defaults. This scratch endpoint
// uses the same proposed policy for both editors; it is not a form write path.
export const comparisonAllowedTags = [
  "p", "br", "h1", "h2", "h3", "h4", "strong",
  "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
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
  });
}