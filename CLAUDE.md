# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend development
npm run dev          # Start Vite dev server (localhost:1420)
npm run build        # TypeScript check + Vite build
npm run preview      # Preview production build

# Desktop app (requires Rust toolchain)
npm run tauri dev    # Run full Tauri app in development
npm run tauri build  # Build distributable desktop app
```

No test framework is configured. TypeScript strict mode acts as the primary correctness check (`npm run build`).

## Architecture

ZenNotes is a Tauri 2 desktop app: React/TypeScript frontend + Rust backend communicating via Tauri commands.

### Frontend (`/src`)

**State**: Single Zustand store (`src/store/index.ts`) holds the entire vault tree (`nodes: FileNode[]`), current note path, active view, and settings. After any mutation (create/delete/rename), call `hydrate()` to rebuild the tree from disk.

**Routing**: No router library. `App.tsx` switches between 4 views via `mainView` state: `afk` (HomeScreen), `folders` (MainFolderBrowser), `editor` (BlockNoteEditor), `trash` (TrashView).

**Editor**: BlockNote with 1-second debounced auto-save. Converts blocks ↔ markdown via `blocksToMarkdownLossy`/`markdownToBlocks` for file storage. Images uploaded via `save_asset_in_vault` and embedded as Tauri file URIs.

**Theming**: CSS custom property `--app-accent` drives accent color (blue/red/green/purple). Dark mode via `prefers-color-scheme`. BlockNote CSS variables are overridden in `BlockNoteEditor.tsx` for dark mode consistency.

### Backend (`/src-tauri/src/notes.rs`)

All 11 Tauri commands live in `notes.rs`:

| Command | Purpose |
|---|---|
| `parse_vault` | Recursively builds FileNode tree; folders first, files newest-first |
| `read_note_content` / `write_note_content` | Read/write markdown files |
| `save_asset_in_vault` | Saves images to `assets/` with timestamped unique names |
| `create_folder` | Creates directory |
| `delete_element` | Soft-deletes to `.trash/` with timestamp suffix |
| `restore_trash_element` | Restores from `.trash/`, strips timestamp, handles collisions |
| `empty_trash` | Permanently removes `.trash/` folder |
| `search_vault` | Full-text search across filenames and content |
| `get_trash_items` | Lists `.trash/` contents |
| `rename_element` | Renames files/folders |

### Key Patterns

- **Soft delete**: Items move to `{vault}/.trash/` with a timestamp appended to the filename to avoid collisions.
- **Assets**: All media stored in `{vault}/assets/`; `parse_vault` skips this folder when building the tree.
- **Snippets**: `parse_vault` extracts the first 100 characters of each note for card previews — stored in `FileNode`, not re-read on render.
- **Persistent settings**: Vault path and accent color persisted via Tauri Store plugin, hydrated on app init in the Zustand store.
