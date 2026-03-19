import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAppStore } from "../../store";

import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote, FormattingToolbar } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { MantineProvider, createTheme, Menu } from "@mantine/core";

const mantineTheme = createTheme({
  components: {
    Menu: Menu.extend({
      defaultProps: {
        position: "top",
      },
    }),
  },
});

export function BlockNoteEditor() {
  const currentNote = useAppStore((state) => state.currentNote);
  const vaultPath = useAppStore((state) => state.vaultPath);
  const zenMode = useAppStore((state) => state.zenMode);
  const setZenMode = useAppStore((state) => state.setZenMode);
  const setMainView = useAppStore((state) => state.setMainView);
  const setCurrentNote = useAppStore((state) => state.setCurrentNote);

  // Helper handling image uploads directly to local `assets`
  const uploadImage = useCallback(async (file: File) => {
    if (!vaultPath) return "https://via.placeholder.com/800";
    try {
      const buffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      // Provide both vaultPath and the file info to Rust
      const relativePath: string = await invoke("save_asset_in_vault", {
        vaultPath: vaultPath,
        name: file.name,
        data: bytes,
      });
      // Return absolute internal Tauri URI for rendering in Editor natively
      const absolutePath = vaultPath.includes("\\") 
        ? `${vaultPath}\\${relativePath.replace("/", "\\")}`
        : `${vaultPath}/${relativePath}`;
      
      return convertFileSrc(absolutePath);
    } catch (e) {
      console.error("Failed to upload image:", e);
      return "https://via.placeholder.com/800";
    }
  }, [vaultPath]);

  // We memoize the editor instance creation to attach the custom file upload logic
  const editor = useCreateBlockNote({
    uploadFile: uploadImage,
  });

  // Track initialization if needed later

  useEffect(() => {
    // When note changes, we load new content
    if (!currentNote) return;
    let isMounted = true;
    invoke<string>("read_note_content", { path: currentNote.path })
      .then(async (content) => {
        if (isMounted) {
          if (!content.trim()) {
            editor.replaceBlocks(editor.document, [{ type: "paragraph", content: " " }]);
            return;
          }
          // Parse loaded markdown content into BlockNote blocks
          const blocks = await editor.tryParseMarkdownToBlocks(content);
          editor.replaceBlocks(editor.document, blocks);
        }
      })
      .catch((e) => console.error("Failed to load note:", e));

    return () => { isMounted = false; };
  }, [currentNote?.id, editor]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNoteRef = useRef(currentNote);
  currentNoteRef.current = currentNote;

  // Flush: cancel pending debounce and save immediately
  const flushSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (!currentNoteRef.current) return;
    try {
      const md = await editor.blocksToMarkdownLossy(editor.document);
      await invoke("write_note_content", { path: currentNoteRef.current.path, content: md });
    } catch (e) {
      console.error("Failed to save note:", e);
    }
  }, [editor]);

  const handleChange = useCallback(() => {
    if (!currentNoteRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const md = await editor.blocksToMarkdownLossy(editor.document);
        await invoke("write_note_content", { path: currentNoteRef.current!.path, content: md });
      } catch (e) {
        console.error("Failed to save note:", e);
      }
    }, 1000);
  }, [editor]);

  if (!currentNote) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 font-medium">
        <p>Select a note from the sidebar or click "New Note"</p>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-4xl mx-auto h-full flex flex-col pt-4 pb-32 transition-all duration-300 ${zenMode ? 'px-8 sm:px-12 lg:px-24' : 'px-4 sm:px-6 lg:px-8'}`}>
      {/* Editor Header */}
      <div className="flex justify-between items-center mb-8 mt-4">
        <button
          onClick={async () => {
            await flushSave();
            setCurrentNote(null);
            setMainView("folders");
            await useAppStore.getState().hydrate();
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all text-sm font-medium"
          title="Back to Gallery"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
        <button
          onClick={() => setZenMode(!zenMode)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          title={zenMode ? "Exit Zen Mode" : "Enter Zen Mode (Focus)"}
        >
          {zenMode ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 outline-none font-sans relative">
        <MantineProvider theme={mantineTheme}>
          <BlockNoteView
            editor={editor}
            theme={"light"}
            onChange={handleChange}
            formattingToolbar={false}
            sideMenu={false}
            data-theming-css-variables
          >
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-toolbar-in">
              <FormattingToolbar />
            </div>
          </BlockNoteView>
        </MantineProvider>
      </div>

      <style>{`
        @media (prefers-color-scheme: dark) {
           .bn-container {
              --bn-colors-editor-background: transparent !important;
              --bn-colors-editor-text: #f3f4f6 !important;
              --bn-colors-ui-background: #2b2d31 !important;
              --bn-colors-menu-background: #2b2d31 !important;
              --bn-colors-menu-text: #f3f4f6 !important;
           }
        }
        .bn-container {
           --bn-colors-editor-background: transparent !important;
           --bn-fonts-heading-1: 3em !important;
           --bn-fonts-heading-2: 2em !important;
           --bn-fonts-heading-3: 1.5em !important;
        }
        .animate-toolbar-in > .bn-toolbar {
          border-radius: 9999px !important;
          box-shadow: 0 10px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06) !important;
          animation: toolbar-in 0.16s ease-out;
        }
        @keyframes toolbar-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-color-scheme: dark) {
          .animate-toolbar-in > .bn-toolbar {
            box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06) !important;
          }
        }
      `}</style>
    </div>
  );
}
