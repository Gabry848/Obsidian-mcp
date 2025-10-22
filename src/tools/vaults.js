import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import { z } from "zod";
import { VAULT_BASE_PATH, CONFIG_FILENAME } from "../config.js";
import { getVaultPath, getVaultConfigPath } from "../utils.js";

export function registerVaultTools(server) {
  // Tool 1: List all vaults
  server.registerTool(
    "list_vaults",
    {
      title: "List Vaults",
      description: "List all available Obsidian vaults with detailed information",
      inputSchema: {
        detailed: z.boolean().optional().describe("Show detailed information about each vault"),
      },
    },
    async ({ detailed = false }) => {
      try {
        if (!(await fs.pathExists(VAULT_BASE_PATH))) {
          return { content: [{ type: "text", text: `Vault base path not found: ${VAULT_BASE_PATH}` }] };
        }

        const entries = await fs.readdir(VAULT_BASE_PATH, { withFileTypes: true });
        const vaults = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

        if (vaults.length === 0) {
          return { content: [{ type: "text", text: `No vaults found in: ${VAULT_BASE_PATH}` }] };
        }

        let result = `📚 Found ${vaults.length} vault${vaults.length === 1 ? "" : "s"} in: ${VAULT_BASE_PATH}\n\n`;

        if (detailed) {
          for (const vaultName of vaults) {
            try {
              const vaultPath = path.join(VAULT_BASE_PATH, vaultName);
              const stat = await fs.stat(vaultPath);
              const allFiles = await glob(path.join(vaultPath, "**/*"), { nodir: true });
              const markdownFiles = allFiles.filter((file) => path.extname(file) === ".md");

              result += `• ${vaultName}\n`;
              result += `   📄 Markdown files: ${markdownFiles.length}\n`;
              result += `   📦 Total files: ${allFiles.length}\n`;
              result += `   🕒 Last modified: ${stat.mtime.toLocaleDateString()}\n`;
              result += `   📁 Path: ${vaultPath}\n\n`;
            } catch (error) {
              result += `• ${vaultName} (Error reading details: ${error.message})\n\n`;
            }
          }
        } else {
          result += vaults.map((v) => `• ${v}`).join("\n");
        }

        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error listing vaults: ${error.message}\nBase path: ${VAULT_BASE_PATH}` }] };
      }
    }
  );

  // Tool 1.1: Get vault names only
  server.registerTool(
    "get_vault_names",
    {
      title: "Get Vault Names",
      description: "Get a simple list of vault names only",
      inputSchema: {},
    },
    async () => {
      try {
        if (!(await fs.pathExists(VAULT_BASE_PATH))) {
          return { content: [{ type: "text", text: `Vault base path not found: ${VAULT_BASE_PATH}` }] };
        }

        const entries = await fs.readdir(VAULT_BASE_PATH, { withFileTypes: true });
        const vaults = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

        if (vaults.length === 0) {
          return { content: [{ type: "text", text: `No vaults found in: ${VAULT_BASE_PATH}` }] };
        }

        return { content: [{ type: "text", text: JSON.stringify(vaults, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error getting vault names: ${error.message}` }] };
      }
    }
  );

  // Tool 6: Vault overview helper
  server.registerTool(
    "get_vault_overview",
    {
      title: "Get Vault Overview",
      description:
        "Leggi automaticamente il file config.md di un vault per comprenderne struttura, scopo e istruzioni chiave",
      inputSchema: { vaultName: z.string().describe("Nome del vault") },
    },
    async ({ vaultName }) => {
      try {
        const { configPath } = await getVaultConfigPath(vaultName);
        if (!(await fs.pathExists(configPath))) {
          return {
            content: [
              {
                type: "text",
                text: `Il file ${CONFIG_FILENAME} non esiste nel vault ${vaultName}. Esegui init_vault_config prima di usare questo strumento.`,
              },
            ],
          };
        }
        const content = await fs.readFile(configPath, "utf8");
        return { content: [{ type: "text", text: `Contenuto di ${CONFIG_FILENAME} per ${vaultName}:\n\n${content}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Errore durante la lettura di ${CONFIG_FILENAME}: ${error.message}` }] };
      }
    }
  );

  // Tool 14: Get vault statistics
  server.registerTool(
    "get_vault_stats",
    {
      title: "Get Vault Statistics",
      description: "Get statistics about a vault (file count, folder count, etc.)",
      inputSchema: { vaultName: z.string().describe("Name of the vault") },
    },
    async ({ vaultName }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const allFiles = await glob(path.join(vaultPath, "**/*"), { nodir: true });
        const allFolders = await glob(path.join(vaultPath, "**/"), { onlyDirectories: true });
        const markdownFiles = allFiles.filter((file) => path.extname(file) === ".md");
        const otherFiles = allFiles.filter((file) => path.extname(file) !== ".md");

        const stats = {
          totalFiles: allFiles.length,
          markdownFiles: markdownFiles.length,
          otherFiles: otherFiles.length,
          folders: allFolders.length,
          vaultSize: 0,
        };

        for (const file of allFiles) {
          try {
            const stat = await fs.stat(file);
            stats.vaultSize += stat.size;
          } catch {}
        }

        const sizeInMB = (stats.vaultSize / 1024 / 1024).toFixed(2);
        const result =
          `Statistics for vault "${vaultName}":\n\n` +
          `📦 Total Files: ${stats.totalFiles}\n` +
          `📝 Markdown Files: ${stats.markdownFiles}\n` +
          `📄 Other Files: ${stats.otherFiles}\n` +
          `📁 Folders: ${stats.folders}\n` +
          `📏 Total Size: ${sizeInMB} MB`;

        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error getting vault statistics: ${error.message}` }] };
      }
    }
  );
}

