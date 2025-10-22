import fs from "fs-extra";
import path from "path";
import { z } from "zod";
import { CONFIG_FILENAME } from "../config.js";
import { getVaultPath, findNthOccurrence } from "../utils.js";

export function registerFileTools(server) {
  // Tool 3: Read file content
  server.registerTool(
    "read_file",
    {
      title: "Read File",
      description: "Read the content of a file in a vault",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        filePath: z.string().describe("Path to the file within the vault"),
        startLine: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Optional 1-based line number to start reading from"),
        endLine: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Optional 1-based line number to stop reading at (inclusive)"),
      },
    },
    async ({ vaultName, filePath, startLine, endLine }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const fullPath = path.join(vaultPath, filePath);
        if (!(await fs.pathExists(fullPath))) {
          return { content: [{ type: "text", text: `File not found: ${filePath}` }] };
        }
        if (endLine !== undefined && startLine !== undefined && endLine < startLine) {
          return { content: [{ type: "text", text: "endLine must be greater than or equal to startLine" }] };
        }
        const content = await fs.readFile(fullPath, "utf8");
        const hasLineRange = startLine !== undefined || endLine !== undefined;
        if (hasLineRange) {
          const lines = content.split(/\r?\n/);
          const totalLines = lines.length;
          const effectiveStart = startLine !== undefined ? startLine : 1;
          const effectiveEnd = endLine !== undefined ? Math.min(endLine, totalLines) : totalLines;
          if (effectiveStart > totalLines) {
            return {
              content: [
                { type: "text", text: `Start line ${effectiveStart} exceeds total lines (${totalLines}) in ${filePath}` },
              ],
            };
          }
          const normalizedStart = Math.max(effectiveStart, 1);
          const normalizedEnd = Math.max(effectiveEnd, normalizedStart);
          const eol = content.includes("\r\n") ? "\r\n" : "\n";
          const excerpt = lines.slice(normalizedStart - 1, normalizedEnd).join(eol);
          return {
            content: [
              { type: "text", text: `Content of ${filePath} (lines ${normalizedStart}-${normalizedEnd} of ${totalLines}):\n\n${excerpt}` },
            ],
          };
        }
        return { content: [{ type: "text", text: `Content of ${filePath}:\n\n${content}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error reading file: ${error.message}` }] };
      }
    }
  );

  // Tool 4: Write/Create file
  server.registerTool(
    "write_file",
    {
      title: "Write File",
      description: "Create or overwrite a file in a vault",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        filePath: z.string().describe("Path to the file within the vault"),
        content: z.string().describe("Content to write to the file"),
      },
    },
    async ({ vaultName, filePath, content }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const fullPath = path.join(vaultPath, filePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content, "utf8");
        return {
          content: [
            {
              type: "text",
              text: `File ${filePath} written successfully. Ricorda di aggiornare ${CONFIG_FILENAME} se il contenuto modifica le istruzioni o la struttura del vault.`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Error writing file: ${error.message}` }] };
      }
    }
  );

  // Tool 5: Modify file content incrementally
  server.registerTool(
    "modify_file",
    {
      title: "Modify File",
      description: "Apply targeted edits to a file without providing the entire replacement content",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        filePath: z.string().describe("Path to the file within the vault"),
        operations: z
          .array(
            z.discriminatedUnion("type", [
              z.object({ type: z.literal("append"), text: z.string().describe("Text to append to the end of the file") }),
              z.object({ type: z.literal("prepend"), text: z.string().describe("Text to prepend to the start of the file") }),
              z.object({
                type: z.literal("insert_after"),
                anchor: z.string().min(1).describe("Text to insert after"),
                text: z.string().describe("Text to insert"),
                occurrence: z.number().int().min(1).optional().describe("Which occurrence of the anchor to use (default: first)"),
              }),
              z.object({
                type: z.literal("insert_before"),
                anchor: z.string().min(1).describe("Text to insert before"),
                text: z.string().describe("Text to insert"),
                occurrence: z.number().int().min(1).optional().describe("Which occurrence of the anchor to use (default: first)"),
              }),
              z.object({
                type: z.literal("replace"),
                target: z.string().min(1).describe("Text to replace"),
                text: z.string().describe("Replacement text"),
                occurrence: z
                  .number()
                  .int()
                  .min(1)
                  .optional()
                  .describe("Replace the N-th occurrence (ignored if allOccurrences=true)"),
                allOccurrences: z.boolean().optional().describe("Replace all occurrences (default: false)"),
              }),
              z.object({
                type: z.literal("replace_range"),
                startOffset: z.number().int().min(0).describe("Start character offset (0-based, inclusive)"),
                endOffset: z.number().int().min(0).describe("End character offset (0-based, exclusive)"),
                text: z.string().describe("Replacement text for the specified range"),
              }),
            ])
          )
          .min(1)
          .describe("Ordered list of modifications to apply"),
      },
    },
    async ({ vaultName, filePath, operations }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const fullPath = path.join(vaultPath, filePath);
        if (!(await fs.pathExists(fullPath))) {
          return { content: [{ type: "text", text: `File not found: ${filePath}` }] };
        }
        let content = await fs.readFile(fullPath, "utf8");
        const originalContent = content;
        const notes = [];
        for (const [index, operation] of operations.entries()) {
          try {
            switch (operation.type) {
              case "append":
                content += operation.text;
                notes.push(`Operation ${index + 1}: appended ${operation.text.length} characters`);
                break;
              case "prepend":
                content = operation.text + content;
                notes.push(`Operation ${index + 1}: prepended ${operation.text.length} characters`);
                break;
              case "insert_after": {
                const occurrence = operation.occurrence ?? 1;
                const anchorIndex = findNthOccurrence(content, operation.anchor, occurrence);
                if (anchorIndex === -1) throw new Error(`Anchor text not found for insert_after (occurrence ${occurrence})`);
                const insertPos = anchorIndex + operation.anchor.length;
                content = content.slice(0, insertPos) + operation.text + content.slice(insertPos);
                notes.push(`Operation ${index + 1}: inserted after occurrence ${occurrence} of anchor`);
                break;
              }
              case "insert_before": {
                const occurrence = operation.occurrence ?? 1;
                const anchorIndex = findNthOccurrence(content, operation.anchor, occurrence);
                if (anchorIndex === -1) throw new Error(`Anchor text not found for insert_before (occurrence ${occurrence})`);
                content = content.slice(0, anchorIndex) + operation.text + content.slice(anchorIndex);
                notes.push(`Operation ${index + 1}: inserted before occurrence ${occurrence} of anchor`);
                break;
              }
              case "replace": {
                if (operation.allOccurrences) {
                  const parts = content.split(operation.target);
                  if (parts.length === 1) throw new Error("Target text not found for replace (all occurrences)");
                  content = parts.join(operation.text);
                  notes.push(`Operation ${index + 1}: replaced all occurrences of target (${parts.length - 1} matches)`);
                } else {
                  const occurrence = operation.occurrence ?? 1;
                  const targetIndex = findNthOccurrence(content, operation.target, occurrence);
                  if (targetIndex === -1) throw new Error(`Target text not found for replace (occurrence ${occurrence})`);
                  content = content.slice(0, targetIndex) + operation.text + content.slice(targetIndex + operation.target.length);
                  notes.push(`Operation ${index + 1}: replaced occurrence ${occurrence} of target`);
                }
                break;
              }
              case "replace_range": {
                const { startOffset, endOffset, text } = operation;
                if (startOffset > endOffset) throw new Error("replace_range startOffset must be less than or equal to endOffset");
                if (endOffset > content.length) throw new Error("replace_range endOffset exceeds file length");
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
          return { content: [{ type: "text", text: `No changes applied to ${filePath}; operations left content unchanged.` }] };
        }
        await fs.writeFile(fullPath, "utf8");
        await fs.writeFile(fullPath, content, "utf8");
        return {
          content: [
            {
              type: "text",
              text: `File ${filePath} modified successfully.\n${notes.join("\n")}\nAggiorna ${CONFIG_FILENAME} se queste modifiche impattano workflow, convenzioni o sezioni documentate.`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Error modifying file: ${error.message}` }] };
      }
    }
  );

  // Tool 11: Create folder
  server.registerTool(
    "create_folder",
    {
      title: "Create Folder",
      description:
        "Create a new folder in a vault Note: update config.md for related sections or workflows after deletion.",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        folderPath: z.string().describe("Path of the folder to create"),
      },
    },
    async ({ vaultName, folderPath }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const fullPath = path.join(vaultPath, folderPath);
        await fs.ensureDir(fullPath);
        return {
          content: [
            {
              type: "text",
              text: `Folder ${folderPath} created successfully. Documenta il nuovo ramo in ${CONFIG_FILENAME} per mantenere allineata la mappa del vault.`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Error creating folder: ${error.message}` }] };
      }
    }
  );

  // Tool 12: Delete file or folder
  server.registerTool(
    "delete_item",
    {
      title: "Delete Item",
      description:
        "Delete a file or folder from a vault Note: update config.md for related sections or workflows after deletion.",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        itemPath: z.string().describe("Path to the file or folder to delete"),
      },
    },
    async ({ vaultName, itemPath }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const fullPath = path.join(vaultPath, itemPath);
        if (!(await fs.pathExists(fullPath))) {
          return { content: [{ type: "text", text: `Item not found: ${itemPath}` }] };
        }
        await fs.remove(fullPath);
        return {
          content: [
            {
              type: "text",
              text: `Item ${itemPath} deleted successfully. Aggiorna ${CONFIG_FILENAME} se questa rimozione modifica sezioni o flussi descritti.`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Error deleting item: ${error.message}` }] };
      }
    }
  );

  // Tool 13: Move/Rename item
  server.registerTool(
    "move_item",
    {
      title: "Move/Rename Item",
      description:
        "Move or rename a file or folder in a vault Note: update config.md for related sections or workflows after deletion.",
      inputSchema: {
        vaultName: z.string().describe("Name of the vault"),
        sourcePath: z.string().describe("Current path of the item"),
        destinationPath: z.string().describe("New path for the item"),
      },
    },
    async ({ vaultName, sourcePath, destinationPath }) => {
      try {
        const vaultPath = await getVaultPath(vaultName);
        const sourceFullPath = path.join(vaultPath, sourcePath);
        const destFullPath = path.join(vaultPath, destinationPath);
        if (!(await fs.pathExists(sourceFullPath))) {
          return { content: [{ type: "text", text: `Source item not found: ${sourcePath}` }] };
        }
        await fs.ensureDir(path.dirname(destFullPath));
        await fs.move(sourceFullPath, destFullPath);
        return {
          content: [
            {
              type: "text",
              text: `Item moved from ${sourcePath} to ${destinationPath}. Ricorda di riflettere lo spostamento in ${CONFIG_FILENAME} e negli eventuali riferimenti correlati.`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Error moving item: ${error.message}` }] };
      }
    }
  );
}

