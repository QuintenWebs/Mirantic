/**
 * Helpers for reading/writing values in a content.json object by a
 * `data-cms-field` path string.
 *
 * Supported path syntax:
 *   "hero.title"            → content.hero.title
 *   "blog.posts[2].title"   → content.blog.posts[2].title
 *   "blog.posts[+]"         → append to content.blog.posts (new blog post)
 */

export type PathToken = string | number | "+";

export function parsePath(path: string): PathToken[] {
  const tokens: PathToken[] = [];
  for (const segment of path.split(".")) {
    // Match a key followed by zero or more [index] / [+] groups.
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
        if (inner === "+") tokens.push("+");
        else if (/^\d+$/.test(inner)) tokens.push(Number(inner));
        else tokens.push(inner);
      }
    }
  }
  return tokens;
}

export function getByPath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const token of parsePath(path)) {
    if (cur == null) return undefined;
    if (token === "+") return undefined;
    cur = (cur as Record<string | number, unknown>)[token];
  }
  return cur;
}

/**
 * Set a value at the given path, creating intermediate objects/arrays as
 * needed. A trailing "+" token appends `value` to the target array.
 * Returns the (possibly new) root.
 */
export function setByPath(root: unknown, path: string, value: unknown): unknown {
  const tokens = parsePath(path);
  if (tokens.length === 0) return value;

  const rootObj: Record<string | number, unknown> =
    root && typeof root === "object" ? (root as Record<string | number, unknown>) : {};

  let cur: Record<string | number, unknown> | unknown[] = rootObj;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isLast = i === tokens.length - 1;
    const nextToken = tokens[i + 1];

    if (token === "+") {
      // Append to the current array.
      if (!Array.isArray(cur)) throw new Error(`Cannot append to non-array at ${path}`);
      cur.push(value);
      return rootObj;
    }

    if (isLast) {
      (cur as Record<string | number, unknown>)[token] = value;
      return rootObj;
    }

    // Ensure the container for the next token exists and is the right kind.
    const wantArray = typeof nextToken === "number" || nextToken === "+";
    const existing = (cur as Record<string | number, unknown>)[token];
    if (wantArray) {
      if (!Array.isArray(existing)) (cur as Record<string | number, unknown>)[token] = [];
    } else {
      if (existing == null || typeof existing !== "object") {
        (cur as Record<string | number, unknown>)[token] = {};
      }
    }
    cur = (cur as Record<string | number, unknown>)[token] as
      | Record<string | number, unknown>
      | unknown[];
  }
  return rootObj;
}

export interface ChangeToApply {
  field: string;
  changeType: "field" | "blog_post_add";
  newValue: unknown;
}

/** Apply an ordered list of pending changes onto a content object (mutates a clone). */
export function applyChanges(content: unknown, changes: ChangeToApply[]): unknown {
  let result = content ? JSON.parse(JSON.stringify(content)) : {};
  for (const change of changes) {
    result = setByPath(result, change.field, change.newValue);
  }
  return result;
}
