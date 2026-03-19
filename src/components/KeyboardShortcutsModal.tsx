import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store";
import { X, Keyboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { HOTKEY_ACTIONS } from "../lib/hotkeys";

const CATEGORIES = ["Navigation", "Editor", "App"];

export function KeyboardShortcutsModal() {
  const isShortcutsOpen = useAppStore((state) => state.isShortcutsOpen);
  const setIsShortcutsOpen = useAppStore((state) => state.setIsShortcutsOpen);
  const customHotkeys = useAppStore((state) => state.customHotkeys);
  const setCustomHotkey = useAppStore((state) => state.setCustomHotkey);

  const [recording, setRecording] = useState<string | null>(null);
  const recordingRef = useRef(recording);
  recordingRef.current = recording;

  useEffect(() => {
    if (!isShortcutsOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (recordingRef.current) {
          setRecording(null);
        } else {
          setIsShortcutsOpen(false);
        }
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isShortcutsOpen, setIsShortcutsOpen]);

  const startRecording = (actionId: string) => {
    setRecording(actionId);
    const captureNext = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(null);
        window.removeEventListener("keydown", captureNext, true);
        return;
      }
      const key = e.key.toLowerCase();
      setCustomHotkey(actionId, key);
      setRecording(null);
      window.removeEventListener("keydown", captureNext, true);
    };
    window.addEventListener("keydown", captureNext, true);
  };

  const getBinding = (actionId: string): string => {
    return customHotkeys[actionId] || HOTKEY_ACTIONS.find((a) => a.id === actionId)?.default || "";
  };

  return (
    <AnimatePresence>
      {isShortcutsOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { if (!recording) setIsShortcutsOpen(false); }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white/90 dark:bg-[#2b2d31]/90 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-gray-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
                </div>
                <button
                  onClick={() => setIsShortcutsOpen(false)}
                  className="p-1 rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Built-in shortcuts */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">System</h3>
                  <div className="space-y-1">
                    {[
                      { label: "Settings", keys: ["⌘", ","] },
                      { label: "Shortcuts Reference", keys: ["⌘", "/"] },
                      { label: "Quick Capture (global)", keys: ["⌘⇧", "N"] },
                    ].map(({ label, keys }) => (
                      <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/3 dark:bg-white/3">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                        <div className="flex items-center gap-1">
                          {keys.map((k) => (
                            <kbd key={k} className="px-2 py-0.5 text-xs font-mono bg-gray-100 dark:bg-[#1a1b1e] border border-gray-200 dark:border-white/10 rounded text-gray-700 dark:text-gray-300">
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {CATEGORIES.map((category) => {
                  const actions = HOTKEY_ACTIONS.filter((a) => a.category === category);
                  return (
                    <div key={category} className="space-y-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{category}</h3>
                      <div className="space-y-1">
                        {actions.map((action) => {
                          const isRec = recording === action.id;
                          const binding = getBinding(action.id);
                          const isCustom = !!customHotkeys[action.id];
                          return (
                            <div key={action.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/3 dark:bg-white/3">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{action.label}</span>
                              <button
                                onClick={() => startRecording(action.id)}
                                title="Click to rebind"
                                className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                                  isRec
                                    ? "border-[var(--app-accent)] bg-[var(--app-accent)]/10 text-[var(--app-accent)]"
                                    : "border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-[#1a1b1e] hover:border-[var(--app-accent)]/50"
                                }`}
                              >
                                {isRec ? (
                                  <span className="text-xs font-mono animate-pulse">press key…</span>
                                ) : (
                                  <>
                                    <kbd className="text-xs font-mono text-gray-700 dark:text-gray-300">
                                      {binding || "—"}
                                    </kbd>
                                    {isCustom && (
                                      <span className="text-[10px] text-[var(--app-accent)]">custom</span>
                                    )}
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <p className="text-xs text-gray-400 text-center pt-2">
                  Click a key binding to rebind it. Press Escape to cancel.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
