import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import { glob } from "glob";

// Configuration
const VAULT_BASE_PATH = process.env.OBSIDIAN_VAULT_PATH || "C:/Users/User/Documents/Obsidian";
const CONFIG_FILENAME = "config.md";

// Create an MCP server
const server = new McpServer({
  name: "obsidian-mcp-server",
  version: "1.0.0"
});

// Helper functions
async function getVaultPath(vaultName) {
  const vaultPath = path.join(VAULT_BASE_PATH, vaultName);
  if (!await fs.pathExists(vaultPath)) {
    throw new Error(`Vault '${vaultName}' not found at ${vaultPath}`);
  }
  return vaultPath;
}

async function isMarkdownFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.md';
}

async function searchInFile(filePath, searchTerm) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const matches = [];
    
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
        matches.push({
          line: index + 1,
          content: line.trim()
        });
      }
    });
    
    return matches;
  } catch (error) {
    return [];
  }
}

function findNthOccurrence(haystack, needle, occurrence = 1) {
  if (!needle) {
    throw new Error("Anchor/target text must not be empty");
  }

  let index = -1;
  let fromIndex = 0;

  for (let i = 0; i < occurrence; i++) {
    index = haystack.indexOf(needle, fromIndex);
    if (index === -1) {
      return -1;
    }
    fromIndex = index + needle.length;
  }

  return index;
}

async function getVaultConfigPath(vaultName) {
  const vaultPath = await getVaultPath(vaultName);
  return {
    vaultPath,
    configPath: path.join(vaultPath, CONFIG_FILENAME)
  };
}

async function getVaultStructureOverview(vaultPath) {
  const overview = {
    topLevelFolders: [],
    markdownFiles: 0,
    totalFiles: 0
  };

  try {
    const entries = await fs.readdir(vaultPath, { withFileTypes: true });
    overview.topLevelFolders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    // ignore directory read errors, overview will stay minimal
  }

  try {
    const allFiles = await glob(path.join(vaultPath, "**/*"), { nodir: true });
    overview.totalFiles = allFiles.length;
    overview.markdownFiles = allFiles.filter(file => path.extname(file).toLowerCase() === ".md").length;
  } catch (error) {
    // ignore file enumeration errors
  }

  return overview;
}

// Tool 1: List all vaults
server.registerTool("list_vaults",
  {
    title: "List Vaults",
    description: "List all available Obsidian vaults with detailed information",
    inputSchema: {
      detailed: z.boolean().optional().describe("Show detailed information about each vault")
    }
  },
  async ({ detailed = false }) => {
    try {
      if (!await fs.pathExists(VAULT_BASE_PATH)) {
        return {
          content: [{
            type: "text",
            text: `Vault base path not found: ${VAULT_BASE_PATH}`
          }]
        };
      }

      const entries = await fs.readdir(VAULT_BASE_PATH, { withFileTypes: true });
      const vaults = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
      
      if (vaults.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No vaults found in: ${VAULT_BASE_PATH}`
          }]
        };
      }

      let result = `📁 Found ${vaults.length} vault${vaults.length === 1 ? '' : 's'} in: ${VAULT_BASE_PATH}\n\n`;

      if (detailed) {
        for (const vaultName of vaults) {
          try {
            const vaultPath = path.join(VAULT_BASE_PATH, vaultName);
            const stat = await fs.stat(vaultPath);
            
            // Count files and folders
            const allFiles = await glob(path.join(vaultPath, "**/*"), { nodir: true });
            const markdownFiles = allFiles.filter(file => path.extname(file) === '.md');
            
            result += `🗃️  **${vaultName}**\n`;
            result += `   📝 Markdown files: ${markdownFiles.length}\n`;
            result += `   📄 Total files: ${allFiles.length}\n`;
            result += `   📅 Last modified: ${stat.mtime.toLocaleDateString()}\n`;
            result += `   📍 Path: ${vaultPath}\n\n`;
          } catch (error) {
            result += `🗃️  **${vaultName}** (Error reading details: ${error.message})\n\n`;
          }
        }
      } else {
        result += vaults.map(v => `🗃️  ${v}`).join('\n');
      }
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error listing vaults: ${error.message}\nBase path: ${VAULT_BASE_PATH}`
        }]
      };
    }
  }
);

// Tool 1.1: Get vault names only
server.registerTool("get_vault_names",
  {
    title: "Get Vault Names",
    description: "Get a simple list of vault names only",
    inputSchema: {}
  },
  async () => {
    try {
      if (!await fs.pathExists(VAULT_BASE_PATH)) {
        return {
          content: [{
            type: "text",
            text: `Vault base path not found: ${VAULT_BASE_PATH}`
          }]
        };
      }

      const entries = await fs.readdir(VAULT_BASE_PATH, { withFileTypes: true });
      const vaults = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
      
      if (vaults.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No vaults found in: ${VAULT_BASE_PATH}`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(vaults, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting vault names: ${error.message}`
        }]
      };
    }
  }
);

// Tool 2: List files and folders in a vault
server.registerTool("list_vault_contents",
  {
    title: "List Vault Contents",
    description: "List files and folders in a specific vault or path",
    inputSchema: {
      vaultName: z.string().describe("Name of the vault"),
      subPath: z.string().optional().describe("Optional subfolder path within the vault")
    }
  },
  async ({ vaultName, subPath = "" }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const targetPath = path.join(vaultPath, subPath);
      
      if (!await fs.pathExists(targetPath)) {
        return {
          content: [{
            type: "text",
            text: `Path not found: ${subPath}`
          }]
        };
      }
      
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const folders = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
      const files = entries.filter(entry => entry.isFile()).map(entry => entry.name);
      
      let result = `Contents of ${vaultName}${subPath ? `/${subPath}` : ''}:\n\n`;
      
      if (folders.length > 0) {
        result += `📁 Folders:\n${folders.map(f => `  - ${f}/`).join('\n')}\n\n`;
      }
      
      if (files.length > 0) {
        result += `📄 Files:\n${files.map(f => `  - ${f}`).join('\n')}`;
      }
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error listing contents: ${error.message}`
        }]
      };
    }
  }
);

// Tool 3: Read file content
server.registerTool("read_file",
  {
    title: "Read File",
    description: "Read the content of a file in a vault",
    inputSchema: {
      vaultName: z.string().describe("Name of the vault"),
      filePath: z.string().describe("Path to the file within the vault"),
      startLine: z.number().int().min(1).optional().describe("Optional 1-based line number to start reading from"),
      endLine: z.number().int().min(1).optional().describe("Optional 1-based line number to stop reading at (inclusive)")
    }
  },
  async ({ vaultName, filePath, startLine, endLine }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const fullPath = path.join(vaultPath, filePath);
      
      if (!await fs.pathExists(fullPath)) {
        return {
          content: [{
            type: "text",
            text: `File not found: ${filePath}`
          }]
        };
      }
      
      if (endLine !== undefined && startLine !== undefined && endLine < startLine) {
        return {
          content: [{
            type: "text",
            text: "endLine must be greater than or equal to startLine"
          }]
        };
      }

      const content = await fs.readFile(fullPath, 'utf8');
      const hasLineRange = startLine !== undefined || endLine !== undefined;

      if (hasLineRange) {
        const lines = content.split(/\r?\n/);
        const totalLines = lines.length;
        const effectiveStart = startLine !== undefined ? startLine : 1;
        const effectiveEnd = endLine !== undefined ? Math.min(endLine, totalLines) : totalLines;

        if (effectiveStart > totalLines) {
          return {
            content: [{
              type: "text",
              text: `Start line ${effectiveStart} exceeds total lines (${totalLines}) in ${filePath}`
            }]
          };
        }

        const normalizedStart = Math.max(effectiveStart, 1);
        const normalizedEnd = Math.max(effectiveEnd, normalizedStart);
        const eol = content.includes('\r\n') ? '\r\n' : '\n';
        const excerpt = lines.slice(normalizedStart - 1, normalizedEnd).join(eol);

        return {
          content: [{
            type: "text",
            text: `Content of ${filePath} (lines ${normalizedStart}-${normalizedEnd} of ${totalLines}):\n\n${excerpt}`
          }]
        };
      }
      
      return {
        content: [{
          type: "text",
          text: `Content of ${filePath}:\n\n${content}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error reading file: ${error.message}`
        }]
      };
    }
  }
);

// Tool 4: Write/Create file
server.registerTool("write_file",
  {
    title: "Write File",
    description: "Create or overwrite a file in a vault",
    inputSchema: {
      vaultName: z.string().describe("Name of the vault"),
      filePath: z.string().describe("Path to the file within the vault"),
      content: z.string().describe("Content to write to the file")
    }
  },
  async ({ vaultName, filePath, content }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const fullPath = path.join(vaultPath, filePath);
      
      // Ensure directory exists
      await fs.ensureDir(path.dirname(fullPath));
      
      await fs.writeFile(fullPath, content, 'utf8');
      
        return {
          content: [{
            type: "text",
            text: `File ${filePath} written successfully. Ricorda di aggiornare ${CONFIG_FILENAME} se il contenuto modifica le istruzioni o la struttura del vault.`
          }]
        };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error writing file: ${error.message}`
        }]
      };
    }
  }
);

// Tool 5: Modify file content incrementally
server.registerTool("modify_file",
  {
    title: "Modify File",
    description: "Apply targeted edits to a file without providing the entire replacement content",
    inputSchema: {
      vaultName: z.string().describe("Name of the vault"),
      filePath: z.string().describe("Path to the file within the vault"),
      operations: z.array(
        z.discriminatedUnion("type", [
          z.object({
            type: z.literal("append"),
            text: z.string().describe("Text to append to the end of the file")
          }),
          z.object({
            type: z.literal("prepend"),
            text: z.string().describe("Text to prepend to the start of the file")
          }),
          z.object({
            type: z.literal("insert_after"),
            anchor: z.string().min(1).describe("Text to insert after"),
            text: z.string().describe("Text to insert"),
            occurrence: z.number().int().min(1).optional().describe("Which occurrence of the anchor to use (default: first)")
          }),
          z.object({
            type: z.literal("insert_before"),
            anchor: z.string().min(1).describe("Text to insert before"),
            text: z.string().describe("Text to insert"),
            occurrence: z.number().int().min(1).optional().describe("Which occurrence of the anchor to use (default: first)")
          }),
          z.object({
            type: z.literal("replace"),
            target: z.string().min(1).describe("Text to replace"),
            text: z.string().describe("Replacement text"),
            occurrence: z.number().int().min(1).optional().describe("Replace the N-th occurrence (ignored if allOccurrences=true)"),
            allOccurrences: z.boolean().optional().describe("Replace all occurrences (default: false)")
          }),
          z.object({
            type: z.literal("replace_range"),
            startOffset: z.number().int().min(0).describe("Start character offset (0-based, inclusive)"),
            endOffset: z.number().int().min(0).describe("End character offset (0-based, exclusive)"),
            text: z.string().describe("Replacement text for the specified range")
          })
        ])
      ).min(1).describe("Ordered list of modifications to apply")
    }
  },
  async ({ vaultName, filePath, operations }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const fullPath = path.join(vaultPath, filePath);

      if (!await fs.pathExists(fullPath)) {
        return {
          content: [{
            type: "text",
            text: `File not found: ${filePath}`
          }]
        };
      }

      let content = await fs.readFile(fullPath, 'utf8');
      const originalContent = content;
      const notes = [];

      for (const [index, operation] of operations.entries()) {
        try {
          switch (operation.type) {
            case "append": {
              content += operation.text;
              notes.push(`Operation ${index + 1}: appended ${operation.text.length} characters`);
              break;
            }
            case "prepend": {
              content = operation.text + content;
              notes.push(`Operation ${index + 1}: prepended ${operation.text.length} characters`);
              break;
            }
            case "insert_after": {
              const occurrence = operation.occurrence ?? 1;
              const anchorIndex = findNthOccurrence(content, operation.anchor, occurrence);

              if (anchorIndex === -1) {
                throw new Error(`Anchor text not found for insert_after (occurrence ${occurrence})`);
              }

              const insertPos = anchorIndex + operation.anchor.length;
              content = content.slice(0, insertPos) + operation.text + content.slice(insertPos);
              notes.push(`Operation ${index + 1}: inserted after occurrence ${occurrence} of anchor`);
              break;
            }
            case "insert_before": {
              const occurrence = operation.occurrence ?? 1;
              const anchorIndex = findNthOccurrence(content, operation.anchor, occurrence);

              if (anchorIndex === -1) {
                throw new Error(`Anchor text not found for insert_before (occurrence ${occurrence})`);
              }

              content = content.slice(0, anchorIndex) + operation.text + content.slice(anchorIndex);
              notes.push(`Operation ${index + 1}: inserted before occurrence ${occurrence} of anchor`);
              break;
            }
            case "replace": {
              if (operation.allOccurrences) {
                const parts = content.split(operation.target);
                if (parts.length === 1) {
                  throw new Error("Target text not found for replace (all occurrences)");
                }
                content = parts.join(operation.text);
                notes.push(`Operation ${index + 1}: replaced all occurrences of target (${parts.length - 1} matches)`);
              } else {
                const occurrence = operation.occurrence ?? 1;
                const targetIndex = findNthOccurrence(content, operation.target, occurrence);

                if (targetIndex === -1) {
                  throw new Error(`Target text not found for replace (occurrence ${occurrence})`);
                }

                content = content.slice(0, targetIndex) + operation.text + content.slice(targetIndex + operation.target.length);
                notes.push(`Operation ${index + 1}: replaced occurrence ${occurrence} of target`);
              }
              break;
            }
            case "replace_range": {
              const { startOffset, endOffset, text } = operation;

              if (startOffset > endOffset) {
                throw new Error("replace_range startOffset must be less than or equal to endOffset");
              }

              if (endOffset > content.length) {
                throw new Error("replace_range endOffset exceeds file length");
              }

              content = content.slice(0, startOffset) + text + content.slice(endOffset);
              notes.push(`Operation ${index + 1}: replaced characters ${startOffset}-${endOffset}`);
              break;
            }
            default:
              throw new Error(`Unsupported operation type: ${operation.type}`);
          }
        } catch (operationError) {
          throw new Error(`Failed to apply operation ${index + 1} (${operation.type}): ${operationError.message}`);
        }
      }

      if (content === originalContent) {
        return {
          content: [{
            type: "text",
            text: `No changes applied to ${filePath}; operations left content unchanged.`
          }]
        };
      }

      await fs.writeFile(fullPath, content, 'utf8');

        return {
          content: [{
            type: "text",
            text: `File ${filePath} modified successfully.\n${notes.join('\n')}\nAggiorna ${CONFIG_FILENAME} se queste modifiche impattano workflow, convenzioni o sezioni documentate.`
          }]
        };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error modifying file: ${error.message}`
        }]
      };
    }
  }
);

// Tool 6: Vault overview helper
server.registerTool("get_vault_overview",
  {
    title: "Get Vault Overview",
    description: "Leggi automaticamente il file config.md di un vault per comprenderne struttura, scopo e istruzioni chiave",
    inputSchema: {
      vaultName: z.string().describe("Nome del vault")
    }
  },
  async ({ vaultName }) => {
    try {
      const { configPath } = await getVaultConfigPath(vaultName);

      if (!await fs.pathExists(configPath)) {
        return {
          content: [{
            type: "text",
            text: `Il file ${CONFIG_FILENAME} non esiste nel vault ${vaultName}. Esegui init_vault_config prima di usare questo strumento.`
          }]
        };
      }

      const content = await fs.readFile(configPath, "utf8");

      return {
        content: [{
          type: "text",
          text: `Contenuto di ${CONFIG_FILENAME} per ${vaultName}:\n\n${content}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Errore durante la lettura di ${CONFIG_FILENAME}: ${error.message}`
        }]
      };
    }
  }
);

// Tool 7: Initialize or refresh vault config
server.registerTool("init_vault_config",
  {
    title: "Initialize Vault Config",
    description: "Crea o rigenera il file config.md di un vault con istruzioni generali, panoramica della struttura e note operative",
    inputSchema: {
      vaultName: z.string().describe("Nome del vault"),
      overwrite: z.boolean().optional().describe("Sovrascrive il file config.md se già esistente (default: false)"),
      includeStructure: z.boolean().optional().describe("Include una panoramica automatica della struttura del vault (default: true)"),
      additionalContext: z.string().optional().describe("Testo extra da inserire nella sezione Purpose del config.md")
    }
  },
  async ({ vaultName, overwrite = false, includeStructure = true, additionalContext }) => {
    try {
      const { vaultPath, configPath } = await getVaultConfigPath(vaultName);
      const configExists = await fs.pathExists(configPath);

      if (configExists && !overwrite) {
        return {
          content: [{
            type: "text",
            text: `Il file ${CONFIG_FILENAME} esiste già nel vault ${vaultName}. Usa overwrite=true per rigenerarlo oppure modificalo manualmente.`
          }]
        };
      }

      let structureSection = "Nessuna panoramica automatica disponibile.";
      if (includeStructure) {
        const overview = await getVaultStructureOverview(vaultPath);
        const folderLines = overview.topLevelFolders.length > 0
          ? overview.topLevelFolders.map(name => `- ${name}/`).join("\n")
          : "- Nessuna cartella di primo livello rilevata.";

        structureSection = [
          "### Cartelle principali",
          folderLines,
          "",
          "### Statistiche rapide",
          `- File totali: ${overview.totalFiles}`,
          `- File Markdown: ${overview.markdownFiles}`
        ].join("\n");
      }

      const userContextBlock = additionalContext && additionalContext.trim().length > 0
        ? `${additionalContext.trim()}\n\n`
        : "";

      const timestamp = new Date().toISOString();
      const template = `# Vault Configuration Guide
_Last updated: ${timestamp}_

## Purpose
${userContextBlock}Descrivi qui lo scopo principale del vault, i tipi di informazione presenti e come vanno utilizzati i contenuti.

## Operating Principles
- Mantieni questo file aggiornato quando aggiungi sezioni, cartelle o processi importanti.
- Riassumi le convenzioni di naming, tag e collegamenti interni.
- Evidenzia le aree che richiedono attenzione speciale da parte dell'IA o dell'utente.

## Structure Snapshot
${structureSection}

## Key Entities & Workflows
- [ ] Elenca progetti, aree o temi critici.
- [ ] Descrivi eventuali workflow automatizzati o checklist.
- [ ] Indica i file di riferimento essenziali (ad esempio dashboard, index, roadmap).

## Maintenance Checklist
- Aggiorna questa sezione ogni volta che crei cartelle principali o nuove aree di lavoro.
- Aggiungi note quando rimuovi o archivi contenuti rilevanti.
- Specifica le priorità per la prossima sessione di lavoro dell'IA o dell'utente.

---

_Nota: questo file è gestito principalmente dall'IA MCP. L'utente può aggiungere informazioni chiave che l'IA deve conoscere. Se modifichi la struttura o i processi del vault, aggiorna sempre anche questo file._`;

      await fs.writeFile(configPath, template, "utf8");

      return {
        content: [{
          type: "text",
          text: `${CONFIG_FILENAME} creato/aggiornato con successo per il vault ${vaultName}.\nPercorso: ${configPath}\nRicorda di personalizzare la sezione Purpose e di mantenerla allineata alla struttura reale del vault.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Errore durante la generazione di ${CONFIG_FILENAME}: ${error.message}`
        }]
      };
    }
  }
);

// Tool 8: Search in specific file
server.registerTool("search_in_file",
  {
    title: "Search in File",
    description: "Search for text within a specific file",
    inputSchema: {
      vaultName: z.string().describe("Name of the vault"),
      filePath: z.string().describe("Path to the file within the vault"),
      searchTerm: z.string().describe("Text to search for")
    }
  },
  async ({ vaultName, filePath, searchTerm }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const fullPath = path.join(vaultPath, filePath);
      
      if (!await fs.pathExists(fullPath)) {
        return {
          content: [{
            type: "text",
            text: `File not found: ${filePath}`
          }]
        };
      }
      
      const matches = await searchInFile(fullPath, searchTerm);
      
      if (matches.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No matches found for "${searchTerm}" in ${filePath}`
          }]
        };
      }
      
      const result = `Found ${matches.length} matches for "${searchTerm}" in ${filePath}:\n\n` +
        matches.map(match => `Line ${match.line}: ${match.content}`).join('\n');
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error searching in file: ${error.message}`
        }]
      };
    }
  }
  );
  
// Tool 9: Search in folder
server.registerTool("search_in_folder",
    {
      title: "Search in Folder",
      description: "Search for text within files located in a specific folder of a vault",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        folderPath: z.string().describe("Folder path within the vault to search"),
        searchTerm: z.string().describe("Text to search for"),
        recursive: z.boolean().optional().describe("Search subfolders recursively (default: true)"),
        filePattern: z.string().optional().describe("Optional glob pattern relative to the folder (e.g., '*.md')")
      }
    },
    async ({ vaultName, folderPath, searchTerm, recursive = true, filePattern }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const folderFullPath = path.join(vaultPath, folderPath);

        if (!await fs.pathExists(folderFullPath)) {
          return {
            content: [{
              type: "text",
              text: `Folder not found: ${folderPath}`
            }]
          };
        }

        const stat = await fs.stat(folderFullPath);
        if (!stat.isDirectory()) {
          return {
            content: [{
              type: "text",
              text: `Path is not a directory: ${folderPath}`
            }]
          };
        }

        const patternSegment = filePattern ?? (recursive ? "**/*" : "*");
        const globPattern = path.join(folderFullPath, patternSegment);
        const files = await glob(globPattern, { nodir: true });

        if (files.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No files matched pattern "${patternSegment}" in ${folderPath}`
            }]
          };
        }

        const allMatches = [];

        for (const file of files) {
          const matches = await searchInFile(file, searchTerm);
          if (matches.length > 0) {
            allMatches.push({
              file: path.relative(vaultPath, file),
              matches
            });
          }
        }

        if (allMatches.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No matches found for "${searchTerm}" in folder ${folderPath}`
            }]
          };
        }

        let result = `Found matches for "${searchTerm}" in ${allMatches.length} file${allMatches.length === 1 ? '' : 's'} within ${folderPath}:\n\n`;

        allMatches.forEach(fileMatch => {
          result += `�Y"" ${fileMatch.file} (${fileMatch.matches.length} matches):\n`;
          fileMatch.matches.forEach(match => {
            result += `  Line ${match.line}: ${match.content}\n`;
          });
          result += '\n';
        });

        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error searching folder: ${error.message}`
          }]
        };
      }
    }
  );
  
// Tool 10: Global search in vault
server.registerTool("global_search",
  {
    title: "Global Search",
    description: "Search for text across all files in a vault",
    inputSchema: {
      vaultName: z.string().describe("Name of the vault"),
      searchTerm: z.string().describe("Text to search for"),
      filePattern: z.string().optional().describe("Optional file pattern (e.g., '*.md' for markdown files)")
    }
  },
  async ({ vaultName, searchTerm, filePattern = "**/*" }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const pattern = path.join(vaultPath, filePattern);
      const files = await glob(pattern, { nodir: true });
      
      const allMatches = [];
      
      for (const file of files) {
        const relativePath = path.relative(vaultPath, file);
        const matches = await searchInFile(file, searchTerm);
        
        if (matches.length > 0) {
          allMatches.push({
            file: relativePath,
            matches: matches
          });
        }
      }
      
      if (allMatches.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No matches found for "${searchTerm}" in vault ${vaultName}`
          }]
        };
      }
      
      let result = `Found matches for "${searchTerm}" in ${allMatches.length} files:\n\n`;
      
      allMatches.forEach(fileMatch => {
        result += `📄 ${fileMatch.file} (${fileMatch.matches.length} matches):\n`;
        fileMatch.matches.forEach(match => {
          result += `  Line ${match.line}: ${match.content}\n`;
        });
        result += '\n';
      });
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error in global search: ${error.message}`
        }]
      };
    }
  }
);

// Tool 11: Create folder
server.registerTool("create_folder",
  {
    title: "Create Folder",
    description: "Create a new folder in a vault Note: update config.md for related sections or workflows after deletion.",
    inputSchema: {
      vaultName: z.string().describe("Name of the vault"),
      folderPath: z.string().describe("Path of the folder to create")
    }
  },
  async ({ vaultName, folderPath }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const fullPath = path.join(vaultPath, folderPath);
      
      await fs.ensureDir(fullPath);
      
        return {
          content: [{
            type: "text",
            text: `Folder ${folderPath} created successfully. Documenta il nuovo ramo in ${CONFIG_FILENAME} per mantenere allineata la mappa del vault.`
          }]
        };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating folder: ${error.message}`
        }]
      };
    }
  }
);

// Tool 12: Delete file or folder
server.registerTool("delete_item",
  {
    title: "Delete Item",
    description: "Delete a file or folder from a vault Note: update config.md for related sections or workflows after deletion.",
    inputSchema: {
      vaultName: z.string().describe("Name of the vault"),
      itemPath: z.string().describe("Path to the file or folder to delete")
    }
  },
  async ({ vaultName, itemPath }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const fullPath = path.join(vaultPath, itemPath);
      
      if (!await fs.pathExists(fullPath)) {
        return {
          content: [{
            type: "text",
            text: `Item not found: ${itemPath}`
          }]
        };
      }
      
      await fs.remove(fullPath);
      
        return {
          content: [{
            type: "text",
            text: `Item ${itemPath} deleted successfully. Aggiorna ${CONFIG_FILENAME} se questa rimozione modifica sezioni o flussi descritti.`
          }]
        };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting item: ${error.message}`
        }]
      };
    }
  }
);

// Tool 13: Move/Rename item
server.registerTool("move_item",
  {
    title: "Move/Rename Item",
    description: "Move or rename a file or folder in a vault Note: update config.md for related sections or workflows after deletion.",
    inputSchema: {
      vaultName: z.string().describe("Name of the vault"),
      sourcePath: z.string().describe("Current path of the item"),
      destinationPath: z.string().describe("New path for the item")
    }
  },
  async ({ vaultName, sourcePath, destinationPath }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const sourceFullPath = path.join(vaultPath, sourcePath);
      const destFullPath = path.join(vaultPath, destinationPath);
      
      if (!await fs.pathExists(sourceFullPath)) {
        return {
          content: [{
            type: "text",
            text: `Source item not found: ${sourcePath}`
          }]
        };
      }
      
      // Ensure destination directory exists
      await fs.ensureDir(path.dirname(destFullPath));
      
      await fs.move(sourceFullPath, destFullPath);
      
        return {
          content: [{
            type: "text",
            text: `Item moved from ${sourcePath} to ${destinationPath}. Ricorda di riflettere lo spostamento in ${CONFIG_FILENAME} e negli eventuali riferimenti correlati.`
          }]
        };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error moving item: ${error.message}`
        }]
      };
    }
  }
);

// Tool 14: Get vault statistics
server.registerTool("get_vault_stats",
  {
    title: "Get Vault Statistics",
    description: "Get statistics about a vault (file count, folder count, etc.)",
    inputSchema: {
      vaultName: z.string().describe("Name of the vault")
    }
  },
  async ({ vaultName }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const allFiles = await glob(path.join(vaultPath, "**/*"), { nodir: true });
      const allFolders = await glob(path.join(vaultPath, "**/"), { onlyDirectories: true });
      
      const markdownFiles = allFiles.filter(file => path.extname(file) === '.md');
      const otherFiles = allFiles.filter(file => path.extname(file) !== '.md');
      
      const stats = {
        totalFiles: allFiles.length,
        markdownFiles: markdownFiles.length,
        otherFiles: otherFiles.length,
        folders: allFolders.length,
        vaultSize: 0
      };
      
      // Calculate vault size
      for (const file of allFiles) {
        try {
          const stat = await fs.stat(file);
          stats.vaultSize += stat.size;
        } catch (error) {
          // Skip files that can't be accessed
        }
      }
      
      const sizeInMB = (stats.vaultSize / 1024 / 1024).toFixed(2);
      
      const result = `Statistics for vault "${vaultName}":\n\n` +
        `📊 Total Files: ${stats.totalFiles}\n` +
        `📝 Markdown Files: ${stats.markdownFiles}\n` +
        `📄 Other Files: ${stats.otherFiles}\n` +
        `📁 Folders: ${stats.folders}\n` +
        `💾 Total Size: ${sizeInMB} MB`;
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting vault statistics: ${error.message}`
        }]
      };
    }
  }
);

// Resource: Vault contents
server.registerResource(
  "vault",
  new ResourceTemplate("vault://{vaultName}/{path*}", { list: undefined }),
  {
    title: "Vault Resource",
    description: "Access to vault files and folders"
  },
  async (uri, { vaultName, path }) => {
    try {
      const vaultPath = await getVaultPath(vaultName);
      const fullPath = path ? path.join(vaultPath, path) : vaultPath;
      
      if (!await fs.pathExists(fullPath)) {
        return {
          contents: [{
            uri: uri.href,
            text: `Path not found: ${path || '/'}`
          }]
        };
      }
      
      const stat = await fs.stat(fullPath);
      
      if (stat.isFile()) {
        const content = await fs.readFile(fullPath, 'utf8');
        return {
          contents: [{
            uri: uri.href,
            text: content
          }]
        };
      } else {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        const listing = entries.map(entry => 
          entry.isDirectory() ? `📁 ${entry.name}/` : `📄 ${entry.name}`
        ).join('\n');
        
        return {
          contents: [{
            uri: uri.href,
            text: `Contents of ${vaultName}${path ? `/${path}` : ''}:\n\n${listing}`
          }]
        };
      }
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error accessing vault: ${error.message}`
        }]
      };
    }
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Obsidian MCP Server started. Vault base path:", VAULT_BASE_PATH);
