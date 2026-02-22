"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

// ---------------------------
// Types
// ---------------------------
type Star = {
  id: number;
  top: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
};

type Cloud = {
  id: number;
  top: number;
  scale: number;
  duration: number;
  delay: number;
};

type ShootingStar = {
  id: number;
  startX: number;
  startY: number;
};

// ---------------------------
// Component
// ---------------------------
export default function NightSkyBackground() {
  const [isMounted, setIsMounted] = useState(false);
  const [stars, setStars] = useState<Star[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([]);

  // ---------------------------
  // Initialization (Client-side only)
  // ---------------------------
  useEffect(() => {
    setIsMounted(true);

    // 1. Generate Stars
    const starCount = 100;
    const newStars: Star[] = Array.from({ length: starCount }).map((_, i) => ({
      id: i,
      top: Math.random() * 100, // %
      left: Math.random() * 100, // %
      size: Math.random() * 2 + 1, // 1px - 3px
      duration: Math.random() * 3 + 2, // 2s - 5s
      delay: Math.random() * 5,
    }));
    setStars(newStars);

    // 2. Generate Clouds
    const cloudCount = 3;
    const newClouds: Cloud[] = Array.from({ length: cloudCount }).map((_, i) => ({
      id: i,
      top: Math.random() * 40 + 5, // 5% - 45% (upper half)
      scale: Math.random() * 0.5 + 0.8, // 0.8 - 1.3
      duration: Math.random() * 20 + 40, // 40s - 60s (slow)
      delay: i * -15, // Stagger start positions
    }));
    setClouds(newClouds);
  }, []);

  // ---------------------------
  // Realtime Subscription (Shooting Stars)
  // ---------------------------
  useEffect(() => {
    const channelId = `realtime-nightsky-${Math.random()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "polls" },
        (payload) => {
          console.log('Shooting star event received:', payload);
          const id = Date.now() + Math.random();
          const width = window.innerWidth;
          const height = window.innerHeight;
          
          // Random start position (mostly top/right or top/left)
          const startX = Math.random() * width;
          const startY = Math.random() * (height * 0.3);

          setShootingStars((prev) => [...prev, { id, startX, startY }]);
          
          // Remove after animation
          setTimeout(() => {
            setShootingStars((prev) => prev.filter((s) => s.id !== id));
          }, 2000);
        }
      )
      .subscribe((status) => {
        console.log(`[${channelId}] Subscription status:`, status);
      });

    return () => {
      console.log(`[${channelId}] Cleaning up...`);
      supabase.removeChannel(channel);
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div className="fixed inset-0 overflow-hidden z-[-1] bg-[#0a0e27]">
      {/* 1. Stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute bg-white rounded-full"
          style={{
            top: `${star.top}%`,
            left: `${star.left}%`,
            width: star.size,
            height: star.size,
            boxShadow: "0 0 4px rgba(255, 255, 255, 0.8)", // Glow effect
          }}
          animate={{
            opacity: [0.3, 1, 0.3], // Twinkle
            scale: [0.8, 1.2, 0.8], // Breathing
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* 2. Clouds */}
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute bg-white/25 rounded-full blur-xl"
          style={{
            top: `${cloud.top}%`,
            width: `${200 * cloud.scale}px`,
            height: `${70 * cloud.scale}px`,
          }}
          initial={{ x: "-20vw" }}
          animate={{ x: "120vw" }}
          transition={{
            duration: cloud.duration,
            repeat: Infinity,
            delay: cloud.delay,
            ease: "linear",
          }}
        />
      ))}

      {/* 4. Shooting Stars */}
      <AnimatePresence>
        {shootingStars.map((star) => (
          <ShootingStarItem key={star.id} startX={star.startX} startY={star.startY} />
        ))}
      </AnimatePresence>
      
      {/* 5. Vignette Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />
    </div>
  );
}

// ---------------------------
// Sub-components
// ---------------------------

function ShootingStarItem({ startX, startY }: { startX: number; startY: number }) {
  // Determine direction (mostly downwards-left or downwards-right)
  const angle = Math.random() > 0.5 ? 45 : 135; 
  const distance = 1000; // Increased distance for more impact
  
  // Calculate end position based on angle
  const rad = (angle * Math.PI) / 180;
  const endX = startX + Math.cos(rad) * distance;
  const endY = startY + Math.sin(rad) * distance;

  return (
    <motion.div
      initial={{ x: startX, y: startY, opacity: 1, scale: 0.5 }}
      animate={{ x: endX, y: endY, opacity: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: "easeOut" }} // Slightly slower duration
      className="absolute w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.8)] pointer-events-none z-50" // Smaller, subtler glow
    >
        {/* Tail - Thinner and slightly shorter */}
        <div 
            className="absolute top-1/2 left-1/2 w-48 h-[2px] bg-gradient-to-r from-transparent via-blue-50/50 to-white transform -translate-y-1/2 -translate-x-full origin-right"
            style={{ transform: `rotate(${angle + 180}deg)` }}
        />
    </motion.div>
  );
}
