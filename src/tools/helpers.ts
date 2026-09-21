import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function textResult(value: unknown): CallToolResult {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? { ok: true }, null, 2);
  return { content: [{ type: "text", text }] };
}

export function errorResult(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * OpenSpace property URIs allow at most one '*' wildcard (tags like '{tag}' are separate and unlimited).
 * More than one '*' isn't caught by input validation on OpenSpace's side — it fails deep inside Lua as a
 * malformed-regex error, so check for it up front and fail with a clear message instead.
 */
export function assertSingleWildcard(uri: string): void {
  const count = (uri.match(/\*/g) ?? []).length;
  if (count > 1) {
    throw new Error(
      `Property URI '${uri}' has ${count} '*' wildcards, but OpenSpace allows at most one '*' per URI ` +
        "(tag selectors like '{tag}' don't count against this). Narrow it to a single '*', e.g. " +
        "'*PHA*.Renderable.Enabled' -> '*PHA.Renderable.Enabled' or 'PHA*.Renderable.Enabled'."
    );
  }
}

export async function toResult(work: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return textResult(await work());
  } catch (err) {
    return errorResult(err);
  }
}
