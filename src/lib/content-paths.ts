import type { FieldType } from "./cms-protocol";

/** Read a value out of a content object by a data-cms-field path. */
export function getByPath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const seg of tokenize(path)) {
    if (cur == null) return undefined;
    cur = (cur as Record<string | number, unknown>)[seg];
  }
  return cur;
}

function tokenize(path: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  for (const segment of path.split(".")) {
    const m = segment.match(/^([^[\]]*)((\[[^\]]*\])*)$/);
    if (!m) {
      tokens.push(segment);
      continue;
    }
    const [, key, brackets] = m;
    if (key) tokens.push(key);
    if (brackets) {
      for (const b of brackets.matchAll(/\[([^\]]*)\]/g)) {
        const inner = b[1];
        tokens.push(/^\d+$/.test(inner) ? Number(inner) : inner);
      }
    }
  }
  return tokens;
}

/** Human-readable label for a field path: "hero.title" → "Hero · Title". */
export function fieldLabel(path: string): string {
  return path
    .replace(/\[(\d+)\]/g, " #$1")
    .split(".")
    .map((s) =>
      s
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (c) => c.toUpperCase())
        .trim()
    )
    .join(" · ");
}

/** Best-effort guess of whether a value is an image based on the field/value. */
export function guessFieldType(field: string, value: unknown): FieldType {
  const v = typeof value === "string" ? value : "";
  if (/\.(png|jpe?g|gif|svg|webp|avif)(\?|$)/i.test(v)) return "image";
  if (/^data:image\//i.test(v)) return "image";
  if (/(image|img|cover|photo|logo|icon|avatar|banner|hero.*image)/i.test(field))
    return "image";
  return "text";
}

export function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
