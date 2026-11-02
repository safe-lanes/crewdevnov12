import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function files(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? files(full) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [full] : [];
  });
}

describe("client native-dialog removal guard", () => {
  it("contains no native confirm, alert or prompt calls anywhere in the client", () => {
    const found: string[] = [];
    for (const file of files("client")) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const locallyDeclared = new Set<string>();
      function declarations(node: ts.Node) {
        if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name))
          locallyDeclared.add(node.name.text);
        ts.forEachChild(node, declarations);
      }
      declarations(source);
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
          const callee = node.expression.getText(source);
          if (/^(?:window|globalThis)\.(confirm|alert|prompt)$/.test(callee)
            || /^(confirm|alert|prompt)$/.test(callee) && !locallyDeclared.has(callee)) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            found.push(`${file}:${line + 1}: ${callee}`);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(found).toEqual([]);
  });
});
