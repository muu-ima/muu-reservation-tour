// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "予約管理システム",
  description: "Monotone UI with a single accent color",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="mono" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}

        {/* Server Component-safe global style */}
        <style id="mono-theme">{`
          /* ===== Palette (Light) ===== */
          .mono {
            --bg: #f8f9fa;
            --panel: #ffffff;
            --border: #e5e7eb;
            --text: #111827;
            --muted: #6b7280;
            --accent: #2563eb; /* 1色だけ使う場合はここを差し替え */
            --ok:#1f8b4c; --warn:#b45309; --danger:#b91c1c;
          }
          /* ===== Palette (Dark: OS設定に追従) ===== */
          @media (prefers-color-scheme: dark) {
            .mono {
              --bg:#0b0d10; --panel:#121418; --border:#262a30;
              --text:#e5e7eb; --muted:#9aa0a6;
            }
          }

          /* ===== Base ===== */
          .mono body { background: var(--bg); color: var(--text); color-scheme: light dark; }

          /* ===== 対象UIがTailwindの灰色/青を使っていても上書きで単色化 ===== */
          .mono [class*="bg-white"] { background-color: var(--panel) !important; }
          .mono [class*="bg-gray-50"] { background-color: color-mix(in oklab, var(--panel), black 2%) !important; }

          .mono [class*="text-gray-900"] { color: var(--text) !important; }
          .mono [class*="text-gray-7"], .mono [class*="text-gray-6"], .mono [class*="text-gray-5"] { color: var(--muted) !important; }

          .mono [class*="border-gray"], .mono [class~="border"] { border-color: var(--border) !important; }

          .mono [class*="ring-blue-500"] { --tw-ring-color: var(--accent) !important; }
          .mono [class*="text-blue-6"] { color: var(--accent) !important; }
          .mono [class*="bg-blue-6"] { background-color: var(--accent) !important; }

          /* ===== 変化が分かりやすくなる “最低限の見た目補強” ===== */
          /* main直下の子（一覧やカレンダーの大枠）をカード化 */
          .mono main > * {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 1rem;
            box-shadow: 0 1px 8px color-mix(in oklab, #000, transparent 92%);
          }

          /* 余白（画面端にべったりだと差が見えにくい） */
          .mono main { padding: 16px; }
          @media (min-width: 768px) { .mono main { padding: 24px; } }
          @media (min-width: 1024px) { .mono main { padding: 32px; } }

          /* フォーカス＆ホバー（単色でも操作感を出す） */
          .mono button, .mono a, .mono [role="button"] { outline-offset: 2px; }
          .mono button:focus-visible, .mono a:focus-visible, .mono [role="button"]:focus-visible {
            outline: 2px solid color-mix(in oklab, var(--accent), transparent 40%);
          }

          /* バッジ用（必要になったら className に badge-ok 等を足すだけ） */
          .mono .badge-ok     { background:color-mix(in oklab, var(--ok), transparent 90%); color:var(--ok);     border:1px solid color-mix(in oklab, var(--ok), transparent 80%); border-radius:.375rem; padding:.125rem .375rem; font-size:.75rem; }
          .mono .badge-warn   { background:color-mix(in oklab, var(--warn), transparent 90%); color:var(--warn);  border:1px solid color-mix(in oklab, var(--warn), transparent 80%); border-radius:.375rem; padding:.125rem .375rem; font-size:.75rem; }
          .mono .badge-danger { background:color-mix(in oklab, var(--danger), transparent 90%); color:var(--danger); border:1px solid color-mix(in oklab, var(--danger), transparent 80%); border-radius:.375rem; padding:.125rem .375rem; font-size:.75rem; }
        `}</style>
      </body>
    </html>
  );
}
