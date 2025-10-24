"use client";
import CalendarPanel from "@/app/components/CalendarPanel";

export default function CalendarPage() {
  return (
    <main className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="mx-auto w-full md:w-[90%] md:max-w-[1500px] px-2 md:px-0 space-y-6">
        <h1 className="text-2xl font-bold mb-6">カレンダーから予約を選択</h1>
        <div className="rounded-2xl bg-white shadow p-4">
          <CalendarPanel />
        </div>
      </div>
    </main>
  );
}
