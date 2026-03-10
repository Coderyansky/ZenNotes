import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/Sidebar";
import { HomeScreen } from "./components/HomeScreen";
import { MainFolderBrowser } from "./components/MainFolderBrowser";
import { BlockNoteEditor } from "./components/Editor/BlockNoteEditor";
import { TrashView } from "./components/TrashView";
import { SettingsModal } from "./components/SettingsModal";
import { VaultSelector } from "./components/VaultSelector";
import { AssetViewer } from "./components/AssetViewer";
import { useAppStore, useStoreHydration } from "./store";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

const ACCENT_COLORS: Record<string, string> = {
  red: "#ef4444",
  green: "#10b981",
  purple: "#8b5cf6",
  blue: "#3b82f6",
};

function App() {
  useStoreHydration();
  const isHydrated = useAppStore((state) => state.isHydrated);
  const vaultPath = useAppStore((state) => state.vaultPath);
  const accentColor = useAppStore((state) => state.accentColor);
  const mainView = useAppStore((state) => state.mainView);
  const hydrate = useAppStore((state) => state.hydrate);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unlisten = listen("vault-changed", () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => hydrate(), 300);
    });
    return () => {
      unlisten.then((fn) => fn());
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <div className="w-full h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--app-accent,blue)] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!vaultPath) {
    return <VaultSelector />;
  }

  return (
    <div
      className="w-full h-screen bg-transparent text-gray-900 dark:text-gray-100 flex font-sans overflow-hidden"
      style={{ "--app-accent": ACCENT_COLORS[accentColor] ?? "#3b82f6" } as React.CSSProperties}
    >
      <div className="flex h-screen w-full relative">
        {/* Invisible draggable region for macOS framing */}
        <div data-tauri-drag-region className="absolute top-0 left-0 right-0 h-8 z-50 pointer-events-none" />

        {/* Left Nav */}
        <Sidebar />

        {/* Main Area */}
        <main className="flex-1 bg-white dark:bg-[#1a1b1e] h-full relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={mainView}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full"
            >
              {mainView === "afk" && <HomeScreen />}
              {mainView === "folders" && <MainFolderBrowser />}
              {mainView === "editor" && <BlockNoteEditor />}
              {mainView === "trash" && <TrashView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <SettingsModal />
      <AssetViewer />
    </div>
  );
}

export default App;
