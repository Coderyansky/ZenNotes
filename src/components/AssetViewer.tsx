import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store";
import { convertFileSrc } from "@tauri-apps/api/core";
import { X, ZoomIn, ZoomOut, RotateCcw, FileText } from "lucide-react";

export function AssetViewer() {
  const viewingAsset = useAppStore((s) => s.viewingAsset);
  const setViewingAsset = useAppStore((s) => s.setViewingAsset);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const assetUrl = viewingAsset ? convertFileSrc(viewingAsset.path) : "";

  // Reset state when asset changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [viewingAsset?.path]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewingAsset(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setViewingAsset]);

  const handleZoomIn = useCallback(() =>
    setZoom((z) => Math.min(z + 0.25, 5)), []);
  const handleZoomOut = useCallback(() =>
    setZoom((z) => Math.max(z - 0.25, 0.25)), []);
  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (viewingAsset?.type !== "image") return;
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [viewingAsset?.type, pan]
  );
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: dragStart.current.panX + (e.clientX - dragStart.current.x),
        y: dragStart.current.panY + (e.clientY - dragStart.current.y),
      });
    },
    [isDragging]
  );
  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    if (viewingAsset?.type !== "image") return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(Math.max(z + delta, 0.25), 5));
  }, [viewingAsset?.type]);

  return (
    <AnimatePresence>
      {viewingAsset && (
        <motion.div
          key="asset-viewer-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", background: "rgba(0,0,0,0.75)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingAsset(null);
          }}
        >
          {viewingAsset.type === "image" ? (
            <ImageViewer
              url={assetUrl}
              name={viewingAsset.name}
              zoom={zoom}
              pan={pan}
              isDragging={isDragging}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheelZoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onReset={handleReset}
              onClose={() => setViewingAsset(null)}
            />
          ) : (
            <PDFViewer
              url={assetUrl}
              name={viewingAsset.name}
              onClose={() => setViewingAsset(null)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Image Viewer ─────────────────────────────────────────────────────── */

interface ImageViewerProps {
  url: string;
  name: string;
  zoom: number;
  pan: { x: number; y: number };
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onClose: () => void;
}

function ImageViewer({
  url, name, zoom, pan, isDragging,
  onMouseDown, onMouseMove, onMouseUp, onWheel,
  onZoomIn, onZoomOut, onReset, onClose,
}: ImageViewerProps) {
  return (
    <motion.div
      initial={{ scale: 0.88, opacity: 0, y: 24 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.88, opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      className="relative flex flex-col items-center"
      style={{ maxWidth: "92vw", maxHeight: "92vh" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between w-full mb-3 px-1">
        <span className="text-white/80 text-sm font-medium truncate max-w-[60vw] drop-shadow">
          {name}
        </span>
        <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
          <ToolBtn onClick={onZoomOut} title="Zoom out"><ZoomOut className="w-4 h-4" /></ToolBtn>
          <span className="text-white/70 text-xs w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <ToolBtn onClick={onZoomIn} title="Zoom in"><ZoomIn className="w-4 h-4" /></ToolBtn>
          <ToolBtn onClick={onReset} title="Reset zoom"><RotateCcw className="w-4 h-4" /></ToolBtn>
          <div className="w-px h-4 bg-white/20 mx-0.5" />
          <ToolBtn onClick={onClose} title="Close (Esc)">
            <X className="w-4 h-4" />
          </ToolBtn>
        </div>
      </div>

      {/* Image container */}
      <div
        className="overflow-hidden rounded-2xl shadow-2xl"
        style={{
          maxWidth: "90vw",
          maxHeight: "84vh",
          cursor: isDragging ? "grabbing" : zoom > 1 ? "grab" : "default",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <motion.img
          src={url}
          alt={name}
          draggable={false}
          animate={{ scale: zoom, x: pan.x, y: pan.y }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          style={{
            maxWidth: "90vw",
            maxHeight: "84vh",
            objectFit: "contain",
            display: "block",
            userSelect: "none",
          }}
        />
      </div>
    </motion.div>
  );
}

/* ── PDF Viewer ───────────────────────────────────────────────────────── */

function PDFViewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0, y: 32 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.92, opacity: 0, y: 32 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="flex flex-col bg-white dark:bg-[#1e1f23] rounded-2xl shadow-2xl overflow-hidden"
      style={{ width: "min(88vw, 1000px)", height: "min(90vh, 900px)" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-[#2b2d31] bg-white dark:bg-[#1e1f23] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10">
            <FileText className="w-4 h-4 text-red-500" />
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[60vw]">
            {name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* PDF embed */}
      <embed
        src={url}
        type="application/pdf"
        className="flex-1 w-full"
        style={{ minHeight: 0 }}
      />
    </motion.div>
  );
}

/* ── Helper ───────────────────────────────────────────────────────────── */

function ToolBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
    >
      {children}
    </button>
  );
}
