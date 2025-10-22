import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import { z } from "zod";
import { getVaultPath, searchInFile } from "../utils.js";

export function registerSearchTools(server) {
  // Tool 8: Search in specific file
  server.registerTool(
    "search_in_file",
    {
      title: "Search in File",
      description: "Search for text within a specific file",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        filePath: z.string().describe("Path to the file within the vault"),
        searchTerm: z.string().describe("Text to search for"),
      },
    },
    async ({ vaultName, filePath, searchTerm }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const fullPath = path.join(vaultPath, filePath);
        if (!(await fs.pathExists(fullPath))) {
          return { content: [{ type: "text", text: `File not found: ${filePath}` }] };
        }
        const matches = await searchInFile(fullPath, searchTerm);
        if (matches.length === 0) {
          return { content: [{ type: "text", text: `No matches found for "${searchTerm}" in ${filePath}` }] };
        }
        const result =
          `Found ${matches.length} matches for "${searchTerm}" in ${filePath}:\n\n` +
          matches.map((match) => `Line ${match.line}: ${match.content}`).join("\n");
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error searching in file: ${error.message}` }] };
      }
    }
  );

  // Tool 9: Search in folder
  server.registerTool(
    "search_in_folder",
    {
      title: "Search in Folder",
      description: "Search for text within files located in a specific folder of a vault",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        folderPath: z.string().describe("Folder path within the vault to search"),
        searchTerm: z.string().describe("Text to search for"),
        recursive: z.boolean().optional().describe("Search subfolders recursively (default: true)"),
        filePattern: z
          .string()
          .optional()
          .describe("Optional glob pattern relative to the folder (e.g., '*.md')"),
      },
    },
    async ({ vaultName, folderPath, searchTerm, recursive = true, filePattern }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const folderFullPath = path.join(vaultPath, folderPath);
        if (!(await fs.pathExists(folderFullPath))) {
          return { content: [{ type: "text", text: `Folder not found: ${folderPath}` }] };
        }
        const stat = await fs.stat(folderFullPath);
        if (!stat.isDirectory()) {
          return { content: [{ type: "text", text: `Path is not a directory: ${folderPath}` }] };
        }
        const patternSegment = filePattern ?? (recursive ? "**/*" : "*");
        const globPattern = path.join(folderFullPath, patternSegment);
        const files = await glob(globPattern, { nodir: true });
        if (files.length === 0) {
          return { content: [{ type: "text", text: `No files matched pattern "${patternSegment}" in ${folderPath}` }] };
        }
        const allMatches = [];
        for (const file of files) {
          const matches = await searchInFile(file, searchTerm);
          if (matches.length > 0) {
            allMatches.push({ file: path.relative(vaultPath, file), matches });
          }
        }
        if (allMatches.length === 0) {
          return { content: [{ type: "text", text: `No matches found for "${searchTerm}" in folder ${folderPath}` }] };
        }
        let result = `Found matches for "${searchTerm}" in ${allMatches.length} file${allMatches.length === 1 ? "" : "s"} within ${folderPath}:\n\n`;
        allMatches.forEach((fileMatch) => {
          result += `📄 ${fileMatch.file} (${fileMatch.matches.length} matches):\n`;
          fileMatch.matches.forEach((match) => {
            result += `  Line ${match.line}: ${match.content}\n`;
          });
          result += "\n";
        });
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error searching folder: ${error.message}` }] };
      }
    }
  );

  // Tool 10: Global search in vault
  server.registerTool(
    "global_search",
    {
      title: "Global Search",
      description: "Search for text across all files in a vault",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        searchTerm: z.string().describe("Text to search for"),
        filePattern: z.string().optional().describe("Optional file pattern (e.g., '*.md' for markdown files)"),
      },
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
            allMatches.push({ file: relativePath, matches });
          }
        }
        if (allMatches.length === 0) {
          return { content: [{ type: "text", text: `No matches found for "${searchTerm}" in vault ${vaultName}` }] };
        }
        let result = `Found matches for "${searchTerm}" in ${allMatches.length} files:\n\n`;
        allMatches.forEach((fileMatch) => {
          result += `📄 ${fileMatch.file} (${fileMatch.matches.length} matches):\n`;
          fileMatch.matches.forEach((match) => {
            result += `  Line ${match.line}: ${match.content}\n`;
          });
          result += "\n";
        });
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error in global search: ${error.message}` }] };
      }
    }
  );
}

