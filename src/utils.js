import fs from "fs-extra";
import path from "path";
import { glob } from "glob";

export async function getVaultPath(vaultName) {
  const vaultPath = path.join(process.env.OBSIDIAN_VAULT_PATH || "C:/Users/User/Documents/Obsidian", vaultName);
  if (!await fs.pathExists(vaultPath)) {
    throw new Error(`Vault '${vaultName}' not found at ${vaultPath}`);
  }
  return vaultPath;
}

export async function isMarkdownFile(filePath) {
  return path.extname(filePath).toLowerCase() === ".md";
}

export async function searchInFile(filePath, searchTerm) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split("\n");
    const matches = [];
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
        matches.push({ line: index + 1, content: line.trim() });
      }
    });
    return matches;
  } catch {
    return [];
  }
}

export function findNthOccurrence(haystack, needle, occurrence = 1) {
  if (!needle) {
    throw new Error("Anchor/target text must not be empty");
  }
  let index = -1;
  let fromIndex = 0;
  for (let i = 0; i < occurrence; i++) {
    index = haystack.indexOf(needle, fromIndex);
    if (index === -1) return -1;
    fromIndex = index + needle.length;
  }
  return index;
}

export async function getVaultConfigPath(vaultName) {
  const vaultPath = await getVaultPath(vaultName);
  return { vaultPath, configPath: path.join(vaultPath, "config.md") };
}

export async function getVaultStructureOverview(vaultPath) {
  const overview = { topLevelFolders: [], markdownFiles: 0, totalFiles: 0 };
  try {
    const entries = await fs.readdir(vaultPath, { withFileTypes: true });
    overview.topLevelFolders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {}
  try {
    const allFiles = await glob(path.join(vaultPath, "**/*"), { nodir: true });
    overview.totalFiles = allFiles.length;
    overview.markdownFiles = allFiles.filter(file => path.extname(file).toLowerCase() === ".md").length;
  } catch {}
  return overview;
}

