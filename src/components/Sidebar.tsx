import { useAppStore, FileNode, NoteFile, getCurrentLevelItems, buildBreadcrumbs } from "../store";
import { Folder, FileText, PenBox, Home, Settings, FolderPlus, Plus, Trash2, ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";

export function Sidebar() {
  const nodes = useAppStore((state) => state.nodes);
  const activeFilter = useAppStore((state) => state.activeFilter);
  const setActiveFilter = useAppStore((state) => state.setActiveFilter);
  const setIsSettingsOpen = useAppStore((state) => state.setIsSettingsOpen);
  const mainView = useAppStore((state) => state.mainView);
  const setMainView = useAppStore((state) => state.setMainView);
  const vaultPath = useAppStore((state) => state.vaultPath);
  const selectedFolderId = useAppStore((state) => state.selectedFolderId);
  const setSelectedFolderId = useAppStore((state) => state.setSelectedFolderId);
  const currentNote = useAppStore((state) => state.currentNote);
  const setCurrentNote = useAppStore((state) => state.setCurrentNote);

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);

  const levelItems = getCurrentLevelItems(nodes, selectedFolderId, activeFilter);
  const breadcrumbs = selectedFolderId ? (buildBreadcrumbs(nodes, selectedFolderId) ?? []) : [];
  const parentCrumb = breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2] : null;
  const sectionLabel = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : "Gallery";

  const goBack = () => {
    if (parentCrumb) setSelectedFolderId(parentCrumb.id);
    else setActiveFilter("all");
  };

  // ── note creation ───────────────────────────────────────────────────────────
  const handleCreateNote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!vaultPath) return;
    const targetDir = selectedFolderId ?? vaultPath;
    const newNoteName = `Untitled_${Date.now()}.md`;
    const sep = targetDir.includes("\\") ? "\\" : "/";
    const fullPath = `${targetDir}${sep}${newNoteName}`;
    try {
      await invoke("write_note_content", { path: fullPath, content: "# " });
      await useAppStore.getState().hydrate();
      setCurrentNote({ type: "File", id: fullPath, name: newNoteName, path: fullPath, modified_at: Math.floor(Date.now() / 1000) });
    } catch (e) { console.error(e); }
  };

  // ── folder creation ─────────────────────────────────────────────────────────
  const handleCreateFolder = async (name: string) => {
    if (!vaultPath || !name.trim()) return;
    const targetDir = selectedFolderId ?? vaultPath;
    const sep = targetDir.includes("\\") ? "\\" : "/";
    const fullPath = `${targetDir}${sep}${name.trim()}`;
    try {
      await invoke("create_folder", { path: fullPath });
      await useAppStore.getState().hydrate();
    } catch (e) { console.error(e); }
  };

  const openFolderInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCreatingFolder(true);
    setNewFolderName("");
    setTimeout(() => folderInputRef.current?.focus(), 50);
  };

  const commitFolderCreation = async () => {
    await handleCreateFolder(newFolderName);
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  // ── delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (e: React.MouseEvent, node: FileNode) => {
    e.stopPropagation();
    const confirmed = await ask(`Delete "${node.name}"?`, { title: "Delete", kind: "warning" });
    if (!confirmed) return;
    try {
      await invoke("delete_element", { vaultPath, path: node.path });
      if (node.type === "File" && currentNote?.id === node.id) setCurrentNote(null);
      if (node.type === "Folder" && selectedFolderId === node.id) setSelectedFolderId(null);
      await useAppStore.getState().hydrate();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="w-64 flex-shrink-0 h-full bg-[#f4f5f5] dark:bg-[#1a1b1e] border-r border-[#e3e4e5] dark:border-[#2b2d31] flex flex-col pt-8">
      {/* App Branding */}
      <div className="px-5 mb-6">
        <h1 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">ZenNotes</h1>
      </div>

      {/* Core Navigation */}
      <div className="px-2 mb-4 space-y-0.5">
        <div
          onClick={() => setMainView("afk")}
          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-lg transition-colors ${mainView === "afk" ? "bg-[var(--app-accent)] text-white" : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"}`}
        >
          <Home className={`w-4 h-4 ${mainView === "afk" ? "text-white" : "text-gray-400"}`} />
          <span className="text-sm font-medium">Home</span>
        </div>
        <div
          onClick={() => setActiveFilter("all")}
          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-lg transition-colors ${mainView === "folders" ? "bg-[var(--app-accent)] text-white" : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"}`}
        >
          <PenBox className={`w-4 h-4 ${mainView === "folders" ? "text-white" : "text-gray-400"}`} />
          <span className="text-sm font-medium">Gallery</span>
        </div>
        <div
          onClick={() => setMainView("trash")}
          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-lg transition-colors ${mainView === "trash" ? "bg-[var(--app-accent)] text-white" : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"}`}
        >
          <Trash2 className={`w-4 h-4 ${mainView === "trash" ? "text-white" : "text-gray-400"}`} />
          <span className="text-sm font-medium">Trash</span>
        </div>
      </div>

      {/* Current Level List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-2">
        {/* Section header */}
        <div className="flex items-center justify-between pl-1 pr-1 mb-2 group">
          <div className="flex items-center gap-1 min-w-0">
            {selectedFolderId && (
              <button
                onClick={goBack}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
            )}
            <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest truncate px-2">
              {sectionLabel}
            </h2>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={openFolderInput}
              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-black/5 dark:hover:text-gray-200 dark:hover:bg-white/5"
              title="New Folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCreateNote}
              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-black/5 dark:hover:text-gray-200 dark:hover:bg-white/5"
              title="New Note"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Inline folder creation input */}
        <AnimatePresence initial={false}>
          {isCreatingFolder && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden mb-1"
            >
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Folder className="w-4 h-4 flex-shrink-0 text-[var(--app-accent)]" />
                <input
                  ref={folderInputRef}
                  className="flex-1 text-sm bg-transparent border-b border-[var(--app-accent)] outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400 pb-0.5"
                  placeholder="Folder name…"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") await commitFolderCreation();
                    if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName(""); }
                  }}
                  onBlur={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Items */}
        <div className="space-y-0.5">
          {levelItems.length === 0 ? (
            <p className="text-xs text-gray-500 px-3 py-2 italic">Empty.</p>
          ) : (
            <AnimatePresence>
              {levelItems.map((node, i) => {
                const isFolder = node.type === "Folder";
                const isActive = isFolder
                  ? selectedFolderId === node.id
                  : currentNote?.id === node.id;
                const displayName = isFolder
                  ? node.name
                  : (node.type === "File" && node.snippet?.split("\n")[0].replace(/^#+\s*/, "").trim()) || "Untitled";

                return (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ delay: i * 0.03, duration: 0.18 }}
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-lg transition-colors group ${
                      isActive
                        ? "bg-black/5 dark:bg-white/5 text-[var(--app-accent)] font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    onClick={() => {
                      if (isFolder) setSelectedFolderId(node.id);
                      else if (node.type === "File") setCurrentNote(node as NoteFile);
                    }}
                  >
                    {isFolder ? (
                      <Folder className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[var(--app-accent)]" : "text-gray-400 group-hover:text-gray-500"}`} />
                    ) : (
                      <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[var(--app-accent)]" : "text-gray-400 group-hover:text-gray-500"}`} />
                    )}
                    <span className="text-sm line-clamp-1 flex-1">{displayName}</span>
                    <button
                      onClick={(e) => handleDelete(e, node)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-all text-red-500 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#e3e4e5] dark:border-[#2b2d31]">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
