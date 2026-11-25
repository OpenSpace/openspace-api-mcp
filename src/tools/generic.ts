import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { callFunction, describeApi, runScript } from '../openspaceClient.js';

import { toResult } from './helpers.js';

export function registerGenericTools(server: McpServer): void {
  server.registerTool(
    'run_lua_script',
    {
      title: 'Run Lua script',
      description:
        'Execute an arbitrary Lua script string inside the running OpenSpace instance, using the same ' +
        "engine as OpenSpace's in-app console (the 'openspace.*' API). Use this for anything not covered " +
        "by a more specific tool. Prefix with 'return' to get a value back, e.g. " +
        "'return openspace.time.currentTime()'.",
      inputSchema: {
        script: z.string().describe('The Lua script to execute.'),
        return: z
          .boolean()
          .optional()
          .describe(
            "Whether to wait for and return the script's return value (default true)."
          )
      }
    },
    (args) => toResult(() => runScript(args.script, { return: args.return }))
  );

  server.registerTool(
    'call_lua_function',
    {
      title: 'Call OpenSpace Lua function',
      description:
        "Call a single named function from OpenSpace's Lua API (e.g. 'openspace.addSceneGraphNode' or " +
        "'openspace.navigation.flyTo') with a list of JSON-typed arguments, without writing raw Lua. " +
        'Use describe_lua_api to discover available function names and their arguments.',
      inputSchema: {
        function: z
          .string()
          .describe(
            "Fully-qualified Lua function name, e.g. 'openspace.navigation.flyTo'."
          ),
        arguments: z
          .array(z.unknown())
          .optional()
          .describe('Positional arguments for the function.'),
        return: z
          .boolean()
          .optional()
          .describe(
            "Whether to wait for and return the function's return value (default true)."
          )
      }
    },
    (args) =>
      toResult(() =>
        callFunction(args.function, args.arguments ?? [], { return: args.return })
      )
  );

  server.registerTool(
    'describe_lua_api',
    {
      title: 'Describe OpenSpace Lua API',
      description:
        'List the Lua API of the currently running OpenSpace instance, fetched live from the server so it ' +
        'always matches the exact build/version in use. With no filter, returns just the library names and ' +
        'how many functions each has (a table of contents). With a filter, returns full details (arguments, ' +
        'return type, help text) for every function whose library or function name contains the filter ' +
        '(case-insensitive) — call this before run_lua_script/call_lua_function to find exact names.',
      inputSchema: {
        filter: z
          .string()
          .optional()
          .describe(
            "Case-insensitive substring to match against library or function names, e.g. 'navigation'."
          )
      }
    },
    (args) =>
      toResult(async () => {
        const libraries = await describeApi();
        if (!args.filter) {
          return libraries.map((lib) => ({
            name: lib.name,
            fullName: lib.fullName,
            functionCount: lib.functions.length
          }));
        }

        const needle = args.filter.toLowerCase();
        const matches: unknown[] = [];
        for (const lib of libraries) {
          for (const fn of lib.functions) {
            const qualifiedName = lib.name ? `${lib.name}.${fn.name}` : fn.name;
            if (qualifiedName.toLowerCase().includes(needle)) {
              matches.push({
                name: qualifiedName,
                arguments: fn.arguments,
                returnType: fn.returnType,
                help: fn.help
              });
            }
          }
        }
        return matches;
      })
  );
}
