import fs from "fs-extra";
import path from "path";
import { z } from "zod";
import { getVaultPath } from "../utils.js";

export function registerContentTools(server) {
  // Tool 2: List files and folders in a vault
  server.registerTool(
    "list_vault_contents",
    {
      title: "List Vault Contents",
      description: "List files and folders in a specific vault or path",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        subPath: z.string().optional().describe("Optional subfolder path within the vault"),
      },
    },
    async ({ vaultName, subPath = "" }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const targetPath = path.join(vaultPath, subPath);

        if (!(await fs.pathExists(targetPath))) {
          return { content: [{ type: "text", text: `Path not found: ${subPath}` }] };
        }

        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
        const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);

        let result = `Contents of ${vaultName}${subPath ? `/${subPath}` : ""}:\n\n`;
        if (folders.length > 0) {
          result += `📁 Folders:\n${folders.map((f) => `  - ${f}/`).join("\n")}\n\n`;
        }
        if (files.length > 0) {
          result += `📄 Files:\n${files.map((f) => `  - ${f}`).join("\n")}`;
        }

        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error listing contents: ${error.message}` }] };
      }
    }
  );
}

