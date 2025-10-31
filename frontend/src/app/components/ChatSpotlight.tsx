// ChatSpotlight.tsx
"use client";
import React from "react";

interface ChatSpotlightProps {
  show: boolean;
  onClose: () => void;
}

export default function ChatSpotlight({ show, onClose }: ChatSpotlightProps) {
  if (!show) return null;

  // チャットボットが右上にある前提
  const chatSize = 56; // ボタン直径
  const paddingRight = 24; //くり抜きらの余白
  const offsetY = 185;
  const radius = 80; // くり抜きの半径

  // 上方向に合わせる (calc(0% + padding))
  const bg = `radial-gradient(
circle ${radius}px 
at calc(100% - ${chatSize / 2 + paddingRight}px) 
calc(${offsetY}px),
transparent 0 ${radius - 3}px,
rgba(0,0,0,0.6) ${radius - 2}px
)`;

  return (
    <div
      className="fixed inset-0 z-40 transition-opacity duration-300 pointer-events-none"
      style={{
        background: bg,
        backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    />
  );
}
