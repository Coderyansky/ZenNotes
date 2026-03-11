import { useEffect, useState } from "react";
import { useAppStore, FileNode } from "../store";
import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { Trash2, RotateCcw, XCircle, ChevronRight, Folder, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

export function TrashView() {
  const [trashItems, setTrashItems] = useState<FileNode[]>([]);
  const vaultPath = useAppStore((state) => state.vaultPath);
  const setMainView = useAppStore((state) => state.setMainView);

  const loadTrash = async () => {
    if (!vaultPath) return;
    try {
      const items = await invoke<FileNode[]>("get_trash_items", { vaultPath });
      setTrashItems(items);
    } catch (e) {
      console.error("Failed to load trash:", e);
    }
  };

  useEffect(() => {
    loadTrash();
  }, [vaultPath]);

  const handleRestore = async (item: FileNode) => {
    if (!vaultPath) return;
    try {
      await invoke("restore_trash_element", { 
        vaultPath, 
        trashPath: item.path 
      });
      await loadTrash();
      await useAppStore.getState().hydrate();
    } catch (e) {
      console.error("Failed to restore item:", e);
      alert("Failed to restore item");
    }
  };

  const handleEmptyTrash = async () => {
    if (!vaultPath) return;
    const confirmed = await ask("Are you sure you want to permanently delete all items in the trash?", { title: "Empty Trash", kind: "warning" });
    if (confirmed) {
      try {
        await invoke("empty_trash", { vaultPath });
        await loadTrash();
      } catch (e) {
        console.error("Failed to empty trash:", e);
      }
    }
  };

  return (
    <div className="h-full bg-white dark:bg-[#1a1b1e] flex flex-col pt-8">
      {/* Header */}
      <div className="px-8 pb-6 border-b border-gray-100 dark:border-[#2b2d31]">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <button onClick={() => setMainView("afk")} className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors">Home</button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 dark:text-gray-200">Trash</span>
        </div>
        
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Trash
          </h2>
          {trashItems.length > 0 && (
            <button 
              onClick={handleEmptyTrash}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-all font-medium text-sm"
            >
              <XCircle className="w-4 h-4" />
              Empty Trash
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
        {trashItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
            <Trash2 className="w-12 h-12 text-gray-200 dark:text-gray-700 font-light" />
            <p className="font-medium">Trash is empty</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {trashItems.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col p-5 bg-gray-50 dark:bg-black/10 border border-gray-100 dark:border-white/5 rounded-2xl group relative"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white dark:bg-[#2b2d31] rounded-lg shadow-sm">
                      {item.type === "Folder" ? (
                        <Folder className="w-5 h-5 text-amber-500" />
                      ) : (
                        <FileText className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                        {item.name.replace(/_\d+$/, "")}
                      </h3>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
                        Deleted {item.type === "File" ? format(new Date(item.modified_at * 1000), "MMM d, HH:mm") : "Recently"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button 
                      onClick={() => handleRestore(item)}
                      className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-white dark:bg-[#2b2d31] border border-gray-100 dark:border-white/10 hover:border-blue-500/50 hover:text-blue-500 rounded-lg text-xs font-medium transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
