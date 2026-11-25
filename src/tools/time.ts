import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { callFunction, luaFn, runScript } from '../openspaceClient.js';

import { toResult } from './helpers.js';

const SET_TIME = luaFn('openspace.time.setTime');
const SET_PAUSE = luaFn('openspace.time.setPause');
const SET_DELTA_TIME = luaFn('openspace.time.setDeltaTime');
const CURRENT_TIME = luaFn('openspace.time.currentTime');
const UTC = luaFn('openspace.time.UTC');
const IS_PAUSED = luaFn('openspace.time.isPaused');

export function registerTimeTools(server: McpServer): void {
  server.registerTool(
    'time_set',
    {
      title: 'Set simulation time',
      description:
        "Set OpenSpace's simulation time. Accepts an ISO 8601 UTC timestamp (e.g. '2000-01-01T12:00:00') " +
        "or any other time string OpenSpace's time parser understands.",
      inputSchema: {
        time: z.string().describe('Time string to set the simulation clock to.')
      }
    },
    (args) => toResult(() => callFunction(SET_TIME, [args.time]))
  );

  server.registerTool(
    'time_set_pause',
    {
      title: 'Pause or resume simulation time',
      description: "Pause or resume the flow of OpenSpace's simulation time.",
      inputSchema: {
        paused: z.boolean().describe('True to pause, false to resume.')
      }
    },
    (args) => toResult(() => callFunction(SET_PAUSE, [args.paused]))
  );

  server.registerTool(
    'time_set_delta_time',
    {
      title: 'Set simulation time rate',
      description: 'Set how many simulated seconds pass per real-world second.',
      inputSchema: {
        secondsPerRealtimeSecond: z
          .number()
          .describe('Simulated seconds per real-world second.')
      }
    },
    (args) =>
      toResult(() => callFunction(SET_DELTA_TIME, [args.secondsPerRealtimeSecond]))
  );

  server.registerTool(
    'time_get_status',
    {
      title: 'Get simulation time status',
      description:
        'Get the current simulation time (local and UTC) and whether time is paused.',
      inputSchema: {}
    },
    () =>
      toResult(() =>
        runScript(
          `return { currentTime = ${CURRENT_TIME}(), ` +
            `currentTimeUTC = ${UTC}(), ` +
            `isPaused = ${IS_PAUSED}() }`
        )
      )
  );
}
