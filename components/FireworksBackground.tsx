"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

// ---------------------------
// Types
// ---------------------------
type Firework = {
  id: number;
  x: number; // Percentage (0-100)
  y: number; // Percentage (0-100), 0 is top
  color: string;
};

type Cloud = {
  id: number;
  top: number;
  scale: number;
  duration: number;
  delay: number;
};

// ---------------------------
// Component
// ---------------------------
export default function FireworksBackground() {
  const [fireworks, setFireworks] = useState<Firework[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);

  const handleAnimationComplete = (id: number) => {
    setFireworks((prev) => prev.filter((fw) => fw.id !== id));
  };

  const triggerFirework = useCallback((e?: React.MouseEvent) => {
    const id = Date.now() + Math.random();
    const colors = ["#ff5252", "#ffd740", "#40c4ff", "#69f0ae"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    let startX = 50; 
    let startY = 30; // Default target height (30% from top = 70% from bottom)

    if (e) {
      // Click event - Calculate percentage position
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      startX = (clientX / innerWidth) * 100;
      startY = (clientY / innerHeight) * 100;
      console.log("Fireworks triggered at", clientX, clientY);
    } else {
      // Random trigger
      startX = Math.random() * 80 + 10; // 10% - 90%
      startY = Math.random() * 40 + 20; // 20% - 60% from top
      console.log("Fireworks triggered via Realtime or Init");
    }

    setFireworks((prev) => [...prev, { id, x: startX, y: startY, color }]);
  }, []);

  // ---------------------------
  // Initialization & Realtime
  // ---------------------------
  useEffect(() => {
    // 1. Generate Clouds (Same as NightSkyBackground)
    const cloudCount = 3;
    const newClouds: Cloud[] = Array.from({ length: cloudCount }).map((_, i) => ({
      id: i,
      top: Math.random() * 40 + 5, // 5% - 45%
      scale: Math.random() * 0.5 + 0.8, // 0.8 - 1.3
      duration: Math.random() * 20 + 40, // 40s - 60s
      delay: i * -15, 
    }));
    setClouds(newClouds);

    // 2. Realtime Subscription
    const channelId = `realtime-fireworks-${Math.random()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "polls" },
        (payload) => {
          console.log('Event received in background:', payload);
          triggerFirework();
        }
      )
      .subscribe((status) => {
         console.log(`[${channelId}] Subscription status:`, status);
      });

    return () => {
      console.log(`[${channelId}] Cleaning up...`);
      supabase.removeChannel(channel);
    };
  }, [triggerFirework]);

  return (
    <div 
      className="fixed inset-0 overflow-hidden z-[-1] bg-[#1a1f3c] pointer-events-none"
    >
      {/* 1. Clouds */}
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute bg-white/20 rounded-full blur-xl"
          style={{
            top: `${cloud.top}%`,
            width: `${200 * cloud.scale}px`,
            height: `${70 * cloud.scale}px`,
            zIndex: 0,
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

      {/* 2. Fireworks Container */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
        <AnimatePresence>
          {fireworks.map((fw) => (
            <FireworkEffect 
                key={fw.id} 
                x={fw.x} 
                y={fw.y} 
                color={fw.color} 
                onComplete={() => handleAnimationComplete(fw.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* 3. Lanterns & Rope (Foreground) */}
      <LanternRope />
      
      {/* 4. Gradient Overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" style={{ zIndex: 5 }} />
    </div>
  );
}

// ---------------------------
// Sub-components
// ---------------------------

function FireworkEffect({ x, y, color, onComplete }: { x: number; y: number; color: string; onComplete?: () => void }) {
  const particleCount = 60; 
  
  return (
    <motion.div 
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
    >
       {/* Explosion Sparks */}
       <div 
         className="absolute"
         style={{ left: `${x}%`, top: `${y}%`, zIndex: 50 }} 
       >
          {Array.from({ length: particleCount }).map((_, i) => {
             const angle = (i / particleCount) * 360;
             const radius = Math.random() * 100 + 50; 
             
             return (
               <motion.div
                 key={i}
                 className="absolute rounded-full"
                 style={{ 
                    width: "4px",
                    height: "4px",
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}`,
                 }}
                 initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                 animate={{ 
                    x: Math.cos((angle * Math.PI) / 180) * radius,
                    y: Math.sin((angle * Math.PI) / 180) * radius + 100, 
                    opacity: [1, 1, 0],
                    scale: [1, 0.8, 0]
                 }}
                 transition={{ 
                    duration: 1.5, 
                    ease: "easeOut", 
                 }}
                 onAnimationComplete={i === 0 ? onComplete : undefined} 
               />
             );
          })}
       </div>

       {/* Launch Trail */}
       <motion.div
         className="absolute w-[2px] bg-white/80"
         style={{ left: `${x}%` }}
         initial={{ top: "100%", height: "20px", opacity: 1 }}
         animate={{ top: `${y}%`, height: "0px", opacity: 0 }}
         transition={{ duration: 0.5, ease: "easeOut" }}
       >
          <div className="absolute top-0 transform -translate-y-full left-1/2 -translate-x-1/2 w-[2px] h-32 bg-gradient-to-b from-white to-transparent" />
       </motion.div>
    </motion.div>
  );
}

function LanternRope() {
    return (
        <div className="absolute bottom-[100px] left-0 right-0 h-32 pointer-events-none" style={{ zIndex: 30 }}>
            {/* SVG Rope */}
            <svg 
                className="absolute top-0 left-0 w-full h-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
            >
                {/* A shallow U shape curve from left-center to right-center */}
                <path 
                    d="M 0,20 Q 50,60 100,20" 
                    fill="none" 
                    stroke="rgba(255,255,255,0.4)" 
                    strokeWidth="0.5"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>

            {/* Lanterns placed along the curve */}
            {/* We approximate the y-position based on x-percentage using the parabola y = a(x-50)^2 + k.
                Let's say x is 0..100. Center is 50.
                Curve goes from (0,20) to (100,20) with dip at (50, 60).
                Vertex form: y = a(x-h)^2 + k. (h,k) = (50, 60).
                20 = a(0-50)^2 + 60 => -40 = 2500a => a = -40/2500 = -0.016.
                Wait, y axis goes down in SVG (y=0 is top). So dip is higher y value.
                Vertex (50, 60). Point (0, 20).
                20 = a(0-50)^2 + 60 => -40 = 2500a => a = -0.016.
                Wait, this logic means y decreases as we move away from 50 (parabola opens down visually, but technically x axis is top).
                Actually, we want a 'hanging' rope, so it opens UP in coordinate system (higher y is lower on screen).
                So vertex is maximum y. 
                Yes. (50, 60) is the lowest point visually (highest y value).
                (0, 20) is start.
                So a should be correct. Let's place lanterns at interval 10%.
             */}
            <div className="absolute inset-0 w-full h-full">
                {Array.from({ length: 11 }).map((_, i) => {
                    const x = i * 10; // 0% to 100%
                    
                    // Bezier Curve: M 0,20 Q 50,60 100,20
                    // B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
                    // We need y for a given x. Since P0.x=0, P1.x=50, P2.x=100, t = x/100.
                    // Py(t) = (1-t)^2 * 20 + 2(1-t)t * 60 + t^2 * 20
                    
                    const t = x / 100;
                    const y = Math.pow(1 - t, 2) * 20 + 2 * (1 - t) * t * 60 + Math.pow(t, 2) * 20;

                    const isRed = i % 2 === 0;
                    
                    return (
                        <div 
                            key={i}
                            className={`absolute -translate-x-1/2 ${i === 0 || i === 10 ? 'hidden md:block' : ''}`} // Hide edges on small screens if needed
                            style={{ 
                                left: `${x}%`,
                                top: `${y}%`,
                            }}
                        >
                            <Lantern isRed={isRed} index={i} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Lantern({ isRed, index }: { isRed: boolean; index: number }) {
    return (
        <motion.div
            className={`w-8 h-12 sm:w-10 sm:h-14 rounded-full border-t-4 border-b-4 border-black box-border shadow-lg flex items-center justify-center relative overflow-hidden`}
            style={{
                backgroundColor: isRed ? "#dc2626" : "#fcd34d", // Red or Yellow
                boxShadow: `0 5px 15px ${isRed ? "rgba(220, 38, 38, 0.4)" : "rgba(252, 211, 77, 0.4)"}`
            }}
            animate={{
                rotate: [-5, 5, -5],
            }}
            transition={{
                duration: 3 + Math.random(),
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.2
            }}
        >
             {/* Ribs of the lantern */}
            <div className="absolute inset-x-0 top-[20%] h-[1px] bg-black/20" />
            <div className="absolute inset-x-0 top-[40%] h-[1px] bg-black/20" />
            <div className="absolute inset-x-0 top-[60%] h-[1px] bg-black/20" />
            <div className="absolute inset-x-0 top-[80%] h-[1px] bg-black/20" />

            {/* Inner glow pulse */}
            <motion.div
                className="absolute inset-0 bg-white/30"
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{
                    duration: 2 + Math.random(),
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />
        </motion.div>
    )
}

