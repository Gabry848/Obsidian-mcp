import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import { glob } from "glob";

// Configuration
const VAULT_BASE_PATH = process.env.OBSIDIAN_VAULT_PATH || "C:/Users/User/Documents/Obsidian";

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

// Tool 1: List all vaults
server.registerTool("list_vaults",
  {
    title: "List Vaults",
    description: "List all available Obsidian vaults",
    inputSchema: {}
  },
  async () => {
    try {
      const entries = await fs.readdir(VAULT_BASE_PATH, { withFileTypes: true });
      const vaults = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
      
      return {
        content: [{
          type: "text",
          text: `Available vaults:\n${vaults.map(v => `- ${v}`).join('\n')}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error listing vaults: ${error.message}`
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
      filePath: z.string().describe("Path to the file within the vault")
    }
  },
  async ({ vaultName, filePath }) => {
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
      
      const content = await fs.readFile(fullPath, 'utf8');
      
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
          text: `File ${filePath} written successfully`
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

// Tool 5: Search in specific file
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

// Tool 6: Global search in vault
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

// Tool 7: Create folder
server.registerTool("create_folder",
  {
    title: "Create Folder",
    description: "Create a new folder in a vault",
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
          text: `Folder ${folderPath} created successfully`
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

// Tool 8: Delete file or folder
server.registerTool("delete_item",
  {
    title: "Delete Item",
    description: "Delete a file or folder from a vault",
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
          text: `Item ${itemPath} deleted successfully`
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

// Tool 9: Move/Rename item
server.registerTool("move_item",
  {
    title: "Move/Rename Item",
    description: "Move or rename a file or folder in a vault",
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
          text: `Item moved from ${sourcePath} to ${destinationPath}`
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

// Tool 10: Get vault statistics
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