import { createRequire } from 'node:module';
import type { OpenSpaceApi } from 'openspace-api-js/api';
import type { JsonValue, LuaLibrary, TopicData } from 'openspace-api-js/types';

import { config } from './config.js';

// The ESM build of openspace-api-js uses extensionless relative imports that Node cannot
// resolve, so the CommonJS build is loaded instead
const requireCjs = createRequire(import.meta.url);
const openspaceApi = (requireCjs('openspace-api-js') as typeof import('openspace-api-js'))
  .default;

export class OpenSpaceConnectionError extends Error {}

let api: OpenSpaceApi | null = null;
let ready: Promise<void> | null = null;
let luaDocsCache: Promise<LuaLibrary[]> | null = null;

/**
 * Names of Lua functions the curated tools call, registered by wrapping each literal in {@link luaFn}
 * where it's used. Checked against the live instance's own documentation on connect (see
 * {@link validateKnownFunctions}) so a renamed/removed function is caught as a startup warning instead
 * of silently returning an empty result the next time a tool calls it.
 */
const knownFunctions = new Set<string>();

/** Wrap a literal Lua function name used by a curated tool so it gets validated on connect. */
export function luaFn(name: string): string {
  knownFunctions.add(name);
  return name;
}

async function validateKnownFunctions(): Promise<void> {
  try {
    const libraries = await describeApi();
    const available = new Set<string>();
    for (const lib of libraries) {
      for (const fn of lib.functions) {
        available.add(lib.name ? `${lib.name}.${fn.name}` : fn.name);
      }
    }

    const missing = [...knownFunctions].filter((name) => {
      const bareName = name.startsWith('openspace.')
        ? name.slice('openspace.'.length)
        : name;
      return !available.has(bareName);
    });

    if (missing.length > 0) {
      console.error(
        `openspace-mcp: ${missing.length} tool-mapped Lua function(s) were not found in the connected ` +
          "OpenSpace instance's API — the corresponding tool(s) will likely return an empty result " +
          `instead of erroring (see README "Known limitation"): ${missing.join(', ')}`
      );
    }
  } catch {
    // Best-effort self-check; never block startup or a tool call on it failing.
  }
}

function connect(): Promise<void> {
  if (ready) {
    return ready;
  }

  ready = new Promise((resolve, reject) => {
    const instance = openspaceApi(config.host, config.port);
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      ready = null;
      reject(
        new OpenSpaceConnectionError(
          `Timed out connecting to OpenSpace at ${config.host}:${config.port}. ` +
            'Is OpenSpace running with the TCP Server.Interfaces entry enabled in openspace.cfg?'
        )
      );
    }, config.connectTimeoutMs);

    // The handler catches its own errors, so the returned promise can be ignored
    instance.onConnect(() => void handleConnect());

    async function handleConnect(): Promise<void> {
      try {
        await instance.authenticate(config.password);
        api = instance;
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve();
        }
        void validateKnownFunctions();
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          ready = null;
          reject(err);
        }
      }
    }

    instance.onDisconnect(() => {
      api = null;
      ready = null;
      luaDocsCache = null;
    });

    instance.connect();
  });

  return ready;
}

async function ensureConnected(): Promise<OpenSpaceApi> {
  await connect();
  if (!api) {
    throw new OpenSpaceConnectionError('Lost connection to OpenSpace.');
  }
  return api;
}

/** Drop trailing `undefined`s but keep interior gaps as explicit `null` (Lua `nil`), so positional args stay aligned. */
export function positionalArgs(values: unknown[]): unknown[] {
  let end = values.length;
  while (end > 0 && values[end - 1] === undefined) {
    end--;
  }
  return values.slice(0, end).map((v) => (v === undefined ? null : v));
}

export async function runScript(
  script: string,
  opts: { return?: boolean | undefined; sync?: boolean | undefined } = {}
): Promise<TopicData<'luascript'> | undefined> {
  const instance = await ensureConnected();
  const result = await instance.executeLuaScript(
    script,
    opts.return ?? true,
    opts.sync ?? true
  );
  return result ?? undefined;
}

export async function callFunction(
  fn: string,
  args: unknown[] = [],
  opts: { return?: boolean | undefined } = {}
): Promise<TopicData<'luascript'> | undefined> {
  const instance = await ensureConnected();
  if (opts.return === false) {
    await instance.executeLuaFunction(fn, args, false);
    return undefined;
  }
  return instance.executeLuaFunction(fn, args, true);
}

export async function getProperty(uri: string): Promise<TopicData<'get'>> {
  const instance = await ensureConnected();
  return instance.getProperty(uri);
}

export async function setProperty(uri: string, value: JsonValue): Promise<void> {
  const instance = await ensureConnected();
  instance.setProperty(uri, value);
}

/** Fetches OpenSpace's live Lua API documentation, cached for the lifetime of the current connection. */
export async function describeApi(): Promise<LuaLibrary[]> {
  if (!luaDocsCache) {
    luaDocsCache = ensureConnected().then((instance) => instance.getDocumentation('lua'));
    luaDocsCache.catch(() => {
      luaDocsCache = null;
    });
  }
  return luaDocsCache;
}
