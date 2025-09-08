"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  Reservation,
  Program,
  Slot,
  Status,
  ReservationFilterUI,
  ReservationCreatePayload,
} from "@/types/reservation";
import { isProgram, isSlot, getErrorMessage } from "@/types/reservation";
import CreateReservationModal from "@/components/CreateReservationModal";
import { motion, AnimatePresence } from "framer-motion"

// ============================================
// Next.js (App Router) page.tsx — api.phpに合わせた同期版 + カレンダー表示 + モーダル新規作成
// ============================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

// ========= 日付ユーティリティ =========
const toDateStr = (d: string | Date) => {
  if (typeof d === "string") return d.slice(0, 10);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// === 休業日（週末）ユーティリティ ===
function dayOfWeekFromStr(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=日,6=土
}
function isWeekendStr(s: string): boolean {
  const dow = dayOfWeekFromStr(s);
  return dow === 0 || dow === 6;
}
function nextBusinessDay(from: Date = new Date()): string {
  const dt = new Date(from);
  while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
  return toDateStr(dt);
}
function nextBusinessDayFromStr(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return nextBusinessDay(new Date(y, m - 1, d));
}

// === 月セル生成 ===
function buildMonthCells(cursor: Date, mondayStart = true) {
  const y = cursor.getFullYear?.() ?? cursor.getFullYear();
  const m = cursor.getMonth(); // 0-11
  const first = new Date(y, m, 1);
  const firstDow = first.getDay(); // 0=Sun
  const startOffset = (firstDow - (mondayStart ? 1 : 0) + 7) % 7; // 月起点
  const gridStart = new Date(y, m, 1 - startOffset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return {
      dateStr: toDateStr(d),
      inMonth: d.getMonth() === m,
      y: d.getFullYear(),
      m: d.getMonth(),
      day: d.getDate(),
    };
  });
  return cells;
}

function formatMonthJP(d: Date) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

// === 共通タイプ（reduce 用） ===
type SlotCounts = Record<Slot, number>;

export default function Page() {
  // ===== State
  const [items, setItems] = useState<Reservation[] | null>(null);          // 絞り込み一覧用
  const [allItems, setAllItems] = useState<Reservation[] | null>(null);    // カレンダー用（全体）
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 絞り込み（一覧用）
  const [filter, setFilter] = useState<ReservationFilterUI>(() => ({
    date: "",
    program: "",
    slot: "",
  }));

  // カレンダー: 表示中の月（1日固定）
  const [calCursor, setCalCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const monthCells = useMemo(() => buildMonthCells(calCursor, true), [calCursor]);
  const monthKey = useMemo(() => toDateStr(calCursor).slice(0, 7), [calCursor]); // YYYY-MM
  // カレンダーの表示対象（体験/見学）
  const [calProgram, setCalProgram] = useState<Program>("experience");

  // 予約作成モーダル
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>(undefined);
  const [createSlot, setCreateSlot] = useState<Slot | undefined>(undefined);

  function openCreate(dateStr?: string, slot?: Slot) {
    // デフォは「次の平日」。土日が渡ってきた場合も平日に補正。
    const init = dateStr ?? nextBusinessDay();
    const safe = isWeekendStr(init) ? nextBusinessDayFromStr(init) : init;
    setCreateDate(safe);
    setCreateSlot(slot);
    setIsCreateOpen(true);
  }

  // ===== Helpers
  const jstDateTime = (iso?: string) => {
    if (!iso) return "-";
    try {
      const dtf = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        dateStyle: "medium",
        timeStyle: "short",
      });
      return dtf.format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (filter.date) params.set("date", filter.date);
    if (filter.program) params.set("program", filter.program);
    if (filter.slot) params.set("slot", filter.slot);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  // ===== API calls
  const fetchReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/reservations${buildQuery()}` as string, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`GET /reservations failed: ${res.status}`);
      const data: Reservation[] = await res.json();
      setItems(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // カレンダー用（全件 or サーバ側で最近分を返す想定）
  const fetchAllReservations = async () => {
    try {
      const res = await fetch(`${API_BASE}/reservations`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`GET /reservations failed: ${res.status}`);
      const data: Reservation[] = await res.json();
      setAllItems(data);
    } catch (e: unknown) {
      console.warn("fetchAllReservations:", getErrorMessage(e));
    }
  };

  // 初回ロード
  useEffect(() => {
    fetchReservations();
    fetchAllReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // カレンダー: 月が変わるたび再フェッチ
  useEffect(() => {
    fetchAllReservations();
  }, [monthKey]);

  // filter 変更で一覧を再取得
  useEffect(() => {
    fetchReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.date, filter.program, filter.slot]);

  // ====== 新規作成（モーダルから呼ぶ）
  const createReservation = async (payload: ReservationCreatePayload) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      if (!payload.date) throw new Error("日付を入力してください");

      const composedName =
        (payload.name && payload.name.trim()) ||
        `${payload.last_name ?? ""}${payload.first_name ? ` ${payload.first_name}` : ""}`.trim() ||
        "ゲスト";

      const body = { ...payload, name: composedName };

      const res = await fetch(`${API_BASE}/reservations`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.message || "その時間帯は埋まっています");
      }
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.message || `予約の作成に失敗しました（${res.status}）`);
      }

      const created: Reservation = await res.json();
      setSuccess("予約を作成しました");
      setItems((prev) => (prev ? [created, ...prev] : [created]));
      setAllItems((prev) => (prev ? [created, ...prev] : [created]));
      setFilter((f) => ({ ...f, date: toDateStr(created.date ?? payload.date) }));
      setIsCreateOpen(false);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: number, status: Status) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/reservations/${id}`, {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.status === 409) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.message || "その時間帯は埋まっています");
      }
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.message || `更新に失敗しました（${res.status}）`);
      }
      const updated: Reservation = await res.json();
      setItems((prev) => prev?.map((r) => (r.id === id ? updated : r)) ?? null);
      setAllItems((prev) => prev?.map((r) => (r.id === id ? updated : r)) ?? null);
      setSuccess("状態を更新しました");
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  };

  const deleteReservation = async (id: number) => {
    if (!confirm("この予約を削除しますか？")) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/reservations/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.message || `削除に失敗しました（${res.status}）`);
      }
      setItems((prev) => prev?.filter((r) => r.id !== id) ?? null);
      setAllItems((prev) => prev?.filter((r) => r.id !== id) ?? null);
      setSuccess("削除しました");
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  };

  // ===== カレンダー用: 当月の予約を日付ごとに集計（体験/見学の切替反映）
  const dayMap = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    (allItems ?? []).forEach((r) => {
      if (r.program !== calProgram) return;
      const ds = toDateStr(r.date);
      if (ds.startsWith(monthKey)) {
        (map[ds] ||= []).push(r);
      }
    });
    return map;
  }, [allItems, monthKey, calProgram]);

  // ===== UI
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-semibold">Reservations Admin</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchReservations}
              className="px-4 py-2 rounded-2xl shadow bg-white hover:bg-gray-100 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "更新中…" : "更新"}
            </button>
            <button
              onClick={() => openCreate()}
              className="px-4 py-2 rounded-2xl shadow bg-black text-white hover:opacity-90"
            >
              ＋ 新規予約
            </button>
          </div>
        </header>

        {(error || success) && (
          <div className="space-y-2">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            {success && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>
            )}
          </div>
        )}

        {/* ===== カレンダー表示 ===== */}
        <section className="rounded-2xl bg-white shadow p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                onClick={() => setCalCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                aria-label="前の月"
              >
                ←
              </button>
              <span className="min-w-[10ch] text-center text-sm text-gray-700">{formatMonthJP(calCursor)}</span>
              <button
                className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                onClick={() => setCalCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                aria-label="次の月"
              >
                →
              </button>
              <button
                className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                onClick={() => {
                  const t = new Date();
                  t.setDate(1);
                  setCalCursor(t);
                }}
              >
                今月
              </button>
              {/* 体験 / 見学 タブ（アニメ付き） */}
              <div className="ml-2">
                <div className="relative inline-flex p-1 rounded-2xl bg-gray-100">
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={calProgram}
                      layoutId="program-pill"
                      className="absolute top-1 bottom-1 rounded-xl bg-white shadow"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.6 }}
                      style={{
                        left: calProgram === "experience" ? 4 : 64, // 64px ≒ ボタン幅に合わせて調整
                        right: calProgram === "experience" ? 64 : 4,
                      }}
                    />
                  </AnimatePresence>

                  {(["experience", "tour"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCalProgram(p)}
                      aria-pressed={calProgram === p}
                      className={[
                        "relative z-10 px-4 py-1.5 text-sm rounded-xl transition",
                        calProgram === p ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
                      ].join(" ")}
                    >
                      {p === "experience" ? "体験" : "見学"}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* 曜日ヘッダー — PC/タブレットのみ */}
          <div className="hidden md:grid grid-cols-7 text-xs text-gray-500">
            {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
              <div key={w} className="p-2 text-center font-medium">{w}</div>
            ))}
          </div>

          {/* 月グリッド — PC/タブレットのみ */}
          <AnimatePresence mode="wait">
            <motion.div
              key={formatMonthJP(calCursor) + "_" + calProgram}
              className="hidden md:grid grid-cols-7 gap-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {monthCells.map((cell, i) => {
                const dayItems = dayMap[cell.dateStr] ?? [];
                const counts = dayItems.reduce<SlotCounts>(
                  (acc, r) => ({ ...acc, [r.slot]: (acc[r.slot] ?? 0) + 1 }),
                  { am: 0, pm: 0, full: 0 }
                );
                const total = dayItems.length;
                const isToday = cell.dateStr === toDateStr(new Date());
                const isWeekendCell = isWeekendStr(cell.dateStr);

                const handleTap = () => {
                  if (!isWeekendCell) {
                    // 直接「新規作成モーダル」を開く（これが“タップで予約”）
                    openCreate(cell.dateStr);
                  } else {
                    // 休業日は一覧へ（好みで変えてOK）
                    setFilter((f) => ({ ...f, date: cell.dateStr, program: calProgram }));
                  }
                };

                return (
                  <motion.button
                    key={cell.dateStr}
                    type="button"
                    onClick={handleTap}
                    className={[
                      "relative h-24 rounded-xl border p-2 text-left transition",
                      cell.inMonth ? "bg-white" : "bg-gray-50",
                      isToday ? "ring-2 ring-blue-500" : "hover:shadow-sm"
                    ].join(" ")}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(i * 0.0025, 0.12) }}
                    title={`${cell.dateStr}の操作`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={"text-sm " + (cell.inMonth ? "text-gray-900" : "text-gray-400")}>
                        {cell.day}
                      </span>
                      {total > 0 && (
                        <span className="text-[11px] rounded-full px-2 py-0.5 border bg-gray-50">{total}</span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {counts.full > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md border">FULL×{counts.full}</span>}
                      {counts.am > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md border">AM×{counts.am}</span>}
                      {counts.pm > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md border">PM×{counts.pm}</span>}
                    </div>

                    {dayItems[0] && (
                      <div className="mt-1 text-[11px] text-gray-500 truncate" aria-hidden>
                        {(dayItems[0].last_name ?? "") + (dayItems[0].first_name ? ` ${dayItems[0].first_name}` : "")}
                        {dayItems.length > 1 ? ` 他${dayItems.length - 1}件` : ""}
                      </div>
                    )}

                    {/* 右下の“＋/休”は見た目のヒントに留める */}
                    {!isWeekendCell ? (
                      <span
                        className="pointer-events-none absolute right-1 bottom-1 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs bg-white"
                        aria-hidden
                      >＋</span>
                    ) : (
                      <span
                        className="pointer-events-none absolute right-1 bottom-1 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs text-gray-400 bg-gray-50"
                        aria-hidden
                      >休</span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>


          {/* ▼ モバイル用アジェンダ表示（スマホのみ） */}
          <div className="md:hidden -mx-2">
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden bg-white">
              {monthCells.map((cell) => {
                const dayItems = dayMap[cell.dateStr] ?? [];
                const counts = dayItems.reduce<SlotCounts>(
                  (acc, r) => ({ ...acc, [r.slot]: (acc[r.slot] ?? 0) + 1 }),
                  { am: 0, pm: 0, full: 0 }
                );
                const total = dayItems.length;
                const isToday = cell.dateStr === toDateStr(new Date());
                const isWeekendCell = isWeekendStr(cell.dateStr);
                const dow = new Date(cell.dateStr).getDay();
                const w = ["日", "月", "火", "水", "木", "金", "土"][dow];

                return (
                  <li key={cell.dateStr}>
                    <motion.div
                      className="flex items-center gap-3 px-3 py-2 active:bg-gray-50"
                      onClick={() =>
                        setFilter((f) => ({ ...f, date: cell.dateStr, program: calProgram }))
                      }
                      role="button"
                      tabIndex={0}
                      title={`${cell.dateStr}の予約を一覧で表示`}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
                      transition={{ duration: 0.18 }}
                    >
                      {/* 日付バッジ */}
                      <div className={"w-14 shrink-0 text-center"}>
                        <div className={"text-base leading-5 " + (isToday ? "font-semibold text-blue-600" : "text-gray-900")}>
                          {cell.day}
                        </div>
                        <div className={"text-[10px] " + (isWeekendCell ? "text-red-500" : "text-gray-500")}>{w}</div>
                      </div>

                      {/* 件数 / 先頭氏名 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {total > 0 && (
                            <span className="text-[11px] rounded-full px-2 py-0.5 border bg-gray-50">{total}件</span>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {counts.full > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md border">FULL×{counts.full}</span>}
                            {counts.am > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md border">AM×{counts.am}</span>}
                            {counts.pm > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md border">PM×{counts.pm}</span>}
                          </div>
                        </div>
                        {dayItems[0] && (
                          <div className="mt-0.5 text-[11px] text-gray-500 truncate" aria-hidden>
                            {(dayItems[0].last_name ?? "") + (dayItems[0].first_name ? ` ${dayItems[0].first_name}` : "")}
                            {dayItems.length > 1 ? ` 他${dayItems.length - 1}件` : ""}
                          </div>
                        )}
                      </div>

                      {/* 右端：＋ / 休 */}
                      {!isWeekendCell ? (
                        <button
                          type="button"
                          className="h-8 w-8 shrink-0 rounded-full border text-base leading-8 text-center bg-white hover:bg-gray-50"
                          onClick={(e) => { e.stopPropagation(); openCreate(cell.dateStr); }}
                          aria-label={`${cell.dateStr} に予約を追加`}
                          title="この日に予約を追加"
                        >＋</button>
                      ) : (
                        <div
                          className="h-8 w-8 shrink-0 rounded-full border text-xs leading-8 text-center text-gray-400 bg-gray-50"
                          aria-disabled="true"
                          title="土日は休業日のため新規は作成できません"
                        >休</div>
                      )}
                    </motion.div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-xs text-gray-500">日付タップで一覧に反映。右端「＋」でその日に新規作成。</p>
        </section>

        {/* ===== 検索/絞り込み（一覧） ===== */}
        {/* ここに一覧テーブルなどを置く想定（省略） */}

        <footer className="text-xs text-gray-500 pt-4">API: <code>{API_BASE}</code></footer>
      </div>

      {/* 予約作成モーダル */}
      <CreateReservationModal
        open={isCreateOpen}
        initialDate={createDate}
        initialSlot={createSlot}
        // initialProgram={calProgram} // ← モーダルが対応済みなら有効化
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createReservation}
      />
    </div>
  );
}
