"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
type ShootingStar = {
  id: number;
  startX: number;
  startY: number;
};
{/* eslint-disable-next-line react-hooks/exhaustive-deps */}
export default function Background() {
  const [isMounted, setIsMounted] = useState(false);
  const [stars, setStars] = useState<ShootingStar[]>([]);

  useEffect(() => {
    setIsMounted(true);
    
    // 既存のチャネルがあれば削除（useEffectのクリーンアップに任せるのが良いが、念の為）
    const channel = supabase
      .channel("background-stars-global")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "polls",
        },
        () => {
          const id = Date.now() + Math.random();
          // 画面全体の上部から発生させ、斜めに流す
          const width = window.innerWidth;
          const height = window.innerHeight;
          
          // 右上または左上からランダムに発生させる
          const startX = Math.random() * width;
          const startY = Math.random() * (height * 0.3); // 上部30%

          setStars((prev) => [...prev, { id, startX, startY }]);
          
          // アニメーション完了後に削除
          setTimeout(() => {
            setStars((prev) => prev.filter((s) => s.id !== id));
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!isMounted) {
    return null;
  }

  // Blobの設定データ
  const blobs = [
    {
      color: "bg-indigo-600",
      top: "10%",
      left: "10%",
      width: "w-96",
      height: "h-96",
      animateX: [0, 100, -50, 0],
      animateY: [0, -50, 50, 0],
      duration: 25,
    },
    {
      color: "bg-purple-600",
      top: "20%",
      left: "80%",
      width: "w-[30rem]",
      height: "h-[30rem]",
      animateX: [0, -80, 40, 0],
      animateY: [0, 60, -60, 0],
      duration: 30,
    },
    {
      color: "bg-pink-600",
      top: "80%",
      left: "30%",
      width: "w-80",
      height: "h-80",
      animateX: [0, 60, -30, 0],
      animateY: [0, -40, 20, 0],
      duration: 22,
    },
    {
      color: "bg-blue-800",
      top: "70%",
      left: "70%",
      width: "w-[25rem]",
      height: "h-[25rem]",
      animateX: [0, -50, 25, 0],
      animateY: [0, 30, -30, 0],
      duration: 28,
    },
  ];

  return (
    <div className="fixed inset-0 -z-50 overflow-hidden bg-[#020617]">
      {blobs.map((blob, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full opacity-40 blur-[80px] mix-blend-screen ${blob.color} ${blob.width} ${blob.height}`}
          style={{
            top: blob.top,
            left: blob.left,
          }}
          animate={{
            x: blob.animateX,
            y: blob.animateY,
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{
            duration: blob.duration,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
        />
      ))}

      <AnimatePresence>
        {stars.map((star) => (
          <motion.div
            key={star.id}
            initial={{ opacity: 1, x: star.startX, y: star.startY, scale: 1 }}
            animate={{
              x: star.startX - 800 * 1.5, // 左下へ大きく移動
              y: star.startY + 800,
              opacity: 0,
            }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute rounded-full pointer-events-none z-0"
            style={{
              width: "4px",
              height: "4px",
              background: "white",
              boxShadow: "0 0 10px 2px rgba(255, 255, 255, 0.8), 0 0 20px 4px rgba(100, 200, 255, 0.4)",
            }}
          >
            {/* 尾を引く表現 */}
            <div 
              className="absolute top-0 right-0 h-full bg-gradient-to-l from-white to-transparent opacity-80" 
              style={{ 
                width: "200px", 
                transform: "rotate(-35deg)",
                transformOrigin: "right center"
              }} 
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
