import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/Sidebar";
import { HomeScreen } from "./components/HomeScreen";
import { MainFolderBrowser } from "./components/MainFolderBrowser";
import { BlockNoteEditor } from "./components/Editor/BlockNoteEditor";
import { TrashView } from "./components/TrashView";
import { SettingsModal } from "./components/SettingsModal";
import { KeyboardShortcutsModal } from "./components/KeyboardShortcutsModal";
import { VaultSelector } from "./components/VaultSelector";
import { AssetViewer } from "./components/AssetViewer";
import { useAppStore, useStoreHydration } from "./store";
import { HOTKEY_ACTIONS } from "./lib/hotkeys";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

const ACCENT_COLORS: Record<string, string> = {
  red: "#ef4444",
  green: "#10b981",
  purple: "#8b5cf6",
  blue: "#3b82f6",
  orange: "#f97316",
  yellow: "#eab308",
  teal: "#14b8a6",
  pink: "#ec4899",
  indigo: "#6366f1",
};

function App() {
  useStoreHydration();
  const isHydrated = useAppStore((state) => state.isHydrated);
  const vaultPath = useAppStore((state) => state.vaultPath);
  const accentColor = useAppStore((state) => state.accentColor);
  const colorScheme = useAppStore((state) => state.colorScheme);
  const mainView = useAppStore((state) => state.mainView);
  const hydrate = useAppStore((state) => state.hydrate);
  const setIsSettingsOpen = useAppStore((state) => state.setIsSettingsOpen);
  const setIsShortcutsOpen = useAppStore((state) => state.setIsShortcutsOpen);
  const setMainView = useAppStore((state) => state.setMainView);
  const setActiveFilter = useAppStore((state) => state.setActiveFilter);
  const setZenMode = useAppStore((state) => state.setZenMode);
  const zenMode = useAppStore((state) => state.zenMode);
  const customHotkeys = useAppStore((state) => state.customHotkeys);
  const createNewNote = useAppStore((state) => state.createNewNote);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply color scheme to document root
  useEffect(() => {
    const root = document.documentElement;
    if (colorScheme === "system") {
      root.removeAttribute("data-scheme");
    } else {
      root.setAttribute("data-scheme", colorScheme);
    }
  }, [colorScheme]);

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

  // Quick capture global event
  useEffect(() => {
    const unlisten = listen("quick-capture", () => {
      createNewNote();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [createNewNote]);

  // Global keyboard shortcuts
  useEffect(() => {
    const getBinding = (actionId: string): string => {
      if (customHotkeys[actionId]) return customHotkeys[actionId];
      return HOTKEY_ACTIONS.find((a) => a.id === actionId)?.default ?? "";
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+, → Settings
      if (isMod && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      // Cmd/Ctrl+/ → Shortcuts
      if (isMod && e.key === "/") {
        e.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }

      if (isMod) return; // Don't handle other mod combos as single-key shortcuts

      const key = e.key.toLowerCase();

      if (key === getBinding("new_note")) {
        e.preventDefault();
        createNewNote();
      } else if (key === getBinding("toggle_zen")) {
        e.preventDefault();
        setZenMode(!zenMode);
      } else if (key === getBinding("go_home")) {
        e.preventDefault();
        setMainView("afk");
      } else if (key === getBinding("open_settings")) {
        e.preventDefault();
        setIsSettingsOpen(true);
      } else if (key === getBinding("open_shortcuts")) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if (key === getBinding("open_gallery")) {
        e.preventDefault();
        setActiveFilter("all");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [customHotkeys, zenMode, createNewNote, setIsSettingsOpen, setIsShortcutsOpen, setMainView, setActiveFilter, setZenMode]);

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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
      <KeyboardShortcutsModal />
      <AssetViewer />
    </div>
  );
}

export default App;
