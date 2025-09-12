// src/app/components/ChatIcon.tsx
"use client";

import React, { useState } from "react";
import ChatWindow from "./ChatWindow";

const MessageIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" {...props}>
    {/* 吹き出し本体を白で固定 */}
    <path
      d="M4 3h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-8l-4 4v-4H4a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"
      fill="white"
    />
    {/* 三点リーダー（黒） */}
    <circle cx="8.5" cy="10.5" r="1.2" fill="blue" />
    <circle cx="11.5" cy="10.5" r="1.2" fill="blue" />
    <circle cx="14.5" cy="10.5" r="1.2" fill="blue" />
  </svg>
);




const ChatIcon: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        right: "max(20px, env(safe-area-inset-right, 0px) + 12px)",
        top: "max(150px, env(safe-area-inset-top, 0px) + 12px)",
        zIndex: 1000,
      }}
      className="flex flex-col items-end gap-2"
    >
      {isOpen && <ChatWindow onClose={() => setIsOpen(false)} />}

      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="チャットを開く"
        className="
          relative overflow-visible
          w-14 h-14 rounded-full border-4 border-white
          bg-gradient-to-br from-blue-500 to-blue-700
          text-white shadow-lg transition-all duration-500 ease-in-out
          hover:from-blue-600 hover:to-blue-800 hover:shadow-2xl
          hover:scale-110 hover:-translate-y-1 active:scale-95
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        "
      >
        {/* 波紋（デフォルト：ゆっくり） */}
        <span className="absolute inset-0 rounded-full ring-4 ring-blue-400/60 animate-ping" />

        {/* “呼吸”パルス（任意：クラス切替でON/OFF可能） */}
        <span className="absolute inset-0 rounded-full bg-blue-500/10 animate-pulse-soft pointer-events-none" />

        {/* 本体アイコン（ふわ浮き） */}
        <span className="relative z-10 inline-flex items-center justify-center">
          <MessageIcon className="w-7 h-7 animate-float animate-bounce-soft" />
        </span>
      </button>
    </div>
  );
};

export default ChatIcon;
