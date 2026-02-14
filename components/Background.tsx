"use client";

import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Container, Engine } from "@tsparticles/engine";

export default function Background() {
  const [isMounted, setIsMounted] = useState(false);
  const [init, setInit] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    initParticlesEngine(async (engine: Engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  if (!isMounted || !init) {
    return null;
  }

  return (
    <div className="fixed inset-0 -z-10 bg-black">
      <Particles
        id="tsparticles"
        options={{
          fullScreen: { enable: false },
          background: {
            color: {
              value: "#000000",
            },
          },
          fpsLimit: 120,
          particles: {
            color: {
              value: "#ffffff",
            },
            move: {
              enable: true,
              speed: 0.5,
              direction: "none",
              outModes: "out",
            },
            number: {
              density: {
                enable: true,
                width: 800,
                height: 800,
              },
              value: 100,
            },
            opacity: {
              value: { min: 0.1, max: 0.8 },
              animation: {
                enable: true,
                speed: 1,
                sync: false
              }
            },
            shape: {
              type: "circle",
            },
            size: {
              value: { min: 1, max: 3 },
            },
          },
        }}
        className="absolute inset-0"
      />
    </div>
  );
}
