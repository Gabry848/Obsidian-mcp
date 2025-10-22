import { registerVaultTools } from "./vaults.js";
import { registerContentTools } from "./contents.js";
import { registerFileTools } from "./files.js";
import { registerSearchTools } from "./search.js";
import { registerConfigTool } from "./configTool.js";

export function registerTools(server) {
  registerVaultTools(server);
  registerContentTools(server);
  registerFileTools(server);
  registerSearchTools(server);
  registerConfigTool(server);
}

