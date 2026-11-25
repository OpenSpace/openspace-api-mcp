import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JsonValue } from 'openspace-api-js/types';
import { z } from 'zod';

import { callFunction, getProperty, luaFn, setProperty } from '../openspaceClient.js';

import { assertSingleWildcard, toResult } from './helpers.js';

const PROPERTY = luaFn('openspace.property');

export function registerPropertyTools(server: McpServer): void {
  server.registerTool(
    'get_property',
    {
      title: 'Get scene graph property',
      description:
        'Get the value (and metadata) of a scene graph property or property owner by its URI, ' +
        "e.g. 'Scene.Earth.Renderable.Enabled'.",
      inputSchema: {
        uri: z.string().describe('Property or property-owner URI.')
      }
    },
    (args) => toResult(() => getProperty(args.uri))
  );

  server.registerTool(
    'set_property',
    {
      title: 'Set scene graph property',
      description:
        "Set a scene graph property's value by URI. The URI may include at most one '*' wildcard and/or a " +
        "'{tag}' selector to set multiple properties at once (e.g. '*Trail.Renderable.Enabled' or " +
        "'{tag1&tag2}.Renderable.Enabled') — more than one '*' is rejected.",
      inputSchema: {
        uri: z
          .string()
          .describe(
            'Property URI, optionally with a single wildcard and/or a tag selector.'
          ),
        value: z.unknown().describe('Value to set the property to.')
      }
    },
    (args) =>
      toResult(async () => {
        assertSingleWildcard(args.uri);
        await setProperty(args.uri, args.value as JsonValue);
        return { ok: true };
      })
  );

  server.registerTool(
    'list_matching_properties',
    {
      title: 'List matching properties',
      description:
        "List all property URIs matching a pattern (at most one '*' wildcard and/or a '{tag}' selector " +
        "supported), e.g. 'Scene.Earth.*' or '{planet_solarSystem}.Renderable.Enabled' — more than one " +
        "'*' is rejected.",
      inputSchema: {
        uri: z.string().describe("URI pattern to match, with at most one '*' wildcard.")
      }
    },
    (args) =>
      toResult(() => {
        assertSingleWildcard(args.uri);
        return callFunction(PROPERTY, [args.uri]);
      })
  );
}
