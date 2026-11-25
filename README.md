# openspace-api-mcp

An [MCP](https://modelcontextprotocol.io) server that controls a locally running [OpenSpace](https://github.com/OpenSpace/OpenSpace) instance: fly the camera, change simulation time, get/set scene graph properties, load assets, take screenshots — plus a raw Lua execution tool for anything else.

It's a thin wrapper around the official [`openspace-api-js`](https://github.com/OpenSpace/openspace-api-js) client, which talks to OpenSpace's built-in TCP control socket (the same mechanism the in-app Lua console and web GUI use). No changes to OpenSpace itself are required.

This is a standard stdio-transport MCP server — it's not specific to any one LLM or client. Any MCP-compliant host (Claude Code, Claude Desktop, Cursor, Windsurf, Cline, etc.) can use it.

## Prerequisites

  - OpenSpace running locally with its TCP control interface enabled. This is on by default in `openspace.cfg`:

    ```lua
    Server = {
      Interfaces = {
        { Type = "TcpSocket", Port = 4681, Enabled = true, DefaultAccess = "Deny",
          AllowAddresses = { "127.0.0.1", "localhost" }, Password = "" },
        ...
      }
    }
    ```

    Connections from `127.0.0.1`/`localhost` are authorized without a password by default. If you've changed
    the port, password, or `AllowAddresses`, set the matching environment variables below.

## Install & build

```sh
npm install
npm run build
```

## Configuration

All configuration is via environment variables (all optional):

| Variable | Default | Description |
| --- | --- | --- |
| `OPENSPACE_HOST` | `127.0.0.1` | Host OpenSpace's TCP interface is bound to. |
| `OPENSPACE_PORT` | `4681` | Port of OpenSpace's TCP interface. |
| `OPENSPACE_PASSWORD` | `""` | Password, if the interface requires one. |
| `OPENSPACE_CONNECT_TIMEOUT_MS` | `15000` | How long to wait for OpenSpace to accept a connection before a tool call fails. OpenSpace's control server responds on its render loop cadence, so this needs headroom beyond a typical socket timeout, especially while OpenSpace is still loading a scene. |

The server connects lazily on the first tool call (so it can start before OpenSpace does) and reconnects automatically if the connection drops.

## Registering with an MCP client

### Generic MCP host config

Most MCP hosts (Claude Desktop, Cursor, Windsurf, Cline, etc.) use a config block like this:

```json
{
  "mcpServers": {
    "openspace": {
      "command": "node",
      "args": ["<absolute-path-to-this-repo>\\dist\\index.js"],
      "env": {
        "OPENSPACE_HOST": "127.0.0.1",
        "OPENSPACE_PORT": "4681"
      }
    }
  }
}
```

Check your specific client's docs for where this config file lives.

### Claude Code

```sh
claude mcp add openspace -- node <absolute-path-to-this-repo>\dist\index.js
```

## Usage

Once registered, you don't call tools directly — just start OpenSpace and talk to your MCP client normally. The LLM sees the tool list below (with its descriptions and parameters) and decides which one(s) to call based on what you ask for.

A quick sanity check once OpenSpace is running:

> What version of OpenSpace am I connected to, and what node is the camera currently focused on?

Example requests and the kind of tool calls they'll typically trigger:

| You say | Tool(s) likely used |
| --- | --- |
| "Fly to Mars" | `navigate_fly_to` |
| "Take me to the Grand Canyon on Earth" | `navigate_fly_to_geo` |
| "Jump straight to Jupiter, no animation" | `navigate_jump_to` |
| "Set the date to July 20, 1969 and pause time" | `time_set`, `time_set_pause` |
| "Run time forward at 1000x speed" | `time_set_delta_time` |
| "Is Saturn's ring renderable currently enabled?" | `get_property` |
| "Hide the constellation lines" | `set_property` (or `list_matching_properties` first, to find the right URI) |
| "What asset should I load for a potentially hazardous asteroid?" | `list_assets` (filtered), then `asset_add` |
| "Load the Mars Curiosity rover asset" | `asset_add` |
| "What scene graph nodes are loaded right now?" | `list_scene_graph_nodes` |
| "Take a screenshot" | `take_screenshot` |

For anything not covered by a dedicated tool — a one-off Lua console command, a less common function, a combination of several calls in one script — just describe what you want. The model can reach for `describe_lua_api` to look up the exact function/arguments first, then `run_lua_script` or `call_lua_function` to run it. For example:

> Print the distance between the camera and the Moon in kilometers.

might have the model look up `openspace.navigation.distanceToFocus` via `describe_lua_api`, then call it with `call_lua_function` or wrap it in a `run_lua_script` call.

If a request doesn't do anything, see [Known limitation](#known-limitation-lua-errors-are-not-returned-over-the-wire) below — the model may have called a function that doesn't exist or was given a bad argument, and OpenSpace won't report that back over the wire.

## Tools

**Generic (escape hatch):**

  - `run_lua_script` — execute an arbitrary Lua script string.
  - `call_lua_function` — call one named `openspace.*` Lua function with JSON arguments.
  - `describe_lua_api` — list (optionally filtered) the live Lua API of the connected OpenSpace instance, including argument lists and help text. Use this to discover function names before calling them.

**Navigation:** `navigate_fly_to`, `navigate_fly_to_geo`, `navigate_jump_to`, `navigate_set_focus`,
`navigate_zoom_to_focus`, `navigate_retarget`

**Time:** `time_set`, `time_set_pause`, `time_set_delta_time`, `time_get_status`

**Properties:** `get_property`, `set_property`, `list_matching_properties`

**Scene / assets:** `list_scene_graph_nodes`, `asset_add`, `asset_remove`, `list_assets` (search the bundled
`data` and `user` asset folders for `.asset` files to find the exact path for `asset_add`)

**Misc:** `take_screenshot`, `get_version`

This list isn't exhaustive by design — anything not covered by a dedicated tool is reachable through `run_lua_script` or `call_lua_function`, which cover the entire OpenSpace Lua API.

## Known limitation: Lua errors are not returned over the wire
If a script/function call errors inside OpenSpace (bad function name, wrong argument count, runtime error), OpenSpace's `luascript` topic does not send an error back — it just returns an empty result, identical to a call that legitimately returns nothing. The error is only visible in OpenSpace's own log/console. This is a limitation of OpenSpace's control protocol itself, not something this thin wrapper can compensate for. If a tool call returns `{}` unexpectedly, use `describe_lua_api` to double-check the function name/arguments, or check OpenSpace's log.

## Development

```sh
npm run dev    # tsc --watch
```

Try it standalone with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```sh
npx @modelcontextprotocol/inspector node dist/index.js
```
