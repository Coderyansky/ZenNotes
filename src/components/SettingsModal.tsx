import { useState } from "react";
import { useAppStore } from "../store";
import { X, FolderHeart, HardDrive, RotateCcw, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { open, ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

const ACCENT_MAP: Record<string, string> = {
  blue: "#3b82f6",
  red: "#ef4444",
  green: "#10b981",
  purple: "#8b5cf6",
  orange: "#f97316",
  yellow: "#eab308",
  teal: "#14b8a6",
  pink: "#ec4899",
  indigo: "#6366f1",
};

export function SettingsModal() {
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const setIsSettingsOpen = useAppStore((state) => state.setIsSettingsOpen);
  const accentColor = useAppStore((state) => state.accentColor);
  const setAccentColor = useAppStore((state) => state.setAccentColor);
  const colorScheme = useAppStore((state) => state.colorScheme);
  const setColorScheme = useAppStore((state) => state.setColorScheme);
  const vaultPath = useAppStore((state) => state.vaultPath);
  const setVaultPath = useAppStore((state) => state.setVaultPath);
  const editorSettings = useAppStore((state) => state.editorSettings);
  const setEditorSettings = useAppStore((state) => state.setEditorSettings);
  const backupPath = useAppStore((state) => state.backupPath);
  const setBackupPath = useAppStore((state) => state.setBackupPath);
  const hydrate = useAppStore((state) => state.hydrate);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

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

  const handleChooseBackupDir = async () => {
    try {
      const selectedPath = await open({ directory: true, multiple: false, title: "Select Backup Directory" });
      if (selectedPath && typeof selectedPath === "string") {
        await setBackupPath(selectedPath);
      }
    } catch (error) {
      console.error("Failed to choose backup dir:", error);
    }
  };

  const handleBackupNow = async () => {
    if (!vaultPath || !backupPath) return;
    setIsBackingUp(true);
    setBackupMsg(null);
    try {
      const result = await invoke<string>("backup_vault", { vaultPath, destPath: backupPath });
      setBackupMsg(`Backup saved: ${result.split("/").pop()}`);
    } catch (e) {
      setBackupMsg(`Backup failed: ${e}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!vaultPath) return;
    try {
      const selectedPath = await open({ directory: true, multiple: false, title: "Select Backup to Restore" });
      if (!selectedPath || typeof selectedPath !== "string") return;
      const confirmed = await ask(
        "This will overwrite your current vault with the backup. Continue?",
        { title: "Restore Vault", kind: "warning" }
      );
      if (!confirmed) return;
      setIsRestoring(true);
      setBackupMsg(null);
      await invoke("restore_vault", { backupPath: selectedPath, vaultPath });
      await hydrate();
      setBackupMsg("Vault restored successfully.");
    } catch (e) {
      setBackupMsg(`Restore failed: ${e}`);
    } finally {
      setIsRestoring(false);
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
              className="w-full max-w-sm bg-white/90 dark:bg-[#2b2d31]/90 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-white/10 flex-shrink-0">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-6 overflow-y-auto">

                {/* ── Appearance ── */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Appearance</h3>

                  {/* Accent Color */}
                  <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Accent Color</span>
                    <div className="flex flex-wrap gap-1.5 justify-end max-w-[200px]">
                      {(Object.keys(ACCENT_MAP) as Array<keyof typeof ACCENT_MAP>).map((color) => (
                        <button
                          key={color}
                          onClick={() => setAccentColor(color as any)}
                          className={`w-5 h-5 rounded-full transition-all hover:scale-110 ${
                            accentColor === color ? "ring-2 ring-offset-2 dark:ring-offset-[#2b2d31] scale-110" : ""
                          }`}
                          style={{
                            backgroundColor: ACCENT_MAP[color],
                            "--tw-ring-color": ACCENT_MAP[color],
                          } as React.CSSProperties}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Color Scheme */}
                  <div className="flex flex-col gap-2 p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Color Scheme</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(["system", "light", "dark", "sepia", "midnight"] as const).map((scheme) => (
                        <button
                          key={scheme}
                          onClick={() => setColorScheme(scheme)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
                            colorScheme === scheme
                              ? "bg-[var(--app-accent)] text-white"
                              : "bg-white dark:bg-[#1a1b1e] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:border-[var(--app-accent)]/50"
                          }`}
                        >
                          {scheme}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Editor ── */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Editor</h3>

                  <div className="flex flex-col gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                    {/* Font Family */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Font</span>
                      <div className="flex gap-1">
                        {(["sans", "serif", "mono"] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setEditorSettings({ fontFamily: f })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
                              editorSettings.fontFamily === f
                                ? "bg-[var(--app-accent)] text-white"
                                : "bg-white dark:bg-[#1a1b1e] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10"
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font Size */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-shrink-0">Font Size</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={12}
                          max={24}
                          value={editorSettings.fontSize}
                          onChange={(e) => setEditorSettings({ fontSize: Number(e.target.value) })}
                          className="w-24 accent-[var(--app-accent)]"
                        />
                        <span className="text-xs text-gray-500 w-8">{editorSettings.fontSize}px</span>
                      </div>
                    </div>

                    {/* Line Height */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-shrink-0">Line Height</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={120}
                          max={220}
                          step={10}
                          value={Math.round(editorSettings.lineHeight * 100)}
                          onChange={(e) => setEditorSettings({ lineHeight: Number(e.target.value) / 100 })}
                          className="w-24 accent-[var(--app-accent)]"
                        />
                        <span className="text-xs text-gray-500 w-8">{editorSettings.lineHeight.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Storage ── */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Storage</h3>

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
                      className="w-full py-2 px-4 bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-sm font-medium rounded-lg transition-colors text-gray-700 dark:text-gray-300"
                    >
                      Change Folder...
                    </button>
                  </div>
                </div>

                {/* ── Backup ── */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Backup</h3>

                  <div className="flex flex-col gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-xl">
                    <div className="flex items-start gap-3">
                      <HardDrive className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Backup Directory</span>
                        <span className="block text-xs text-gray-500 mt-1 break-all">
                          {backupPath || "Not configured"}
                        </span>
                      </div>
                      <button
                        onClick={handleChooseBackupDir}
                        className="flex-shrink-0 text-xs px-2 py-1 bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-white/10 rounded-lg text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
                      >
                        Choose...
                      </button>
                    </div>

                    {backupMsg && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">{backupMsg}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleBackupNow}
                        disabled={!vaultPath || !backupPath || isBackingUp}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[var(--app-accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isBackingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                        Backup Now
                      </button>
                      <button
                        onClick={handleRestore}
                        disabled={!vaultPath || isRestoring}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-white/10 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        Restore...
                      </button>
                    </div>
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
