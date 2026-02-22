"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import NightSkyBackground from "./NightSkyBackground";
import FireworksBackground from "./FireworksBackground";
import { motion, AnimatePresence } from "framer-motion";

type BackgroundType = "night_sky" | "fireworks";

interface BackgroundContextType {
  background: BackgroundType;
  toggleBackground: () => void;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export function useBackground() {
  const context = useContext(BackgroundContext);
  if (!context) {
    throw new Error("useBackground must be used within a BackgroundProvider");
  }
  return context;
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [background, setBackground] = useState<BackgroundType>("night_sky");

  const toggleBackground = () => {
    setBackground((prev) => (prev === "night_sky" ? "fireworks" : "night_sky"));
  };

  return (
    <BackgroundContext.Provider value={{ background, toggleBackground }}>
      {/* Background Rendering */}
      <AnimatePresence mode="wait">
        {background === "night_sky" ? (
          <motion.div
            key="night_sky"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[-1]"
          >
            <NightSkyBackground />
          </motion.div>
        ) : (
          <motion.div
            key="fireworks"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[-1]"
          >
            <FireworksBackground />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen">
          {children}
          
          {/* Toggle Button */}
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={toggleBackground}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-sm text-white font-medium transition-colors shadow-lg flex items-center gap-2"
            >
              <span>🎨</span> 
              {background === "night_sky" ? "花火モードへ" : "星空モードへ"}
            </button>
          </div>
      </div>
    </BackgroundContext.Provider>
  );
}
