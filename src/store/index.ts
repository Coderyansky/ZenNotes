import { useEffect } from "react";
import { load, Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export type FileNode =
  | {
      type: "File";
      id: string;
      name: string;
      path: string;
      modified_at: number;
      snippet?: string;
      file_type?: "note" | "image" | "pdf";
    }
  | {
      type: "Folder";
      id: string;
      name: string;
      path: string;
      children: FileNode[];
    };

export type ViewingAsset = {
  path: string;
  type: "image" | "pdf";
  name: string;
};

export type NoteFile = Extract<FileNode, { type: "File" }>;

export type EditorSettings = {
  fontSize: number;
  lineHeight: number;
  fontFamily: "sans" | "mono" | "serif";
};

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 16,
  lineHeight: 1.7,
  fontFamily: "sans",
};

interface AppState {
  vaultPath: string | null;
  setVaultPath: (path: string | null) => Promise<void>;
  zenMode: boolean;
  setZenMode: (isZen: boolean) => void;
  isHydrated: boolean;
  hydrate: () => Promise<void>;

  // V3 Store Architecture
  nodes: FileNode[];
  setNodes: (nodes: FileNode[]) => void;
  currentNote: NoteFile | null;
  setCurrentNote: (note: NoteFile | null) => void;
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  activeFilter: "all" | null;
  setActiveFilter: (filter: "all" | null) => void;
  accentColor: "blue" | "red" | "green" | "purple" | "orange" | "yellow" | "teal" | "pink" | "indigo";
  setAccentColor: (color: AppState["accentColor"]) => void;
  colorScheme: "system" | "light" | "dark" | "sepia" | "midnight";
  setColorScheme: (scheme: AppState["colorScheme"]) => void;

  mainView: "afk" | "folders" | "editor" | "trash";
  setMainView: (view: "afk" | "folders" | "editor" | "trash") => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (isOpen: boolean) => void;
  viewingAsset: ViewingAsset | null;
  setViewingAsset: (asset: ViewingAsset | null) => void;

  // Pinned notes
  pinnedNotes: string[];
  togglePin: (path: string) => Promise<void>;

  // Editor settings
  editorSettings: EditorSettings;
  setEditorSettings: (settings: Partial<EditorSettings>) => Promise<void>;

  // Custom hotkeys
  customHotkeys: Record<string, string>;
  setCustomHotkey: (action: string, combo: string) => Promise<void>;

  // Backup
  backupPath: string | null;
  setBackupPath: (path: string | null) => Promise<void>;

  // Quick create note
  createNewNote: () => Promise<void>;
}

let store: Store | null = null;
async function getStore() {
  if (!store) store = await load("settings.json");
  return store;
}

let watchedVaultPath: string | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  vaultPath: null,
  setVaultPath: async (path) => {
    set({ vaultPath: path });
    const s = await getStore();
    await s.set("vaultPath", path);
    await s.save();
    if (path) {
      try {
        const newNodes = await invoke<FileNode[]>("parse_vault", { path });
        set({ nodes: newNodes });
        watchedVaultPath = path;
        invoke("start_vault_watch", { path }).catch(console.error);
      } catch (e) {
        console.error("Failed to parse vault", e);
      }
    } else {
      set({ nodes: [] });
      watchedVaultPath = null;
    }
  },
  zenMode: false,
  setZenMode: (isZen) => set({ zenMode: isZen }),
  isHydrated: false,
  hydrate: async () => {
    const s = await getStore();
    const path = await s.get<string>("vaultPath");
    const accentColor = await s.get<AppState["accentColor"]>("accentColor");
    const colorScheme = await s.get<AppState["colorScheme"]>("colorScheme");
    const pinnedNotes = await s.get<string[]>("pinnedNotes");
    const editorSettings = await s.get<EditorSettings>("editorSettings");
    const customHotkeys = await s.get<Record<string, string>>("customHotkeys");
    const backupPath = await s.get<string>("backupPath");

    set({
      vaultPath: path || null,
      isHydrated: true,
      accentColor: accentColor || "blue",
      colorScheme: colorScheme || "system",
      pinnedNotes: pinnedNotes || [],
      editorSettings: editorSettings || DEFAULT_EDITOR_SETTINGS,
      customHotkeys: customHotkeys || {},
      backupPath: backupPath || null,
    });

    if (path) {
      try {
        const newNodes = await invoke<FileNode[]>("parse_vault", { path });
        set({ nodes: newNodes });
        if (path !== watchedVaultPath) {
          watchedVaultPath = path;
          invoke("start_vault_watch", { path }).catch(console.error);
        }
      } catch (e) {
        console.error("Failed to parse vault", e);
      }
    }
  },
  nodes: [],
  setNodes: (nodes) => set({ nodes }),
  currentNote: null,
  setCurrentNote: (note) => set({ currentNote: note, mainView: note ? "editor" : "afk" }),
  selectedFolderId: null,
  setSelectedFolderId: (id) => set({ selectedFolderId: id, activeFilter: null, mainView: "folders", currentNote: null }),
  activeFilter: null,
  setActiveFilter: (filter) => set({ activeFilter: filter, selectedFolderId: null, mainView: "folders", currentNote: null }),
  accentColor: "blue",
  setAccentColor: async (color) => {
    set({ accentColor: color });
    const s = await getStore();
    await s.set("accentColor", color);
    await s.save();
  },
  colorScheme: "system",
  setColorScheme: async (scheme) => {
    set({ colorScheme: scheme });
    const s = await getStore();
    await s.set("colorScheme", scheme);
    await s.save();
  },
  mainView: "afk",
  setMainView: (view) => set({ mainView: view }),
  isSettingsOpen: false,
  setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  isShortcutsOpen: false,
  setIsShortcutsOpen: (isOpen) => set({ isShortcutsOpen: isOpen }),
  viewingAsset: null,
  setViewingAsset: (asset) => set({ viewingAsset: asset }),

  // Pinned notes
  pinnedNotes: [],
  togglePin: async (path) => {
    const current = get().pinnedNotes;
    const updated = current.includes(path)
      ? current.filter((p) => p !== path)
      : [...current, path];
    set({ pinnedNotes: updated });
    const s = await getStore();
    await s.set("pinnedNotes", updated);
    await s.save();
  },

  // Editor settings
  editorSettings: DEFAULT_EDITOR_SETTINGS,
  setEditorSettings: async (settings) => {
    const current = get().editorSettings;
    const updated = { ...current, ...settings };
    set({ editorSettings: updated });
    const s = await getStore();
    await s.set("editorSettings", updated);
    await s.save();
  },

  // Custom hotkeys
  customHotkeys: {},
  setCustomHotkey: async (action, combo) => {
    const current = get().customHotkeys;
    const updated = { ...current, [action]: combo };
    set({ customHotkeys: updated });
    const s = await getStore();
    await s.set("customHotkeys", updated);
    await s.save();
  },

  // Backup
  backupPath: null,
  setBackupPath: async (path) => {
    set({ backupPath: path });
    const s = await getStore();
    await s.set("backupPath", path);
    await s.save();
  },

  // Quick create note
  createNewNote: async () => {
    const { vaultPath, selectedFolderId } = get();
    if (!vaultPath) return;
    const targetDir = selectedFolderId ?? vaultPath;
    const newNoteName = `Untitled_${Date.now()}.md`;
    const sep = targetDir.includes("\\") ? "\\" : "/";
    const fullPath = `${targetDir}${sep}${newNoteName}`;
    try {
      await invoke("write_note_content", { path: fullPath, content: "# " });
      await get().hydrate();
      get().setCurrentNote({
        type: "File",
        id: fullPath,
        name: newNoteName,
        path: fullPath,
        modified_at: Math.floor(Date.now() / 1000),
      });
    } catch (e) {
      console.error(e);
    }
  },
}));

export function useStoreHydration() {
  const hydrate = useAppStore((state) => state.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
}

// ─── Pure helpers shared by Gallery and Sidebar ──────────────────────────────

export function getCurrentLevelItems(
  nodes: FileNode[],
  selectedFolderId: string | null,
  activeFilter: "all" | null
): FileNode[] {
  let items: FileNode[];
  if (!selectedFolderId || activeFilter === "all") {
    items = nodes;
  } else {
    const find = (list: FileNode[]): FileNode | null => {
      for (const n of list) {
        if (n.id === selectedFolderId && n.type === "Folder") return n;
        if (n.type === "Folder") {
          const f = find(n.children);
          if (f) return f;
        }
      }
      return null;
    };
    const folder = find(nodes);
    items = folder?.type === "Folder" ? folder.children : nodes;
  }
  // Folders first (alpha), then files (newest first)
  return [...items].sort((a, b) => {
    if (a.type === "Folder" && b.type === "Folder") return a.name.localeCompare(b.name);
    if (a.type === "Folder") return -1;
    if (b.type === "Folder") return 1;
    const ma = a.type === "File" ? a.modified_at : 0;
    const mb = b.type === "File" ? b.modified_at : 0;
    return mb - ma;
  });
}

export function buildBreadcrumbs(
  nodes: FileNode[],
  targetId: string
): Array<{ id: string; name: string }> | null {
  const acc: Array<{ id: string; name: string }> = [];
  const search = (list: FileNode[]): boolean => {
    for (const n of list) {
      acc.push({ id: n.id, name: n.name });
      if (n.id === targetId) return true;
      if (n.type === "Folder" && search(n.children)) return true;
      acc.pop();
    }
    return false;
  };
  return search(nodes) ? acc : null;
}
