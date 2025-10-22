import fs from "fs-extra";
import path from "path";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVaultPath } from "../utils.js";

export function registerResources(server) {
  // Resource: Vault contents
  server.registerResource(
    "vault",
    new ResourceTemplate("vault://{vaultName}/{path*}", { list: undefined }),
    {
      title: "Vault Resource",
      description: "Access to vault files and folders"
    },
    async (uri, { vaultName, path: subPath }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const fullPath = subPath ? path.join(vaultPath, subPath) : vaultPath;

        if (!await fs.pathExists(fullPath)) {
          return {
            contents: [{ uri: uri.href, text: `Path not found: ${subPath || '/'}` }]
          };
        }

        const stat = await fs.stat(fullPath);

        if (stat.isFile()) {
          const content = await fs.readFile(fullPath, "utf8");
          return { contents: [{ uri: uri.href, text: content }] };
        } else {
          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          const listing = entries
            .map(entry => entry.isDirectory() ? `📁 ${entry.name}/` : `📄 ${entry.name}`)
            .join("\n");

          return {
            contents: [{ uri: uri.href, text: `Contents of ${vaultName}${subPath ? `/${subPath}` : ''}:\n\n${listing}` }]
          };
        }
      } catch (error) {
        return { contents: [{ uri: uri.href, text: `Error accessing vault: ${error.message}` }] };
      }
    }
  );
}

