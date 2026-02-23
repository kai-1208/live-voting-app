"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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

  useEffect(() => {
    // Load persisted background state on mount
    const saved = localStorage.getItem("app-background") as BackgroundType;
    if (saved && (saved === "night_sky" || saved === "fireworks")) {
      setBackground(saved);
    }
  }, []);

  const toggleBackground = () => {
    setBackground((prev) => {
      const next = prev === "night_sky" ? "fireworks" : "night_sky";
      localStorage.setItem("app-background", next);
      return next;
    });
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
      </div>
    </BackgroundContext.Provider>
  );
}
