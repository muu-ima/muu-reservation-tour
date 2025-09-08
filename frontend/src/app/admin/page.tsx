"use client";

import React, { useEffect, useMemo, useState } from "react";
import ReservationTable, {
    Reservation,
    Status,
    Program,
    Slot,
} from "../components/ReservationTable";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? ""; // 開発用の簡易PIN

type Filters = {
    dateFrom: string;
    dateTo: string;
    program: Program | "all";
    slot: Slot | "all";
    status: Status | "all";
    hasCertificate: "all" | "yes" | "no";
    keyword: string;
};

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

    useEffect(() => {
        if (typeof window !== "undefined" && localStorage.getItem("admin_ok") === "1") {
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

    const fetchReservations = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/reservations`, {
                headers: { Accept: "application/json" },
                cache: "no-store",
            });
            if (!res.ok) throw new Error(`GET /reservations failed: ${res.status}`);
            const data: Reservation[] = await res.json();
            setItems(data);
        } catch (e: any) {
            setError(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authed) fetchReservations();
    }, [authed]);

    const updateStatus = async (id: number, status: Status) => {
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch(`${API_BASE}/reservations/${id}`, {
                method: "PATCH",
                headers: { Accept: "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) {
                const js = await res.json().catch(() => ({}));
                throw new Error(js.message || `更新に失敗しました（${res.status}）`);
            }
            const updated: Reservation = await res.json();
            setItems((prev) => prev?.map((r) => (r.id === id ? updated : r)) ?? null);
            setSuccess("状態を更新しました");
        } catch (e: any) {
            setError(e?.message ?? String(e));
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
            setSuccess("削除しました");
        } catch (e: any) {
            setError(e?.message ?? String(e));
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

            if (filters.program !== "all" && r.program !== filters.program) return false;
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
                    r.email ?? "",
                    r.phone ?? "",
                    r.notebook_type ?? "",
                    // バックエンドに name がある場合にもヒットさせる保険
                    (r as any).name ?? "",
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
            <div className="mx-auto max-w-7xl space-y-4">
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
                                <option value="experience">experience</option>
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
                                <option value="full">full</option>
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
                                <option value="cancelled">cancelled</option>
                                <option value="done">done</option>
                            </select>
                        </label>
                        <label className="text-xs text-gray-500">
                            受給者証
                            <select
                                className="mt-1 w-full rounded-xl border p-2"
                                value={filters.hasCertificate}
                                onChange={(e) =>
                                    onChangeFilter({ hasCertificate: e.target.value as Filters["hasCertificate"] })
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
                                該当 {filteredItems?.length ?? 0} 件 / 全 {items?.length ?? 0} 件
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
