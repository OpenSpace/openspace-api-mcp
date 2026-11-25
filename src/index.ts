#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerGenericTools } from './tools/generic.js';
import { registerMiscTools } from './tools/misc.js';
import { registerNavigationTools } from './tools/navigation.js';
import { registerPropertyTools } from './tools/properties.js';
import { registerSceneTools } from './tools/scene.js';
import { registerTimeTools } from './tools/time.js';

const server = new McpServer({
  name: 'openspace-mcp',
  version: '0.1.0'
});

registerGenericTools(server);
registerNavigationTools(server);
registerTimeTools(server);
registerPropertyTools(server);
registerSceneTools(server);
registerMiscTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  console.error('Fatal error starting openspace-mcp:', err);
  process.exit(1);
});
