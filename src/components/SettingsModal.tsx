import { useAppStore } from "../store";
import { X, FolderHeart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";

export function SettingsModal() {
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const setIsSettingsOpen = useAppStore((state) => state.setIsSettingsOpen);
  const accentColor = useAppStore((state) => state.accentColor);
  const vaultPath = useAppStore((state) => state.vaultPath);
  const setAccentColor = useAppStore((state) => state.setAccentColor);
  const setVaultPath = useAppStore((state) => state.setVaultPath);

  const handleChangeVault = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select your new Vault directory",
      });

      if (selectedPath && typeof selectedPath === "string") {
        await setVaultPath(selectedPath);
        setIsSettingsOpen(false);
      }
    } catch (error) {
      console.error("Failed to change vault:", error);
    }
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSettingsOpen(false)}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 app-region-no-drag"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white/90 dark:bg-[#2b2d31]/90 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-white/10">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Appearance</h3>
                  
                  <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Accent Color</span>
                    <div className="flex gap-2">
                      {(['blue', 'red', 'green', 'purple'] as const).map(color => (
                        <button 
                          key={color}
                          onClick={() => setAccentColor(color)} 
                          className={`w-6 h-6 rounded-full transition-all hover:scale-110 ${
                            accentColor === color ? 'ring-2 ring-offset-2 dark:ring-offset-[#2b2d31] scale-110' : ''
                          }`}
                          style={{
                            backgroundColor: color === 'blue' ? '#3b82f6' : 
                                             color === 'red' ? '#ef4444' : 
                                             color === 'green' ? '#10b981' : 
                                             '#8b5cf6',
                            "--tw-ring-color": color === 'blue' ? '#3b82f6' : 
                                       color === 'red' ? '#ef4444' : 
                                       color === 'green' ? '#10b981' : 
                                       '#8b5cf6'
                          } as React.CSSProperties}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Storage</h3>
                  
                  <div className="flex flex-col gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-xl">
                    <div className="flex items-start gap-3">
                      <FolderHeart className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vault Location</span>
                        <span className="block text-xs text-gray-500 mt-1 break-all">
                          {vaultPath || "Not configured"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleChangeVault}
                      className="w-full mt-2 py-2 px-4 bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-sm font-medium rounded-lg transition-colors text-gray-700 dark:text-gray-300"
                    >
                      Change Folder...
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
