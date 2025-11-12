"use client";
import React from "react";
type Props = {
  show?: boolean;
  text?: string;
};

export default function LoadingOverlay({ show = true, text }: Props) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-white/70 animate-spin"></div>
        <div className="absolute inset-1 rounded-full border-4 border-white/30 animate-pulse"></div>
      </div>
      {text && <p className="mt-3 text-white/90 text-sm tracking-wide">{text}</p>}
    </div>
  );
}



