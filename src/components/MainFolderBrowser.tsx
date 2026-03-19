import { Fragment, useRef, useState, useCallback } from "react";
import { useAppStore, FileNode, NoteFile, getCurrentLevelItems, buildBreadcrumbs } from "../store";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  FileText, ChevronRight, PenBox, FolderPlus, Trash2, Folder,
  FolderOpen, Image, FileText as PdfIcon, Upload, Star, Download,
} from "lucide-react";

export function MainFolderBrowser() {
  const nodes = useAppStore((state) => state.nodes);
  const activeFilter = useAppStore((state) => state.activeFilter);
  const selectedFolderId = useAppStore((state) => state.selectedFolderId);
  const setSelectedFolderId = useAppStore((state) => state.setSelectedFolderId);
  const setActiveFilter = useAppStore((state) => state.setActiveFilter);
  const currentNote = useAppStore((state) => state.currentNote);
  const setCurrentNote = useAppStore((state) => state.setCurrentNote);
  const setMainView = useAppStore((state) => state.setMainView);
  const vaultPath = useAppStore((state) => state.vaultPath);
  const setViewingAsset = useAppStore((s) => s.setViewingAsset);
  const pinnedNotes = useAppStore((state) => state.pinnedNotes);
  const togglePin = useAppStore((state) => state.togglePin);

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const dragCounter = useRef(0);

  const items = getCurrentLevelItems(nodes, selectedFolderId, activeFilter);
  const breadcrumbs = selectedFolderId ? (buildBreadcrumbs(nodes, selectedFolderId) ?? []) : [];
  const parentCrumb = breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2] : null;

  const currentTitle = breadcrumbs.length > 0
    ? breadcrumbs[breadcrumbs.length - 1].name
    : "Gallery";

  const currentFolderPath = selectedFolderId ?? vaultPath;

  // ── note creation ───────────────────────────────────────────────────────────
  const handleCreateNote = async () => {
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

  const openFolderInput = () => {
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
      await useAppStore.getState().hydrate();
    } catch (err) { console.error(err); }
  };

  // ── export note ─────────────────────────────────────────────────────────────
  const handleExportNote = async (e: React.MouseEvent, node: FileNode) => {
    e.stopPropagation();
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const destPath = await openDialog({ directory: true, multiple: false, title: "Export Note To..." });
      if (!destPath || typeof destPath !== "string") return;
      await invoke("export_notes", { paths: [node.path], destPath });
    } catch (err) { console.error("Export failed:", err); }
  };

  // ── open in finder ──────────────────────────────────────────────────────────
  const handleOpenInFinder = async () => {
    if (!vaultPath) return;
    try { await openPath(vaultPath); } catch (err) { console.error(err); }
  };

  // ── back navigation ─────────────────────────────────────────────────────────
  const goBack = () => {
    if (parentCrumb) setSelectedFolderId(parentCrumb.id);
    else setActiveFilter("all");
  };

  // ── drag-and-drop files into folder ─────────────────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (!files.length || !currentFolderPath) return;

    const supported = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      return ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "pdf"].includes(ext);
    });
    if (!supported.length) return;

    setIsDropping(true);
    try {
      for (const file of supported) {
        const buffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        await invoke("save_file_to_folder", {
          folderPath: currentFolderPath,
          name: file.name,
          data: bytes,
        });
      }
      await useAppStore.getState().hydrate();
    } catch (err) {
      console.error("Failed to save dropped file:", err);
    } finally {
      setIsDropping(false);
    }
  }, [currentFolderPath]);

  const cardMotion = (i: number) => ({
    initial: { opacity: 0, scale: 0.93, y: 12 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.93 },
    transition: { delay: i * 0.04, type: "spring" as const, stiffness: 340, damping: 28 },
    whileHover: { scale: 1.02, transition: { type: "spring" as const, stiffness: 400, damping: 25 } },
  });

  return (
    <div
      className="h-full bg-white dark:bg-[#1a1b1e] flex flex-col pt-8 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── Drag overlay ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            key="drag-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
            style={{
              background: "rgba(59,130,246,0.08)",
              border: "2.5px dashed var(--app-accent)",
              borderRadius: "0",
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="p-5 rounded-2xl bg-[var(--app-accent)]/10">
                <Upload className="w-10 h-10 text-[var(--app-accent)]" />
              </div>
              <p className="text-lg font-semibold text-[var(--app-accent)]">
                Drop images or PDFs here
              </p>
              <p className="text-sm text-gray-400">
                They'll be added to{" "}
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {currentTitle}
                </span>
              </p>
            </motion.div>
          </motion.div>
        )}
        {isDropping && (
          <motion.div
            key="drop-spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-black/40 backdrop-blur-sm pointer-events-none"
          >
            <div className="w-10 h-10 rounded-full border-2 border-[var(--app-accent)] border-t-transparent animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-8 pb-6 border-b border-gray-100 dark:border-[#2b2d31]">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2 flex-wrap">
          <button onClick={() => setMainView("afk")} className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
            Home
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <button
            onClick={() => setActiveFilter("all")}
            className={`transition-colors ${!selectedFolderId ? "text-gray-900 dark:text-gray-200" : "hover:text-gray-900 dark:hover:text-gray-200"}`}
          >
            Gallery
          </button>
          {breadcrumbs.map((crumb, i) => (
            <Fragment key={crumb.id}>
              <ChevronRight className="w-3.5 h-3.5" />
              {i === breadcrumbs.length - 1 ? (
                <span className="text-gray-900 dark:text-gray-200">{crumb.name}</span>
              ) : (
                <button
                  onClick={() => setSelectedFolderId(crumb.id)}
                  className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  {crumb.name}
                </button>
              )}
            </Fragment>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedFolderId && (
              <button
                onClick={goBack}
                className="p-1.5 rounded-lg transition-all text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              {currentTitle}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenInFinder}
              className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 rounded-lg shadow-sm transition-all font-medium text-sm"
              title="Open in Finder"
            >
              <FolderOpen className="w-4 h-4" />
              In Finder
            </button>
            <button
              onClick={openFolderInput}
              className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 rounded-lg shadow-sm transition-all font-medium text-sm"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </button>
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--app-accent)] text-white rounded-lg shadow-sm hover:shadow-md hover:bg-[var(--app-accent)]/90 transition-all font-medium text-sm"
            >
              <PenBox className="w-4 h-4" />
              New Note
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-8 no-scrollbar">
        {items.length === 0 && !isCreatingFolder ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600" />
            <p className="font-medium">Empty. Create a note or drop images/PDFs here.</p>
          </div>
        ) : (
          <div key={selectedFolderId ?? "root"} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {isCreatingFolder && (
                <motion.div
                  key="__folder-input__"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="col-span-full flex items-center gap-3 px-5 py-4 border-2 border-[var(--app-accent)] rounded-2xl bg-white dark:bg-[#2b2d31]"
                >
                  <FolderPlus className="w-5 h-5 text-[var(--app-accent)] flex-shrink-0" />
                  <input
                    ref={folderInputRef}
                    className="flex-1 text-sm bg-transparent outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400"
                    placeholder="Folder name…"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") await commitFolderCreation();
                      if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName(""); }
                    }}
                    onBlur={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
                  />
                  <span className="text-xs text-gray-400 flex-shrink-0">↵ create</span>
                </motion.div>
              )}

              {items.map((node, i) => {
                if (node.type === "Folder") {
                  return (
                    <motion.div key={node.id} {...cardMotion(i)}>
                      <div
                        onClick={() => setSelectedFolderId(node.id)}
                        className="flex flex-col h-40 p-5 rounded-2xl cursor-pointer transition-colors group border-2 bg-gray-50 dark:bg-[#2b2d31] border-transparent hover:border-[var(--app-accent)]/50 dark:border-[#404249]/50"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-2.5 rounded-xl transition-colors bg-gray-200/70 dark:bg-black/25 group-hover:bg-[var(--app-accent)]/10">
                            <Folder className="w-5 h-5 transition-colors text-gray-500 dark:text-gray-400 group-hover:text-[var(--app-accent)]" />
                          </div>
                          <button
                            onClick={(e) => handleDelete(e, node)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base line-clamp-1">
                          {node.name}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                          {node.children.length} {node.children.length === 1 ? "item" : "items"}
                        </p>
                      </div>
                    </motion.div>
                  );
                }

                const fileType = node.file_type ?? "note";

                // ── Image card ────────────────────────────────────────────
                if (fileType === "image") {
                  return (
                    <motion.div key={node.id} {...cardMotion(i)}>
                      <div
                        onClick={() => setViewingAsset({ path: node.path, type: "image", name: node.name })}
                        className="flex flex-col h-48 rounded-2xl cursor-pointer overflow-hidden group border border-gray-200 dark:border-[#404249] hover:border-[var(--app-accent)] hover:shadow-xl dark:hover:border-[var(--app-accent)]/50 transition-all"
                      >
                        {/* Thumbnail */}
                        <div className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-[#2b2d31]">
                          <img
                            src={convertFileSrc(node.path)}
                            alt={node.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                              <Image className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        </div>
                        {/* Footer */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-[#2b2d31] flex-shrink-0">
                          <div>
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-1">
                              {node.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {format(new Date(node.modified_at * 1000), "MMM d")}
                            </p>
                          </div>
                          <button
                            onClick={(e) => handleDelete(e, node)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all text-red-500 flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                // ── PDF card ──────────────────────────────────────────────
                if (fileType === "pdf") {
                  return (
                    <motion.div key={node.id} {...cardMotion(i)}>
                      <div
                        onClick={() => setViewingAsset({ path: node.path, type: "pdf", name: node.name })}
                        className="flex flex-col h-48 p-5 rounded-2xl cursor-pointer group border border-gray-200 dark:border-[#404249] hover:border-red-400 hover:shadow-xl dark:hover:border-red-500/50 transition-all bg-white dark:bg-[#2b2d31]"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 group-hover:bg-red-100 dark:group-hover:bg-red-500/20 transition-colors">
                            <PdfIcon className="w-6 h-6 text-red-500" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold uppercase tracking-widest text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-md">
                              PDF
                            </span>
                            <button
                              onClick={(e) => handleDelete(e, node)}
                              className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col justify-end">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 leading-snug">
                            {node.name.replace(/\.pdf$/i, "")}
                          </h3>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {format(new Date(node.modified_at * 1000), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                // ── Note card ─────────────────────────────────────────────
                const titleLine = node.snippet?.split("\n")[0].replace(/^#+\s*/, "").trim();
                const cardTitle = titleLine || "Untitled";
                const cardBody = node.snippet?.split("\n").slice(1).join(" ").trim();
                const isPinned = pinnedNotes.includes(node.path);

                return (
                  <motion.div key={node.id} {...cardMotion(i)}>
                    <div
                      onClick={() => setCurrentNote(node as NoteFile)}
                      className="flex flex-col h-48 p-5 bg-white dark:bg-[#2b2d31] border border-gray-200 dark:border-[#404249] rounded-2xl cursor-pointer hover:border-[var(--app-accent)] hover:shadow-xl dark:hover:border-[var(--app-accent)]/50 transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-gray-100 dark:bg-black/20 rounded-lg group-hover:bg-[var(--app-accent)]/10 transition-colors">
                            <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-[var(--app-accent)] transition-colors" />
                          </div>
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            {format(new Date(node.modified_at * 1000), "MMM d")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePin(node.path); }}
                            className={`p-1.5 rounded-lg transition-all ${isPinned ? "text-[var(--app-accent)]" : "opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"}`}
                            title={isPinned ? "Unpin" : "Pin"}
                          >
                            <Star className={`w-4 h-4 ${isPinned ? "fill-[var(--app-accent)]" : ""}`} />
                          </button>
                          <button
                            onClick={(e) => handleExportNote(e, node)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all text-gray-400"
                            title="Export .md"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, node)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base line-clamp-1 mb-2">
                        {cardTitle}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed flex-1">
                        {cardBody || <span className="italic opacity-50">Empty</span>}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
