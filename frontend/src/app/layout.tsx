// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import RouteLoader from "@/components/RouteLoader";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// ★ “japanese” サブセットは存在しない。latin のみでOK
const noto = Noto_Sans_JP({
  variable: "--font-noto",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const zen = Zen_Maru_Gothic({
  variable: "--font-zen",
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "予約管理システム",
  description: "Monotone UI with a single accent color",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="mono" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${noto.variable} ${zen.variable} antialiased`}>
           {/* ▼ 全ページ共通ローダー（ページ遷移で表示） */}
        <RouteLoader />
        {children}

        <style id="mono-theme">{`
          /* ===== Palette (Light) ===== */
          .mono {
            --bg: #faf7f5;
            --panel: #ffffff;
            --border: #e7dcd5;
            --text: #3a3a3a;
            --muted: #9a8f89;
            --accent: #6fa6c9;
            --accent-warm: #e8a27f;
            --bg-warm: #f6ede7;
            --ok:#1f8b4c; --warn:#b45309; --danger:#b91c1c;

            /* ▼ 背景画像（/public/bg-soft-warm.png に配置） */
            --bg-img: url('/bg_page_1.png');
            --bg-img-opacity: 0.44;   /* 0.38–0.50 あたりで調整 */
            --bg-img-blur: 1.5px;     /* 1–2px で“ふんわり” */
            --bg-img-sat: 112%;       /* 少しだけ華やかに */
            --bg-img-scale: 1.04;     /* 周縁の切れ対策に1–4%拡大 */
          }

          @media (prefers-color-scheme: dark) {
            .mono {
              --bg:#0b0d10; --panel:#121418; --border:#262a30;
              --text:#e5e7eb; --muted:#9aa0a6;
              --bg-img-opacity: 0.55;
              --bg-img-blur: 2px;
              --bg-img-sat: 115%;
            }
          }

          /* ===== Base ===== */
          .mono body {
            position: relative;
            background: transparent; /* 背景は透明にして画像を見せる */
            color: var(--text);
          }

          /* ===== 全画面の背景画像 ===== */
          .mono body::before {
            content: "";
            position: fixed;
            inset: 0;
            z-index: -1; /* 背景は一番下 */
            background-image: var(--bg-img);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            opacity: var(--bg-img-opacity);
            filter: blur(var(--bg-img-blur)) saturate(var(--bg-img-sat));
            transform: scale(var(--bg-img-scale));
            pointer-events: none;
          }

          /* 端を淡くするマスク（可読性UP） */
          html.mono::after {
            content: "";
            position: fixed;
            inset: 0;
            z-index: -1;
            background:
              radial-gradient(120% 60% at 50% 0%, transparent 60%, color-mix(in oklab, var(--bg), transparent 85%)),
              linear-gradient(to bottom, color-mix(in oklab, var(--bg), transparent 85%), transparent 30%, transparent 70%, color-mix(in oklab, var(--bg), transparent 85%));
            pointer-events: none;
          }

          /* ===== 面（カード）だけ白で浮かせる ===== */
          .mono main > * {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 1rem;
            box-shadow: 0 1px 8px color-mix(in oklab, #7f5b4b, transparent 92%);
          }

          .mono main { padding: 16px; }
          @media (min-width: 768px) { .mono main { padding: 24px; } }
          @media (min-width: 1024px) { .mono main { padding: 32px; } }

          /* ===== 背景を潰すユーティリティの上書き（安全策） ===== */
          .mono [class*="bg-neutral-100"] { background-color: transparent !important; }
          .mono [class*="bg-gray-50"]      { background-color: color-mix(in oklab, var(--bg-warm), white 70%) !important; }
        `}</style>
      </body>
    </html>
  );
}
