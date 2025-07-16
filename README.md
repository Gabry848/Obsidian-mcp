# Obsidian MCP Server

Un server MCP (Model Context Protocol) completo per la gestione dei vault di Obsidian. Questo server permette di interagire con i tuoi vault Obsidian attraverso un'interfaccia MCP standardizzata.

## 🚀 Caratteristiche

- **Gestione completa dei vault**: Elenca, visualizza e gestisce tutti i tuoi vault Obsidian
- **Operazioni sui file**: Leggi, scrivi, sposta, elimina e rinomina file
- **Ricerca avanzata**: Cerca testo in file specifici o in tutto il vault
- **Gestione cartelle**: Crea, elimina e gestisci le cartelle
- **Statistiche**: Ottieni informazioni dettagliate sui vault
- **Risorse URI**: Accesso diretto ai contenuti tramite URI `vault://`

## 📦 Installazione

1. **Clona o scarica** questo repository
2. **Installa le dipendenze**:
   ```bash
   npm install
   ```

## ⚙️ Configurazione

### Configurazione del Server MCP

Aggiungi questa configurazione al tuo client MCP (solitamente in `config.json`):

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

### Variabili d'Ambiente

- **`OBSIDIAN_VAULT_PATH`**: Percorso alla cartella che contiene i tuoi vault Obsidian
  - Default: `C:/Users/User/Documents/Obsidian`
  - Esempio: `E:\\I_miei_vault_obsidian`

## 🔧 Strumenti (Tools) Disponibili

### 1. **`list_vaults`**
Elenca tutti i vault disponibili con informazioni opzionali dettagliate.

**Parametri:**
- `detailed` (opzionale): `boolean` - Mostra informazioni dettagliate su ogni vault

**Esempi:**
```javascript
// Lista semplice
list_vaults()

// Lista con dettagli
list_vaults({ detailed: true })
```

### 2. **`get_vault_names`**
Ottiene un array JSON semplice con solo i nomi dei vault.

### 3. **`list_vault_contents`**
Elenca file e cartelle in un vault specifico o in una sottocartella.

**Parametri:**
- `vaultName`: `string` - Nome del vault
- `subPath` (opzionale): `string` - Percorso della sottocartella

### 4. **`read_file`**
Legge il contenuto di un file in un vault.

**Parametri:**
- `vaultName`: `string` - Nome del vault
- `filePath`: `string` - Percorso del file nel vault

### 5. **`write_file`**
Crea o sovrascrive un file in un vault.

**Parametri:**
- `vaultName`: `string` - Nome del vault
- `filePath`: `string` - Percorso del file nel vault
- `content`: `string` - Contenuto da scrivere

### 6. **`search_in_file`**
Cerca testo in un file specifico.

**Parametri:**
- `vaultName`: `string` - Nome del vault
- `filePath`: `string` - Percorso del file
- `searchTerm`: `string` - Testo da cercare

### 7. **`global_search`**
Cerca testo in tutti i file di un vault.

**Parametri:**
- `vaultName`: `string` - Nome del vault
- `searchTerm`: `string` - Testo da cercare
- `filePattern` (opzionale): `string` - Pattern dei file (es: `*.md`)

### 8. **`create_folder`**
Crea una nuova cartella in un vault.

**Parametri:**
- `vaultName`: `string` - Nome del vault
- `folderPath`: `string` - Percorso della cartella da creare

### 9. **`delete_item`**
Elimina un file o cartella da un vault.

**Parametri:**
- `vaultName`: `string` - Nome del vault
- `itemPath`: `string` - Percorso dell'elemento da eliminare

### 10. **`move_item`**
Sposta o rinomina un file o cartella.

**Parametri:**
- `vaultName`: `string` - Nome del vault
- `sourcePath`: `string` - Percorso attuale
- `destinationPath`: `string` - Nuovo percorso

### 11. **`get_vault_stats`**
Ottiene statistiche dettagliate su un vault.

**Parametri:**
- `vaultName`: `string` - Nome del vault

## 📁 Risorse (Resources)

### `vault://`
Accesso diretto ai contenuti del vault tramite URI.

**Schema URI:** `vault://{vaultName}/{path}`

**Esempi:**
- `vault://MyVault/` - Contenuti della root del vault
- `vault://MyVault/folder/file.md` - File specifico
- `vault://MyVault/folder/` - Contenuti di una cartella

## 🌟 Esempi di Utilizzo

### Esempio 1: Visualizzare tutti i vault
```javascript
// Lista semplice
list_vaults()

// Output:
// 📁 Found 3 vaults in: E:\I_miei_vault_obsidian
// 
// 🗃️  PersonalNotes
// 🗃️  WorkProjects
// 🗃️  Research
```

### Esempio 2: Ottenere statistiche di un vault
```javascript
get_vault_stats({ vaultName: "PersonalNotes" })

// Output:
// Statistics for vault "PersonalNotes":
// 
// 📊 Total Files: 156
// 📝 Markdown Files: 142
// 📄 Other Files: 14
// 📁 Folders: 8
// 💾 Total Size: 2.34 MB
```

### Esempio 3: Cercare testo in tutto il vault
```javascript
global_search({ 
  vaultName: "PersonalNotes", 
  searchTerm: "importante",
  filePattern: "*.md"
})

// Output:
// Found matches for "importante" in 3 files:
// 
// 📄 notes/meeting.md (2 matches):
//   Line 15: Questo punto è molto importante
//   Line 23: Importante: scadenza 30 giorni
// 
// 📄 projects/project1.md (1 matches):
//   Line 5: Nota importante sul progetto
```

### Esempio 4: Creare e scrivere un file
```javascript
write_file({
  vaultName: "PersonalNotes",
  filePath: "daily/2025-07-16.md",
  content: "# Daily Note - 16/07/2025\n\n## Tasks\n- [ ] Completare progetto\n- [ ] Riunione alle 15:00"
})

// Output:
// File daily/2025-07-16.md written successfully
```

## 🔐 Sicurezza

- Il server opera solo all'interno del percorso specificato in `OBSIDIAN_VAULT_PATH`
- Tutti i percorsi sono validati per prevenire directory traversal
- I file vengono letti/scritti solo all'interno dei vault autorizzati

## 🐛 Risoluzione Problemi

### Il server non trova i vault
1. Verifica che la variabile `OBSIDIAN_VAULT_PATH` sia impostata correttamente
2. Controlla che il percorso esista e sia accessibile
3. Assicurati che i vault siano cartelle nella directory specificata

### Errori di permessi
- Verifica che il processo Node.js abbia i permessi di lettura/scrittura sulla directory dei vault
- Su Windows, potresti dover eseguire come amministratore

### Errori di dipendenze
```bash
# Reinstalla le dipendenze
npm install
```

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT.

## 🤝 Contributi

I contributi sono benvenuti! Per favore:

1. Fai un fork del repository
2. Crea un branch per la tua feature
3. Commit le tue modifiche
4. Fai push del branch
5. Apri una Pull Request

## 📞 Supporto

Per problemi o domande, apri un issue nel repository GitHub.

---

**Note:** Questo server MCP è progettato per funzionare con vault Obsidian standard. Assicurati che i tuoi vault siano strutturati correttamente e accessibili dal filesystem.
