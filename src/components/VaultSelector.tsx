import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../store";
import { motion } from "framer-motion";
import { FolderHeart } from "lucide-react";

export function VaultSelector() {
  const setVaultPath = useAppStore((state) => state.setVaultPath);
  const hydrate = useAppStore((state) => state.hydrate);

  const handleSelectVault = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select your Vault directory",
      });

      if (selectedPath && typeof selectedPath === "string") {
        await setVaultPath(selectedPath);
        await hydrate();
      }
    } catch (error) {
      console.error("Failed to select vault:", error);
    }
  };

  return (
    <div className="w-full h-screen bg-[#f4f5f5] dark:bg-[#1a1b1e] flex items-center justify-center p-8 app-region-drag">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-[#2b2d31] border border-gray-200 dark:border-white/10 p-8 rounded-3xl shadow-xl flex flex-col items-center text-center app-region-no-drag"
      >
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
          <FolderHeart className="w-8 h-8 text-blue-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Welcome to ZenNotes</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          To get started, please select a folder on your computer where your notes and images will be safely stored.
        </p>

        <button 
          onClick={handleSelectVault}
          className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors shadow-sm"
        >
          Select Vault Directory
        </button>
      </motion.div>
    </div>
  );
}
