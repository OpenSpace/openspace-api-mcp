import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { callFunction, luaFn } from "../openspaceClient.js";
import { toResult } from "./helpers.js";

const TAKE_SCREENSHOT = luaFn("openspace.takeScreenshot");
const VERSION = luaFn("openspace.version");

export function registerMiscTools(server: McpServer): void {
  server.registerTool(
    "take_screenshot",
    {
      title: "Take screenshot",
      description: "Take a screenshot of the current OpenSpace render, saved to OpenSpace's screenshot folder.",
      inputSchema: {}
    },
    () => toResult(() => callFunction(TAKE_SCREENSHOT, []))
  );

  server.registerTool(
    "get_version",
    {
      title: "Get OpenSpace version",
      description: "Get the version string of the connected running OpenSpace instance.",
      inputSchema: {}
    },
    () => toResult(() => callFunction(VERSION, []))
  );
}
