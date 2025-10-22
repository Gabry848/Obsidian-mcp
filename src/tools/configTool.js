import fs from "fs-extra";
import { z } from "zod";
import { CONFIG_FILENAME } from "../config.js";
import { getVaultConfigPath, getVaultStructureOverview } from "../utils.js";

export function registerConfigTool(server) {
  // Tool 7: Initialize or refresh vault config
  server.registerTool(
    "init_vault_config",
    {
      title: "Initialize Vault Config",
      description:
        "Crea o rigenera il file config.md di un vault con istruzioni generali, panoramica della struttura e note operative",
      inputSchema: {
        vaultName: z.string().describe("Nome del vault"),
        overwrite: z.boolean().optional().describe("Sovrascrive il file config.md se già esistente (default: false)"),
        includeStructure: z
          .boolean()
          .optional()
          .describe("Include una panoramica automatica della struttura del vault (default: true)"),
        additionalContext: z.string().optional().describe("Testo extra da inserire nella sezione Purpose del config.md"),
      },
    },
    async ({ vaultName, overwrite = false, includeStructure = true, additionalContext }) => {
      try {
        const { vaultPath, configPath } = await getVaultConfigPath(vaultName);
        const configExists = await fs.pathExists(configPath);
        if (configExists && !overwrite) {
          return {
            content: [
              {
                type: "text",
                text: `Il file ${CONFIG_FILENAME} esiste già nel vault ${vaultName}. Usa overwrite=true per rigenerarlo oppure modificalo manualmente.`,
              },
            ],
          };
        }
        let structureSection = "Nessuna panoramica automatica disponibile.";
        if (includeStructure) {
          const overview = await getVaultStructureOverview(vaultPath);
          const folderLines =
            overview.topLevelFolders.length > 0
              ? overview.topLevelFolders.map((name) => `- ${name}/`).join("\n")
              : "- Nessuna cartella di primo livello rilevata.";
          structureSection = [
            "### Cartelle principali",
            folderLines,
            "",
            "### Statistiche rapide",
            `- File totali: ${overview.totalFiles}`,
            `- File Markdown: ${overview.markdownFiles}`,
          ].join("\n");
        }
        const userContextBlock = additionalContext && additionalContext.trim().length > 0 ? `${additionalContext.trim()}\n\n` : "";
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

_Nota: questo file è gestito in collaborazione tra utente e agente. Mantienilo sempre aggiornato per massimizzare l'efficacia dell'assistenza._
`;

        await fs.writeFile(configPath, template, "utf8");
        return {
          content: [
            {
              type: "text",
              text: `File ${CONFIG_FILENAME} generato o aggiornato in ${vaultName}. Mantieni questo documento come fonte di verità per la struttura e le regole del vault.`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Errore durante la generazione di ${CONFIG_FILENAME}: ${error.message}` }] };
      }
    }
  );
}

