import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { callFunction, luaFn, positionalArgs } from "../openspaceClient.js";
import { toResult } from "./helpers.js";

const FLY_TO = luaFn("openspace.navigation.flyTo");
const FLY_TO_GEO = luaFn("openspace.navigation.flyToGeo");
const JUMP_TO = luaFn("openspace.navigation.jumpTo");
const SET_FOCUS = luaFn("openspace.navigation.setFocus");
const ZOOM_TO_FOCUS = luaFn("openspace.navigation.zoomToFocus");
const RETARGET_ANCHOR = luaFn("openspace.navigation.retargetAnchor");

export function registerNavigationTools(server: McpServer): void {
  server.registerTool(
    "navigate_fly_to",
    {
      title: "Fly to scene graph node",
      description: "Animate the camera to fly to the given scene graph node (e.g. 'Mars', 'Earth').",
      inputSchema: {
        node: z.string().describe("Identifier of the scene graph node to fly to."),
        duration: z.number().optional().describe("Flight duration in seconds.")
      }
    },
    (args) =>
      toResult(() =>
        callFunction(FLY_TO, positionalArgs([args.node, args.duration]))
      )
  );

  server.registerTool(
    "navigate_fly_to_geo",
    {
      title: "Fly to geographic coordinates",
      description: "Animate the camera to fly to a latitude/longitude (and optional altitude) on a globe node.",
      inputSchema: {
        node: z.string().describe("Identifier of the globe scene graph node, e.g. 'Earth'."),
        latitude: z.number().describe("Latitude in degrees."),
        longitude: z.number().describe("Longitude in degrees."),
        altitude: z.number().optional().describe("Altitude above the globe surface, in meters."),
        duration: z.number().optional().describe("Flight duration in seconds.")
      }
    },
    (args) =>
      toResult(() =>
        callFunction(
          FLY_TO_GEO,
          positionalArgs([args.node, args.latitude, args.longitude, args.altitude, args.duration])
        )
      )
  );

  server.registerTool(
    "navigate_jump_to",
    {
      title: "Jump to scene graph node",
      description: "Instantly move the camera to the given scene graph node, with an optional fade transition.",
      inputSchema: {
        node: z.string().describe("Identifier of the scene graph node to jump to."),
        fadeDuration: z.number().optional().describe("Fade transition duration in seconds.")
      }
    },
    (args) =>
      toResult(() =>
        callFunction(JUMP_TO, positionalArgs([args.node, args.fadeDuration]))
      )
  );

  server.registerTool(
    "navigate_set_focus",
    {
      title: "Set navigation focus",
      description: "Set the camera's anchor/focus node, without necessarily moving the camera there.",
      inputSchema: {
        node: z.string().describe("Identifier of the scene graph node to focus on.")
      }
    },
    (args) => toResult(() => callFunction(SET_FOCUS, [args.node]))
  );

  server.registerTool(
    "navigate_zoom_to_focus",
    {
      title: "Zoom to focus",
      description: "Animate the camera to a default distance from the current focus node.",
      inputSchema: {
        duration: z.number().optional().describe("Zoom duration in seconds.")
      }
    },
    (args) => toResult(() => callFunction(ZOOM_TO_FOCUS, positionalArgs([args.duration])))
  );

  server.registerTool(
    "navigate_retarget",
    {
      title: "Retarget camera",
      description: "Smoothly rotate the camera to look directly at the current anchor/focus node.",
      inputSchema: {}
    },
    () => toResult(() => callFunction(RETARGET_ANCHOR, []))
  );
}
