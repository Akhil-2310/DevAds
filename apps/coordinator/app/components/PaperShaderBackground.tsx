"use client";

import { GrainGradient } from "@paper-design/shaders-react";

export function PaperShaderBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        pointerEvents: "none",
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      <GrainGradient
        style={{ height: "100%", width: "100%" }}
        colorBack="#04060e"
        softness={0.76}
        intensity={0.42}
        noise={0}
        shape="corners"
        offsetX={0}
        offsetY={0}
        scale={1}
        rotation={0}
        speed={0.65}
        colors={["#0d2a28", "#3dd9c9", "#d4a853", "#f0c674"]}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(4, 6, 14, 0.28)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 80% at 50% 50%, rgba(0,0,0,0) 50%, rgba(4,6,14,0.5) 100%)",
        }}
      />
    </div>
  );
}
