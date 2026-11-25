import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { callFunction, luaFn, runScript } from '../openspaceClient.js';

import { toResult } from './helpers.js';

const SCENE_GRAPH_NODES = luaFn('openspace.sceneGraphNodes');
const ASSET_ADD = luaFn('openspace.asset.add');
const ASSET_REMOVE = luaFn('openspace.asset.remove');
const ABS_PATH = luaFn('openspace.absPath');
const DIRECTORY_EXISTS = luaFn('openspace.directoryExists');
const WALK_DIRECTORY_FILES = luaFn('openspace.walkDirectoryFiles');

/** Path tokens for the two asset roots OpenSpace loads assets from. */
/* eslint-disable no-template-curly-in-string -- OpenSpace path tokens, not templates */
const ASSET_ROOTS: Record<'data' | 'user', string> = {
  data: '${ASSETS}',
  user: '${USER_ASSETS}'
};
/* eslint-enable no-template-curly-in-string */

/** Escape a string for safe embedding as a double-quoted Lua string literal. */
function luaStringLiteral(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\0/g, '\\0');
  return `"${escaped}"`;
}

/**
 * Builds a Lua script that walks the given asset root(s) for `.asset` files. With an empty filter, it
 * groups matches by root + top-level folder and returns counts (a table of contents). With a non-empty
 * filter, it returns every matching asset's identifier (usable with asset_add), source, and absolute path.
 * The filter is embedded as an escaped Lua string literal and only ever used with `string.find(..., true)`
 * (plain-text search), so it can't be used to inject Lua code.
 */
function buildListAssetsScript(filter: string, roots: Array<'data' | 'user'>): string {
  const filterLiteral = luaStringLiteral(filter.toLowerCase());
  const collectCalls = roots
    .map(
      (source) =>
        `collect(${ABS_PATH}(${luaStringLiteral(ASSET_ROOTS[source])}), "${source}")`
    )
    .join('\n');

  return `
local filter = ${filterLiteral}

local function relativize(root, path)
  local rel = path
  if string.sub(path, 1, string.len(root)) == root then
    rel = string.sub(path, string.len(root) + 1)
  end
  rel = string.gsub(rel, "\\\\", "/")
  rel = string.gsub(rel, "^/+", "")
  rel = string.gsub(rel, "%.asset$", "")
  return rel
end

local function topSegment(rel)
  return string.match(rel, "^([^/]+)") or rel
end

local matches = {}
local groups = {}

local function collect(root, source)
  if root == "" or not ${DIRECTORY_EXISTS}(root) then
    return
  end
  local files = ${WALK_DIRECTORY_FILES}(root, true, true)
  for _, f in pairs(files) do
    if string.sub(string.lower(f), -6) == ".asset" then
      local rel = relativize(root, f)
      if filter == "" then
        local seg = source .. ":" .. topSegment(rel)
        groups[seg] = (groups[seg] or 0) + 1
      elseif string.find(string.lower(rel), filter, 1, true) then
        table.insert(matches, { identifier = rel, source = source, absolutePath = f })
      end
    end
  end
end

${collectCalls}

if filter == "" then
  return groups
else
  return matches
end
`;
}

export function registerSceneTools(server: McpServer): void {
  server.registerTool(
    'list_scene_graph_nodes',
    {
      title: 'List scene graph nodes',
      description:
        'List the identifiers of all scene graph nodes currently loaded in OpenSpace.',
      inputSchema: {}
    },
    () => toResult(() => callFunction(SCENE_GRAPH_NODES, []))
  );

  server.registerTool(
    'asset_add',
    {
      title: 'Load asset',
      description:
        "Load (add) an OpenSpace asset by its path/name, e.g. 'scene/solarsystem/planets/mars/mars'.",
      inputSchema: {
        path: z.string().describe('Asset path or name to load.')
      }
    },
    (args) => toResult(() => callFunction(ASSET_ADD, [args.path]))
  );

  server.registerTool(
    'asset_remove',
    {
      title: 'Unload asset',
      description:
        'Unload (remove) a previously loaded OpenSpace asset by its path/name.',
      inputSchema: {
        path: z.string().describe('Asset path or name to unload.')
      }
    },
    (args) => toResult(() => callFunction(ASSET_REMOVE, [args.path]))
  );

  server.registerTool(
    'list_assets',
    {
      title: 'List available assets',
      description:
        "List OpenSpace '.asset' files available to load with asset_add, searching the bundled data assets " +
        // eslint-disable-next-line no-template-curly-in-string -- OpenSpace path tokens
        "folder ('${ASSETS}') and/or the user assets folder ('${USER_ASSETS}'). With no filter, returns a " +
        'table-of-contents summary: counts of matching assets grouped by source and top-level folder. With ' +
        'a filter, returns the full list of matching assets (an identifier usable with asset_add, the ' +
        'source, and the absolute file path) whose path contains the filter (case-insensitive substring ' +
        "match). Use this to discover an asset's exact path before calling asset_add.",
      inputSchema: {
        filter: z
          .string()
          .optional()
          .describe(
            "Case-insensitive substring to match against asset paths, e.g. 'asteroid' or 'mars'. Omit to " +
              'get a table-of-contents summary instead of the full list.'
          ),
        source: z
          .enum(['data', 'user', 'both'])
          .optional()
          .describe(
            "Which asset root(s) to search: bundled 'data', 'user', or 'both' (default)."
          )
      }
    },
    (args) => {
      const roots: Array<'data' | 'user'> =
        args.source === 'data'
          ? ['data']
          : args.source === 'user'
            ? ['user']
            : ['data', 'user'];
      return toResult(() => runScript(buildListAssetsScript(args.filter ?? '', roots)));
    }
  );
}
