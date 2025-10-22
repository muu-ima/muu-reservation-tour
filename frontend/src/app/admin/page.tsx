"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
 import ReservationTable from "../components/ReservationTable";
 import type { Reservation, Status, Program, Slot } from "@/types/reservation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  "https://muu-reservation-tour.onrender.com/api";
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? ""; // 開発用の簡易PIN

type AvailabilityMap = Record<string, boolean>; // {"YYYY-MM-DD": true|false}

const fmtDate = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

type Filters = {
  dateFrom: string;
  dateTo: string;
  program: Program | "all";
  slot: Slot | "all";
  status: Status | "all";
  hasCertificate: "all" | "yes" | "no";
  keyword: string;
};

// ===== ユーティリティ =====

// backend の古いレスポンスに name が含まれる場合の後方互換用
function legacyName(obj: unknown): string {
  if (typeof obj === "object" && obj !== null) {
    const maybe = (obj as Record<string, unknown>).name;
    return typeof maybe === "string" ? maybe : "";
  }
  return "";
}

// ===== 画面 =====
const INITIAL_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  program: "all",
  slot: "all",
  status: "all",
  hasCertificate: "all",
  keyword: "",
};

export default function AdminPage() {
  // --- very simple client guard (dev only) ---
  const [authed, setAuthed] = useState(false);
  const [pinInput, setPinInput] = useState("");
  // 他タブ/他ページへ「予約データが変わった」ことを知らせる
  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    bcRef.current = new BroadcastChannel("reservations");
    return () => bcRef.current?.close();
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("admin_ok") === "1"
    ) {
      setAuthed(true);
    }
  }, []);

  const onSubmitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADMIN_PIN) {
      alert("NEXT_PUBLIC_ADMIN_PIN が未設定です。開発時のみこのまま通します。");
      setAuthed(true);
      localStorage.setItem("admin_ok", "1");
      return;
    }
    if (pinInput === ADMIN_PIN) {
      setAuthed(true);
      localStorage.setItem("admin_ok", "1");
    } else {
      alert("PINが違います");
    }
  };

  // --- data / actions ---
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // component state 群の近くに追記
  const [availabilityMap, setAvailabilityMap] = useState<AvailabilityMap>({});
  const [selectedDate, setSelectedDate] = useState<string>(fmtDate(new Date()));

  const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
// 1) fetch 関数を useCallback で安定化
const fetchReservations = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch(`${API_BASE}/reservations`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`GET /reservations failed: ${res.status}`);
    const data = (await res.json()) as unknown as Reservation[];
    setItems(data);
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setLoading(false);
  }
}, []); // ←依存なし（API_BASE は外側 const で不変）

const fetchAvailability = useCallback(async () => {
  try {
    const res = await fetch(`${API_BASE}/availability`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return;
    const js = (await res.json()) as AvailabilityMap;
    setAvailabilityMap(js || {});
  } catch {}
}, []);


// 2) 認証後の初回ロード（既存のままでOK）
useEffect(() => {
  if (authed) {
    fetchReservations();
    fetchAvailability();
  }
}, [authed, fetchReservations, fetchAvailability]);

// 3) ★ 新規：ポーリング用 useEffect（初回ロードのすぐ下あたりに追加）
useEffect(() => {
  if (!authed) return;

  // 分境界に合わせて開始 → 以後 60s ごとに更新
  const align = 60_000 - (Date.now() % 60_000);
  let intervalId: number | undefined;

  const tick = () => {
    // 安定化した関数参照を呼ぶ
    fetchReservations();
    fetchAvailability();
  };

  const start = window.setTimeout(() => {
    tick(); // 開始時にも一回
    intervalId = window.setInterval(tick, 60_000);
  }, align);

  // タブ復帰・フォーカスで即時更新
  const onVisible = () => {
    if (!document.hidden) tick();
  };
  window.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);

  // BroadcastChannel 受信で即時更新（他タブ更新の反映）
  const bc = bcRef.current;
  const onBC = (ev: MessageEvent<{ type?: string }>) => {
    const t = ev.data?.type ?? "";
    if (t === "deleted" || t === "status") tick();
  };
  bc?.addEventListener("message", onBC);

  return () => {
    window.clearTimeout(start);
    if (intervalId) window.clearInterval(intervalId);
    window.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    bc?.removeEventListener("message", onBC);
  };
}, [authed, fetchReservations, fetchAvailability]);

  const updateAvailability = async (dateStr: string, open: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/availability/${dateStr}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ open }),
      });
      if (!res.ok) throw new Error("failed");
      // 楽観更新＋メッセージ
      setAvailabilityMap((m) => ({ ...m, [dateStr]: open }));
      setSuccess(`受付を ${open ? "ON" : "OFF"} にしました：${dateStr}`);
      // サーバ値で最終同期したければ↓を有効化
      // await fetchAvailability();
    } catch {
      setError("受付可否の更新に失敗しました");
    }
  };

  const updateStatus = async (id: number, status: Status) => {
    setError(null);
    setSuccess(null);
    // 公開側カレンダーへ「状態が変わった」ことを通知（cancelled 等で即座に表示から外れる）
    bcRef.current?.postMessage({ type: "status", id, status });
    try {
      const res = await fetch(`${API_BASE}/reservations/${id}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.message || `更新に失敗しました（${res.status}）`);
      }
      const updated: Reservation = await res.json();
      setItems((prev) => prev?.map((r) => (r.id === id ? updated : r)) ?? null);
      setSuccess("状態を更新しました");
    } catch (e: unknown) {
      setError(errMsg(e));
    }
  };

  const deleteReservation = async (id: number) => {
    if (!confirm("この予約を削除しますか？")) return;
    setError(null);
    setSuccess(null);
    // 公開側カレンダーへ「削除された」ことを通知
    bcRef.current?.postMessage({ type: "deleted", id });
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
      setSuccess("削除しました");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  };

  // --- filters ---
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const onChangeFilter = (patch: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const filteredItems = useMemo(() => {
    if (!items) return null;

    const from = filters.dateFrom; // "YYYY-MM-DD"
    const to = filters.dateTo;
    const kw = filters.keyword.trim().toLowerCase();

    return items.filter((r) => {
      const dateStr =
        typeof r.date === "string" ? r.date.slice(0, 10) : String(r.date);

      if (from && dateStr < from) return false;
      if (to && dateStr > to) return false;

      if (filters.program !== "all" && r.program !== filters.program)
        return false;
      if (filters.slot !== "all" && r.slot !== filters.slot) return false;

      if (filters.status !== "all") {
        const st = r.status ?? "booked";
        if (st !== filters.status) return false;
      }

      if (filters.hasCertificate !== "all") {
        const has = !!r.has_certificate;
        if (filters.hasCertificate === "yes" && !has) return false;
        if (filters.hasCertificate === "no" && has) return false;
      }

      if (kw) {
        const hay = [
          r.last_name ?? "",
          r.first_name ?? "",
          r.kana ?? "",
          r.email ?? "",
          r.phone ?? "",
          r.notebook_type ?? "",
          // バックエンドに name がある場合にもヒットさせる保険（any回避）
          legacyName(r),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }

      return true;
    });
  }, [items, filters]);

  if (!authed) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
        <form
          onSubmit={onSubmitPin}
          className="w-full max-w-sm rounded-2xl bg-white shadow p-6 space-y-4"
        >
          <h1 className="text-xl font-semibold">Admin Login</h1>
          <label className="block text-sm">
            PIN
            <input
              type="password"
              className="mt-1 w-full rounded-xl border p-2"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="開発用PIN"
            />
          </label>
          <button
            type="submit"
            className="w-full px-4 py-2 rounded-2xl bg-black text-white hover:opacity-90"
          >
            送信
          </button>
          <p className="text-xs text-gray-500">
            ※ 開発用の簡易ガードです。本番では認証方式へ置き換えてください。
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="mx-auto w-[90%] max-w-[1500px] space-y-4">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-semibold">
            Reservations Admin
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchReservations}
              className="px-4 py-2 rounded-2xl shadow bg-white hover:bg-gray-100 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "更新中…" : "更新"}
            </button>
          </div>
        </header>

        {/* --- Filter Bar --- */}
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <label className="text-xs text-gray-500">
              日付(開始)
              <input
                type="date"
                className="mt-1 w-full rounded-xl border p-2"
                value={filters.dateFrom}
                onChange={(e) => onChangeFilter({ dateFrom: e.target.value })}
              />
            </label>
            <label className="text-xs text-gray-500">
              日付(終了)
              <input
                type="date"
                className="mt-1 w-full rounded-xl border p-2"
                value={filters.dateTo}
                onChange={(e) => onChangeFilter({ dateTo: e.target.value })}
              />
            </label>
            <label className="text-xs text-gray-500">
              プログラム
              <select
                className="mt-1 w-full rounded-xl border p-2"
                value={filters.program}
                onChange={(e) =>
                  onChangeFilter({ program: e.target.value as Program | "all" })
                }
              >
                <option value="all">すべて</option>
                <option value="tour">tour</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">
              時間帯
              <select
                className="mt-1 w-full rounded-xl border p-2"
                value={filters.slot}
                onChange={(e) =>
                  onChangeFilter({ slot: e.target.value as Slot | "all" })
                }
              >
                <option value="all">すべて</option>
                <option value="am">am</option>
                <option value="pm">pm</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">
              ステータス
              <select
                className="mt-1 w-full rounded-xl border p-2"
                value={filters.status}
                onChange={(e) =>
                  onChangeFilter({ status: e.target.value as Status | "all" })
                }
              >
                <option value="all">すべて</option>
                <option value="booked">booked</option>
                <option value="canceled">canceled</option>
                <option value="done">done</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">
              受給者証
              <select
                className="mt-1 w-full rounded-xl border p-2"
                value={filters.hasCertificate}
                onChange={(e) =>
                  onChangeFilter({
                    hasCertificate: e.target.value as Filters["hasCertificate"],
                  })
                }
              >
                <option value="all">すべて</option>
                <option value="yes">あり</option>
                <option value="no">なし</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-col md:flex-row items-start md:items-center gap-3">
            <label className="w-full md:flex-1 text-xs text-gray-500">
              キーワード（姓・名・メール・電話・手帳・名前）
              <input
                type="text"
                className="mt-1 w-full rounded-xl border p-2"
                placeholder="例: 田中 / example@example.com / A123 など"
                value={filters.keyword}
                onChange={(e) => onChangeFilter({ keyword: e.target.value })}
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters(INITIAL_FILTERS)}
                className="px-3 py-2 rounded-xl border hover:bg-gray-50"
              >
                絞り込みをクリア
              </button>
              <span className="text-sm text-gray-500">
                該当 {filteredItems?.length ?? 0} 件 / 全 {items?.length ?? 0}{" "}
                件
              </span>
            </div>
          </div>
        </div>

        {(error || success) && (
          <div className="space-y-2">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {success}
              </div>
            )}
          </div>
        )}

        {/* 受付可否（管理） */}
        <div className="rounded-2xl bg-white shadow p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">受付可否（管理）</h2>
            <span className="text-xs text-gray-500">
              現在: {selectedDate || "—"} /{" "}
              {availabilityMap[selectedDate] ?? true
                ? "受付中(ON)"
                : "停止(OFF)"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-gray-500">
              対象日
              <input
                type="date"
                className="mt-1 w-full rounded-xl border p-2"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                onClick={() =>
                  selectedDate && updateAvailability(selectedDate, true)
                }
              >
                受付する（ON）
              </button>
              <button
                className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                onClick={() =>
                  selectedDate && updateAvailability(selectedDate, false)
                }
              >
                停止する（OFF）
              </button>
            </div>
            <div className="text-sm self-end text-gray-500">
              ※ 一般画面では <code>isBookable()</code>{" "}
              がこの状態を参照して「＋／停」を切替
            </div>
          </div>
        </div>

        <ReservationTable
          items={filteredItems}
          loading={loading}
          onUpdateStatus={updateStatus}
          onDelete={deleteReservation}
        />
      </div>
    </div>
  );
}
