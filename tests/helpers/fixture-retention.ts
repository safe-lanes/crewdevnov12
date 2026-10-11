import pg from "pg";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

/**
 * Test-only teardown policy. Keep real DB constraint tests and application
 * mutations intact; never execute destructive SQL from cleanup/finally hooks.
 * Every suppressed teardown is visible in stdout and the fixture register.
 */
const ranges = new Map<string, Array<[number, number]>>();
function cleanupRanges(file: string): Array<[number, number]> {
  if (ranges.has(file)) return ranges.get(file)!;
  const found: Array<[number, number]> = [];
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const add = (node: ts.Node) => found.push([
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    source.getLineAndCharacterOfPosition(node.end).line + 1,
  ]);
  const visit = (node: ts.Node) => {
    if (ts.isTryStatement(node) && node.finallyBlock) add(node.finallyBlock);
    if (ts.isCallExpression(node) && /^(afterAll|afterEach)$/.test(node.expression.getText(source))) {
      node.arguments.forEach(arg => { if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) add(arg.body); });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  ranges.set(file, found);
  return found;
}

export function cleanupOrigin(stack: string): string | undefined {
  for (const line of stack.split("\n")) {
    const match = line.match(/((?:\/|file:\/\/\/)[^()]*\/tests\/[^():]+\.(?:ts|tsx)):(\d+):\d+/);
    if (!match) continue;
    const file = match[1].replace(/^file:\/\//, "");
    const number = Number(match[2]);
    if (fs.existsSync(file) && cleanupRanges(file).some(([a, b]) => number >= a && number <= b)) {
      return path.relative(process.cwd(), file);
    }
  }
  return undefined;
}

const registered = new Set<string>();
export function retainFixtureReferences(origin: string, references: unknown[]) {
  register(origin, "TABLE registered_fixture_context", references);
}
function register(origin: string, sql: string, values: unknown[]) {
  // Only UUIDs, never SQL literals, names, credentials or arbitrary parameters.
  const ids = [...new Set(values.flatMap(v => {
    const text = typeof v === "string" ? v : Array.isArray(v) ? v.join(" ") : "";
    return text.match(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi) ?? [];
  }))];
  const target = sql.match(/\b(?:FROM|TABLE|SCHEMA)\s+(?:IF\s+EXISTS\s+)?("?[\w.]+"?)/i)?.[1] ?? "cleanup context";
  const key = `${origin}:${target}:${ids.join(",")}`;
  if (registered.has(key)) return;
  registered.add(key);
  fs.appendFileSync("docs/company-form-regression-fixtures.md",
    `\n- Retained test context (${new Date().toISOString()}): ${origin}; target ${target}; ` +
    `references ${ids.length ? ids.map(id => `\`${id}\``).join(", ") : "schema/context retained (no UUID parameters)"}.\n`);
  console.warn(`[fixture-retention] Disabled destructive teardown in ${origin}; ${target}; ${ids.length} context identifiers registered`);
}

export function installFixtureRetention() {
  // Pool.query loses the originating caller when acquiring a client; guard
  // both entry points, not just Client.query.
  for (const prototype of [pg.Pool.prototype, pg.Client.prototype] as any[]) {
    if (prototype.__fixtureRetentionInstalled) continue;
    prototype.__fixtureRetentionInstalled = true;
    const original = prototype.query;
    prototype.query = function(...args: any[]) {
      const text: string = typeof args[0] === "string" ? args[0] : args[0]?.text ?? "";
      const origin = /\b(?:DELETE\s+FROM|UPDATE|INSERT\s+INTO|TRUNCATE|DROP\s+(?:SCHEMA|TABLE)|ALTER\s+TABLE)\b/i.test(text)
        ? cleanupOrigin(new Error().stack ?? "") : undefined;
      if (!origin) return original.apply(this, args);
      register(origin, text, (Array.isArray(args[1]) ? args[1] : args[0]?.values) ?? []);
      const result = { command: "RETAIN_FIXTURE", rowCount: 0, rows: [], fields: [] };
      const callback = [...args].reverse().find((arg: any) => typeof arg === "function");
      if (callback) { queueMicrotask(() => callback(null, result)); return undefined; }
      return Promise.resolve(result);
    };
  }
  for (const method of ["unlink", "rm", "rmdir"] as const) {
    const original = fs.promises[method] as any;
    (fs.promises as any)[method] = async function(...args: any[]) {
      const origin = cleanupOrigin(new Error().stack ?? "");
      if (!origin) return original.apply(this, args);
      register(origin, "TABLE retained_file_assets", [String(args[0])]);
      console.warn(`[fixture-retention] Kept linked file asset in ${origin}`);
    };
  }
}
