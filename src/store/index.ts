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
    }
  | {
      type: "Folder";
      id: string;
      name: string;
      path: string;
      children: FileNode[];
    };

export type NoteFile = Extract<FileNode, { type: "File" }>;

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
  accentColor: "blue" | "red" | "green" | "purple";
  setAccentColor: (color: "blue" | "red" | "green" | "purple") => void;

  mainView: "afk" | "folders" | "editor" | "trash";
  setMainView: (view: "afk" | "folders" | "editor" | "trash") => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
}

let store: Store | null = null;
async function getStore() {
  if (!store) store = await load("settings.json");
  return store;
}

export const useAppStore = create<AppState>((set) => ({
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
        invoke("start_vault_watch", { path }).catch(console.error);
      } catch (e) {
        console.error("Failed to parse vault", e);
      }
    } else {
      set({ nodes: [] });
    }
  },
  zenMode: false,
  setZenMode: (isZen) => set({ zenMode: isZen }),
  isHydrated: false,
  hydrate: async () => {
    const s = await getStore();
    let path = await s.get<string>("vaultPath");
    set({ vaultPath: path || null, isHydrated: true });
    if (path) {
      try {
        const newNodes = await invoke<FileNode[]>("parse_vault", { path });
        set({ nodes: newNodes });
        invoke("start_vault_watch", { path }).catch(console.error);
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
  setAccentColor: (color) => set({ accentColor: color }),
  mainView: "afk",
  setMainView: (view) => set({ mainView: view }),
  isSettingsOpen: false,
  setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen })
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
  const search = (
    list: FileNode[],
    acc: Array<{ id: string; name: string }>
  ): Array<{ id: string; name: string }> | null => {
    for (const n of list) {
      const cur = [...acc, { id: n.id, name: n.name }];
      if (n.id === targetId) return cur;
      if (n.type === "Folder") {
        const result = search(n.children, cur);
        if (result) return result;
      }
    }
    return null;
  };
  return search(nodes, []);
}
