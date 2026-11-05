# Architecture

```text
Figma text nodes
      │
      ▼
Fix it Plugin (code.js + ui.html)
      │      ├─ local glossary / formatting checks
      │      ├─ Figma plugin clientStorage for user-provided rules
      │      └─ read-only issues + layer navigation
      │
      ├── optional localhost:38411 / Confluence bridge
      │     └─ fetches a requested page using environment-provided credentials
      │
      └── optional localhost:38412 / companion.js
            ├─ stores submitted scan snapshots in ~/.fix-it-local
            ├─ exposes MCP tools to Claude Desktop
            └─ returns user-reviewed AI findings to the plugin
```

## Boundaries

- **Figma plugin:** extracts text and presents findings, but does not modify design copy.
- **Local Confluence bridge:** opt-in. No credentials are embedded in source or sent to Figma.
- **Claude MCP companion:** local server, connection-code authenticated; launched via `setup-claude.mjs`.
- **AI model:** runs in the user-authorized Claude environment. No Claude API key is needed for this workflow.
- **Lokalise/Git sync:** not implemented.

## Data privacy
No content from user-owned Figma documents or corporate writing guides is shipped with this repository. Any user-provided data stays in Figma storage or local companion files unless explicitly shared with an external integration.
