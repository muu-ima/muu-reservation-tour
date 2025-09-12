import React, { useState, useEffect } from "react";

interface ChatWindowProps {
  onClose: () => void;
}

type Option = {
  text: string;
  url?: string;
  nextId?: string;
};

type Node = {
  id: string;
  text: string;
  options?: Option[];
};

const treeData: Record<string, Node> = {
  start: {
    id: "start",
    text: "何について知りたいですか？",
    options: [
      { text: "アクセスについて知りたい", nextId: "access" },
      { text: "利用開始について知りたい", nextId: "startGuide" },
      { text: "問い合わせについて", nextId: "contact" },
    ],
  },
  access: {
    id: "access",
    text: "アクセスページはこちらです。",
    options: [
      { text: "アクセスページを開く", url: "https://example.com/access" },
    ],
  },
  startGuide: {
    id: "startGuide",
    text: "利用開始ページはこちらです。",
    options: [
      { text: "利用開始ページを開く", url: "https://example.com/start" },
    ],
  },
  contact: {
    id: "contact",
    text: "お問い合わせページはこちらです。",
    options: [
      { text: "お問い合わせページを開く", url: "https://example.com/contact" },
    ],
  },
};

const ChatWindow: React.FC<ChatWindowProps> = ({ onClose }) => {
  const [currentNodeId, setCurrentNodeId] = useState<string>("start");
  const [fadeIn, setFadeIn] = useState(false);
  const currentNode = treeData[currentNodeId];

  useEffect(() => {
    setFadeIn(true);
    return () => setFadeIn(false);
  }, [currentNodeId]);

  const handleOptionClick = (option: Option) => {
    if (option.url) {
      window.open(option.url, "_blank");
    }
    if (option.nextId) {
      setFadeIn(false);
      setTimeout(() => setCurrentNodeId(option.nextId!), 300);
    }
  };

  const handleBack = () => {
    if (currentNodeId !== "start") {
      setFadeIn(false);
      setTimeout(() => setCurrentNodeId("start"), 300);
    }
  };

  return (
    <div
      style={{
        width: 320,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
        padding: 16,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        display: "flex",
        flexDirection: "column",
        opacity: fadeIn ? 1 : 0,
        transition: "opacity 0.3s ease-in-out",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          borderBottom: "1px solid #eee",
          paddingBottom: 8,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, color: "#333" }}>簡単チャットボット</h2>
        <button
          onClick={onClose}
          aria-label="チャットを閉じる"
          style={{
            background: "transparent",
            border: "none",
            fontSize: 24,
            cursor: "pointer",
            color: "#888",
            lineHeight: 1,
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "#f44336")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#888")}
        >
          ×
        </button>
      </div>

      {/* 質問文 */}
      <p style={{ color: "#555", fontSize: 16, marginBottom: 20 }}>{currentNode.text}</p>

      {/* ボタン群 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flexGrow: 1 }}>
        {currentNode.options?.map((option, idx) => (
          <button
            key={idx}
            onClick={() => handleOptionClick(option)}
            style={{
              padding: "10px 14px",
              backgroundColor: "#1976d2",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 15,
              cursor: "pointer",
              transition: "background-color 0.3s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#115293")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#1976d2")}
          >
            {option.text}
          </button>
        ))}
      </div>

      {/* 戻るボタン */}
      <button
        onClick={handleBack}
        disabled={currentNodeId === "start"}
        style={{
          marginTop: 16,
          alignSelf: "flex-start",
          backgroundColor: currentNodeId === "start" ? "#ccc" : "#eee",
          border: "none",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 14,
          cursor: currentNodeId === "start" ? "not-allowed" : "pointer",
          color: currentNodeId === "start" ? "#888" : "#333",
          transition: "background-color 0.3s",
        }}
        onMouseOver={(e) => {
          if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#ddd";
        }}
        onMouseOut={(e) => {
          if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#eee";
        }}
      >
        ← 戻る
      </button>
    </div>
  );
};

export default ChatWindow;
