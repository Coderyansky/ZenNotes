import { useState, useEffect } from "react";
import { useAppStore } from "../store";
import { FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export function HomeScreen() {
  const setMainView = useAppStore((state) => state.setMainView);
  const setActiveFilter = useAppStore((state) => state.setActiveFilter);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#f4f5f5] dark:bg-[#1a1b1e] p-8 transition-colors">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center text-center space-y-6"
      >
        <div className="space-y-2">
          <h1 className="text-7xl font-light text-gray-900 dark:text-gray-100 tracking-tight">
            {format(time, "HH:mm")}
          </h1>
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
            {format(time, "EEEE, MMMM do")}
          </p>
        </div>

        <button 
          onClick={() => {
            setActiveFilter("all");
            setMainView("folders");
          }}
          className="mt-12 flex items-center gap-3 px-8 py-4 bg-white dark:bg-[#2b2d31] hover:bg-black/5 dark:hover:bg-white/5 border border-gray-200 dark:border-[#404249] rounded-2xl shadow-sm hover:shadow-md transition-all group"
        >
          <div className="p-2 bg-[var(--app-accent)]/10 rounded-lg group-hover:scale-110 transition-transform">
            <FolderOpen className="w-6 h-6 text-[var(--app-accent)]" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Browse Folders</h3>
            <p className="text-sm text-gray-500">Open your vault navigation</p>
          </div>
        </button>
      </motion.div>
    </div>
  );
}
