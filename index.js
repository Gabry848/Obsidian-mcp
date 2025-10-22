import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VAULT_BASE_PATH } from "./src/config.js";
import { registerResources } from "./src/resources/registerResources.js";
import { registerTools } from "./src/tools/registerTools.js";

// Create MCP server
const server = new McpServer({
  name: "obsidian-mcp-server",
  version: "1.0.0",
});

// Register modularized tools and resources
registerTools(server);
registerResources(server);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Obsidian MCP Server started. Vault base path:", VAULT_BASE_PATH);

