# Obsidian MCP Server

Server MCP per gestire e automatizzare i vault di Obsidian tramite il Model Context Protocol. Permette a strumenti e IA di lavorare in modo coerente sui contenuti del vault.

## Caratteristiche

- Gestione completa dei vault: elenco, accesso e navigazione
- Operazioni sui file: lettura parziale, scrittura, modifiche mirate, spostamento ed eliminazione
- Ricerca avanzata: su singoli file, cartelle dedicate o su tutto il vault
- Guida contestuale: uso del file `config.md` per descrivere struttura, regole e flussi di lavoro
- Gestione cartelle: creazione, eliminazione e ridenominazione
- Statistiche: panoramica numerica sul contenuto del vault
- Risorse URI: accesso diretto a file e cartelle con schema `vault://`

## Installazione

1. Clona o scarica questo repository
2. Installa le dipendenze:
   ```bash
   npm install
   ```

## Configurazione

### Configurazione del Server MCP

Aggiungi al client MCP (ad esempio in `config.json`):

```json
{
  "mcpServers": {
    "obsidian-mcp": {
      "command": "node",
      "args": ["e:\\MCP_servers\\Obsidian-mcp\\index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "E:\\I_miei_vault_obsidian"
      }
    }
  }
}
```

### Variabili d Ambiente

- `OBSIDIAN_VAULT_PATH`: percorso della cartella che contiene i vault di Obsidian
  - Default: `C:/Users/User/Documents/Obsidian`
  - Esempio: `E:\\I_miei_vault_obsidian`

## File `config.md`

Il file `config.md`, situato nella root del vault, fornisce istruzioni strategiche per l IA e per l utente. Dovrebbe includere:

- scopo generale del vault e temi principali
- convenzioni di naming, tag e collegamenti tra note
- workflow importanti, priorita e riferimenti essenziali

Usa `init_vault_config` per generarlo o rigenerarlo e arricchiscilo con dettagli specifici. Prima di intervenire sul vault, richiama `get_vault_overview` per allinearti. Ogni volta che aggiungi, sposti o rimuovi elementi rilevanti, aggiorna anche `config.md`.

## Strumenti (Tools) Disponibili

### 1. **`list_vaults`**
Elenca i vault disponibili con informazioni opzionali dettagliate.

**Parametri:**
- `detailed` (opzionale): `boolean`

### 2. **`get_vault_names`**
Restituisce solo i nomi dei vault in formato array JSON.

### 3. **`list_vault_contents`**
Mostra file e cartelle presenti in un vault o in una sottocartella.

**Parametri:**
- `vaultName`: `string`
- `subPath` (opzionale): `string`

### 4. **`read_file`**
Legge il contenuto di un file con supporto per intervalli di righe.

**Parametri:**
- `vaultName`: `string`
- `filePath`: `string`
- `startLine` (opzionale): `number` (linea iniziale, 1-based)
- `endLine` (opzionale): `number` (linea finale inclusiva)

### 5. **`write_file`**
Crea o sovrascrive un file nel vault.

**Parametri:**
- `vaultName`: `string`
- `filePath`: `string`
- `content`: `string`

**Nota:** aggiorna `config.md` se il nuovo contenuto introduce regole o processi da documentare.

### 6. **`modify_file`**
Applica modifiche mirate senza riscrivere l intero file (append, prepend, insert, replace, replace_range).

**Parametri:**
- `vaultName`: `string`
- `filePath`: `string`
- `operations`: `Array` di operazioni ordinate

**Nota:** se le modifiche cambiano workflow o convenzioni, sincronizza `config.md`.

### 7. **`get_vault_overview`**
Legge e restituisce il contenuto di `config.md` per comprendere contesto e istruzioni.

**Parametri:**
- `vaultName`: `string`

**Note:** usa questo tool come primo passo prima di modificare il vault; se `config.md` manca, esegui `init_vault_config`.

### 8. **`init_vault_config`**
Genera o rigenera `config.md` con template, panoramica automatica e checklist.

**Parametri:**
- `vaultName`: `string`
- `overwrite` (opzionale): `boolean`
- `includeStructure` (opzionale): `boolean`
- `additionalContext` (opzionale): `string`

**Suggerimenti:** personalizza il template e aggiorna il file quando cambi struttura o processi.

### 9. **`search_in_file`**
Cerca testo all interno di un file specifico.

**Parametri:**
- `vaultName`: `string`
- `filePath`: `string`
- `searchTerm`: `string`

### 10. **`search_in_folder`**
Esegue ricerche limitate a una cartella (con supporto opzionale per ricorsione e glob).

**Parametri:**
- `vaultName`: `string`
- `folderPath`: `string`
- `searchTerm`: `string`
- `recursive` (opzionale): `boolean`
- `filePattern` (opzionale): `string`

### 11. **`global_search`**
Cerca testo in tutti i file del vault (con filtro per pattern).

**Parametri:**
- `vaultName`: `string`
- `searchTerm`: `string`
- `filePattern` (opzionale): `string`

### 12. **`create_folder`**
Crea una nuova cartella nel vault.

**Parametri:**
- `vaultName`: `string`
- `folderPath`: `string`

**Nota:** descrivi il nuovo ramo in `config.md` per mantenere la mappa del vault.

### 13. **`delete_item`**
Elimina file o cartelle.

**Parametri:**
- `vaultName`: `string`
- `itemPath`: `string`

**Nota:** annota in `config.md` la rimozione di elementi importanti.

### 14. **`move_item`**
Sposta o rinomina file e cartelle.

**Parametri:**
- `vaultName`: `string`
- `sourcePath`: `string`
- `destinationPath`: `string`

**Nota:** aggiorna `config.md` per riflettere i nuovi percorsi.

### 15. **`get_vault_stats`**
Restituisce conteggi e dimensioni del vault.

**Parametri:**
- `vaultName`: `string`

## Risorse (Resources)

### `vault://`

Accesso diretto a file e cartelle tramite URI `vault://{vaultName}/{path}`.

Esempi:
- `vault://MyVault/`
- `vault://MyVault/folder/file.md`
- `vault://MyVault/folder/`

## Esempi di Utilizzo

### Esempio 1: Visualizzare tutti i vault
```javascript
list_vaults()
```

### Esempio 2: Statistiche di un vault
```javascript
get_vault_stats({ vaultName: "PersonalNotes" })
```

### Esempio 3: Ricerca globale limitata ai Markdown
```javascript
global_search({
  vaultName: "PersonalNotes",
  searchTerm: "importante",
  filePattern: "*.md"
})
```

### Esempio 4: Creare e scrivere un file
```javascript
write_file({
  vaultName: "PersonalNotes",
  filePath: "daily/2025-07-16.md",
  content: "# Daily Note\n\n## Tasks\n- [ ] Completare progetto\n- [ ] Riunione alle 15:00"
})
```

### Esempio 5: Leggere solo parte di un file
```javascript
read_file({
  vaultName: "PersonalNotes",
  filePath: "projects/progetto-a.md",
  startLine: 10,
  endLine: 20
})
```

### Esempio 6: Applicare modifiche mirate
```javascript
modify_file({
  vaultName: "PersonalNotes",
  filePath: "tasks/inbox.md",
  operations: [
    { type: "replace", target: "- [ ] Nuovo task", text: "- [x] Nuovo task completato" },
    { type: "append", text: "\n- [ ] Task generato automaticamente" }
  ]
})
```

### Esempio 7: Consultare il contesto del vault
```javascript
get_vault_overview({ vaultName: "PersonalNotes" })
```

### Esempio 8: Rigenerare `config.md` con contesto extra
```javascript
init_vault_config({
  vaultName: "PersonalNotes",
  overwrite: true,
  additionalContext: "Vault dedicato a progetti personali e roadmap trimestrali."
})
```

## Sicurezza

- Le operazioni sono limitate al percorso definito in `OBSIDIAN_VAULT_PATH`
- I percorsi vengono validati per evitare traversal
- Scritture e cancellazioni avvengono solo all interno dei vault autorizzati

## Risoluzione Problemi

### Il server non trova i vault
1. Verifica `OBSIDIAN_VAULT_PATH`
2. Controlla che il percorso esista ed sia accessibile
3. Assicurati che i vault siano cartelle dirette del percorso indicato

### Errori di permessi
- Esegui Node con permessi adeguati
- Su Windows potrebbe essere necessario avviare come amministratore

### Errori di dipendenze
```bash
# reinstallare le dipendenze
npm install
```

## Licenza

Progetto distribuito con licenza MIT.

## Contributi

1. Fai fork del repository
2. Crea un branch per la tua feature
3. Commit delle modifiche
4. Push del branch
5. Apri una Pull Request

## Supporto

Apri un issue nel repository GitHub per domande o problemi.