import { useEffect, useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAppStore } from "../../store";

import "@blocknote/core/fonts/inter.css";
import {
  useCreateBlockNote,
  FormattingToolbar,
  createReactBlockSpec,
  TableHandlesController,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { MantineProvider, createTheme, Menu } from "@mantine/core";
import { BlockNoteSchema, defaultBlockSpecs, createCodeBlockSpec } from "@blocknote/core";
import { createHighlighter } from "shiki";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronDown, ChevronUp, Maximize2, FileDown, Download } from "lucide-react";

const mantineTheme = createTheme({
  components: {
    Menu: Menu.extend({
      defaultProps: {
        position: "top",
      },
    }),
  },
});

/* ── PDF Embed Block ──────────────────────────────────────────────────── */

function PDFEmbedView({ url, fileName }: { url: string; fileName: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const setViewingAsset = useAppStore((s) => s.setViewingAsset);

  return (
    <div
      className="my-2 rounded-2xl overflow-hidden border border-red-200 dark:border-red-900/40 shadow-sm"
      contentEditable={false}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20">
        <div className="p-1.5 rounded-lg bg-white/70 dark:bg-red-900/30 flex-shrink-0">
          <FileText className="w-4 h-4 text-red-500" />
        </div>
        <span className="flex-1 text-sm font-semibold text-red-700 dark:text-red-300 truncate">
          {fileName}
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-md flex-shrink-0">
          PDF
        </span>
        <button
          onClick={() =>
            setViewingAsset({ path: decodeURIComponent(url.replace(/^asset:\/\/localhost/, "")), type: "pdf", name: fileName })
          }
          title="Open fullscreen"
          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-white/50 dark:hover:bg-red-900/30 transition-all flex-shrink-0"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand" : "Collapse"}
          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-white/50 dark:hover:bg-red-900/30 transition-all flex-shrink-0"
        >
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* PDF embed */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 520, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ overflow: "hidden" }}
          >
            <embed
              src={url}
              type="application/pdf"
              style={{ width: "100%", height: "520px", display: "block" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const makePDFBlock = createReactBlockSpec(
  {
    type: "pdfEmbed" as const,
    propSchema: {
      url: { default: "" },
      fileName: { default: "attachment.pdf" },
    },
    content: "none" as const,
  },
  {
    render: ({ block }: any) => (
      <PDFEmbedView url={block.props.url} fileName={block.props.fileName} />
    ),
  }
);

const { codeBlock: _unused, ...defaultBlockSpecsWithoutCode } = defaultBlockSpecs;

const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecsWithoutCode,
    codeBlock: createCodeBlockSpec({
      createHighlighter: () =>
        createHighlighter({
          themes: ["github-dark", "github-light"],
          langs: [
            "javascript", "typescript", "python", "rust", "bash",
            "json", "css", "html", "markdown", "go", "sql", "tsx", "jsx",
          ],
        }),
      supportedLanguages: {
        javascript: { name: "JavaScript", aliases: ["js"] },
        typescript: { name: "TypeScript", aliases: ["ts"] },
        tsx: { name: "TSX", aliases: [] },
        jsx: { name: "JSX", aliases: [] },
        python: { name: "Python", aliases: ["py"] },
        rust: { name: "Rust", aliases: ["rs"] },
        bash: { name: "Bash", aliases: ["sh", "shell"] },
        json: { name: "JSON", aliases: [] },
        css: { name: "CSS", aliases: [] },
        html: { name: "HTML", aliases: [] },
        markdown: { name: "Markdown", aliases: ["md"] },
        go: { name: "Go", aliases: ["golang"] },
        sql: { name: "SQL", aliases: [] },
      },
    }),
    pdfEmbed: makePDFBlock(),
  },
});

/* ── PDF helpers ──────────────────────────────────────────────────────── */

const PDF_COMMENT_RE = /<!-- zennotes-pdf: (\{.*?\}) -->/g;

function extractPdfBlocks(body: string): {
  clean: string;
  pdfs: Array<{ url: string; fileName: string }>;
} {
  const pdfs: Array<{ url: string; fileName: string }> = [];
  const clean = body.replace(PDF_COMMENT_RE, (_m, json) => {
    try {
      pdfs.push(JSON.parse(json));
    } catch {}
    return "";
  }).trim();
  return { clean, pdfs };
}

function serializePdfBlocks(doc: any[]): string {
  return doc
    .filter((b) => b.type === "pdfEmbed")
    .map((b) =>
      `<!-- zennotes-pdf: ${JSON.stringify({ url: b.props.url, fileName: b.props.fileName })} -->`
    )
    .join("\n");
}

/* ── Editor drag-drop overlay ─────────────────────────────────────────── */

function DropOverlay({ visible, hasPdf }: { visible: boolean; hasPdf: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="editor-drop-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none rounded-2xl"
          style={{
            background: hasPdf
              ? "rgba(239,68,68,0.07)"
              : "rgba(59,130,246,0.07)",
            border: `2px dashed ${hasPdf ? "#ef4444" : "var(--app-accent)"}`,
          }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            className="flex flex-col items-center gap-2"
          >
            <div
              className="p-4 rounded-2xl"
              style={{ background: hasPdf ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)" }}
            >
              <FileText
                className="w-8 h-8"
                style={{ color: hasPdf ? "#ef4444" : "var(--app-accent)" }}
              />
            </div>
            <p
              className="text-sm font-semibold"
              style={{ color: hasPdf ? "#ef4444" : "var(--app-accent)" }}
            >
              {hasPdf ? "Drop PDF to embed" : "Drop image to insert"}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Font family map ──────────────────────────────────────────────────── */
const FONT_FAMILY_MAP = {
  sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  mono: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Monaco, monospace",
};

/* ── Main Editor Component ────────────────────────────────────────────── */

export function BlockNoteEditor() {
  const currentNote = useAppStore((state) => state.currentNote);
  const vaultPath = useAppStore((state) => state.vaultPath);
  const zenMode = useAppStore((state) => state.zenMode);
  const setZenMode = useAppStore((state) => state.setZenMode);
  const setMainView = useAppStore((state) => state.setMainView);
  const setCurrentNote = useAppStore((state) => state.setCurrentNote);
  const editorSettings = useAppStore((state) => state.editorSettings);

  const [title, setTitle] = useState("");
  const titleRef = useRef("");
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [hasPdfDrag, setHasPdfDrag] = useState(false);
  const dragCounter = useRef(0);

  // ── image upload (for BlockNote's built-in image block) ────────────────
  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      if (!vaultPath) return "";
      try {
        const buffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        const relativePath: string = await invoke("save_asset_in_vault", {
          vaultPath,
          name: file.name,
          data: bytes,
        });
        const sep = vaultPath.includes("\\") ? "\\" : "/";
        const absolutePath = `${vaultPath}${sep}${relativePath.replace(/\//g, sep)}`;
        return convertFileSrc(absolutePath);
      } catch (e) {
        console.error("Failed to upload image:", e);
        return "";
      }
    },
    [vaultPath]
  );

  const editor = useCreateBlockNote({
    schema: editorSchema,
    uploadFile: uploadImage,
  });

  // ── load note ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentNote) return;
    let isMounted = true;

    invoke<string>("read_note_content", { path: currentNote.path })
      .then(async (content) => {
        if (!isMounted) return;

        const lines = content.split("\n");
        const extractedTitle = lines[0].replace(/^#+\s*/, "").trim();
        titleRef.current = extractedTitle;
        setTitle(extractedTitle);

        const rawBody = lines.slice(1).join("\n").trimStart();
        const { clean: body, pdfs } = extractPdfBlocks(rawBody);

        let blocks: any[];
        if (!body) {
          blocks = [{ type: "paragraph", content: "" }];
        } else {
          blocks = await editor.tryParseMarkdownToBlocks(body);
        }

        const pdfBlocks = pdfs.map((d) => ({
          type: "pdfEmbed" as const,
          props: { url: d.url, fileName: d.fileName },
        }));

        editor.replaceBlocks(editor.document, [...blocks, ...pdfBlocks] as any);
      })
      .catch((e) => console.error("Failed to load note:", e));

    return () => { isMounted = false; };
  }, [currentNote?.id, editor]);

  // ── save ───────────────────────────────────────────────────────────────
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNoteRef = useRef(currentNote);
  currentNoteRef.current = currentNote;

  const saveNow = useCallback(
    async (path: string) => {
      const body = await editor.blocksToMarkdownLossy(editor.document);
      const pdfSerial = serializePdfBlocks(editor.document as any[]);
      const content =
        `# ${titleRef.current}\n\n${body}` +
        (pdfSerial ? `\n\n${pdfSerial}` : "");
      await invoke("write_note_content", { path, content });
    },
    [editor]
  );

  const flushSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (!currentNoteRef.current) return;
    try {
      await saveNow(currentNoteRef.current.path);
    } catch (e) {
      console.error("Failed to save note:", e);
    }
  }, [saveNow]);

  const handleChange = useCallback(() => {
    if (!currentNoteRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (currentNoteRef.current) await saveNow(currentNoteRef.current.path);
      } catch (e) {
        console.error("Failed to save note:", e);
      }
    }, 1000);
  }, [saveNow]);

  // ── PDF drag-drop ──────────────────────────────────────────────────────
  const insertPdf = useCallback(
    async (file: File) => {
      if (!vaultPath) return;
      const buffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      const relativePath: string = await invoke("save_asset_in_vault", {
        vaultPath,
        name: file.name,
        data: bytes,
      });
      const sep = vaultPath.includes("\\") ? "\\" : "/";
      const absolutePath = `${vaultPath}${sep}${relativePath.replace(/\//g, sep)}`;
      const url = convertFileSrc(absolutePath);

      const cursor = editor.getTextCursorPosition();
      editor.insertBlocks(
        [{ type: "pdfEmbed" as const, props: { url, fileName: file.name } } as any],
        cursor.block,
        "after"
      );
      handleChange();
    },
    [vaultPath, editor, handleChange]
  );

  const handleContainerDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
      const items = Array.from(e.dataTransfer.items);
      const hasPdf = items.some(
        (it) => it.type === "application/pdf" || it.type === ""
      );
      setHasPdfDrag(hasPdf);
    }
  }, []);

  const handleContainerDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
      setHasPdfDrag(false);
    }
  }, []);

  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
    }
  }, []);

  const handleContainerDrop = useCallback(
    async (e: React.DragEvent) => {
      setIsDragOver(false);
      setHasPdfDrag(false);
      dragCounter.current = 0;

      const files = Array.from(e.dataTransfer?.files ?? []);
      const pdfs = files.filter(
        (f) =>
          f.type === "application/pdf" ||
          f.name.toLowerCase().endsWith(".pdf")
      );

      if (pdfs.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        for (const pdf of pdfs) {
          await insertPdf(pdf);
        }
        return;
      }
    },
    [insertPdf]
  );

  // ── paste handler ──────────────────────────────────────────────────────
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const pdfItem = items.find((i) => i.type === "application/pdf");
      if (pdfItem) {
        e.preventDefault();
        const file = pdfItem.getAsFile();
        if (file) await insertPdf(file);
      }
    },
    [insertPdf]
  );

  // ── PDF print export ───────────────────────────────────────────────────
  const handlePrintExport = useCallback(() => {
    window.print();
  }, []);

  // ── Markdown export ────────────────────────────────────────────────────
  const handleMarkdownExport = useCallback(async () => {
    if (!currentNote) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const destPath = await open({ directory: true, multiple: false, title: "Export Note To..." });
      if (!destPath || typeof destPath !== "string") return;
      await invoke("export_notes", { paths: [currentNote.path], destPath });
    } catch (e) {
      console.error("Export failed:", e);
    }
  }, [currentNote]);

  // ── Editor style from settings ─────────────────────────────────────────
  const editorStyle: React.CSSProperties = {
    fontSize: `${editorSettings.fontSize}px`,
    lineHeight: editorSettings.lineHeight,
    fontFamily: FONT_FAMILY_MAP[editorSettings.fontFamily],
  };

  if (!currentNote) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 font-medium">
        <p>Select a note from the sidebar or click "New Note"</p>
      </div>
    );
  }

  return (
    <div
      className={`w-full max-w-4xl mx-auto h-full flex flex-col pt-4 pb-32 transition-all duration-300 ${
        zenMode ? "px-8 sm:px-12 lg:px-24" : "px-4 sm:px-6 lg:px-8"
      }`}
    >
      {/* ── Editor Header ────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-6 mt-4">
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
        <div className="flex items-center gap-1">
          <button
            onClick={handleMarkdownExport}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            title="Export as Markdown"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handlePrintExport}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            title="Export as PDF (Print)"
          >
            <FileDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZenMode(!zenMode)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            title={zenMode ? "Exit Zen Mode" : "Enter Zen Mode (Focus)"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Title ────────────────────────────────────────────────────── */}
      <input
        value={title}
        onChange={(e) => {
          titleRef.current = e.target.value;
          setTitle(e.target.value);
          handleChange();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            editorContainerRef.current
              ?.querySelector<HTMLElement>(".bn-editor")
              ?.focus();
          }
        }}
        placeholder="Untitled"
        style={{ fontFamily: FONT_FAMILY_MAP[editorSettings.fontFamily] }}
        className="w-full text-4xl font-bold bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 mb-6 leading-tight pl-[54px]"
      />

      {/* ── Editor (with drag-drop zone) ──────────────────────────── */}
      <div
        ref={editorContainerRef}
        className="flex-1 overflow-y-auto no-scrollbar pb-32 outline-none font-sans relative"
        style={editorStyle}
        onDragEnter={handleContainerDragEnter}
        onDragLeave={handleContainerDragLeave}
        onDragOver={handleContainerDragOver}
        onDrop={handleContainerDrop}
        onPaste={handlePaste}
      >
        <DropOverlay visible={isDragOver} hasPdf={hasPdfDrag} />

        <MantineProvider theme={mantineTheme}>
          <BlockNoteView
            editor={editor}
            theme={"light"}
            onChange={handleChange}
            formattingToolbar={false}
            sideMenu={false}
            data-theming-css-variables
          >
            <div
              className="fixed bottom-8 -translate-x-1/2 z-50 animate-toolbar-in"
              style={{ left: "calc(50vw + 8rem)" }}
            >
              <FormattingToolbar />
            </div>
            <TableHandlesController />
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
        /* Merge consecutive blockquote blocks into one visual unit */
        .bn-block-outer[data-prev-block-type="quote"] > .bn-block > .bn-block-content[data-content-type="quote"] {
          border-top: none !important;
          border-top-left-radius: 0 !important;
          border-top-right-radius: 0 !important;
          padding-top: 0 !important;
        }
        .bn-block-outer[data-next-block-type="quote"] > .bn-block > .bn-block-content[data-content-type="quote"] {
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
          padding-bottom: 0 !important;
        }
        .bn-block-outer[data-prev-block-type="quote"] {
          margin-top: 0 !important;
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
          /* Table handles dark mode */
          .bn-table-handle {
            background-color: #2b2d31 !important;
            border-color: #404249 !important;
          }
          .bn-table-cell-menu {
            background-color: #2b2d31 !important;
            border-color: #404249 !important;
            color: #f3f4f6 !important;
          }
        }
      `}</style>
    </div>
  );
}
