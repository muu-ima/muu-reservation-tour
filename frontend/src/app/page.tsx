import HubCardsClient from "@/app/reserve/HubCardsClient";

// ...（getNextOpenSlot / isLockedBy25Rule などは今のまま）

// getNextOpenSlot を page.tsx の上の方に追加
async function getNextOpenSlot(program: string = "tour") {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://muu-reservation-tour.onrender.com/api";

  try {
    const res = await fetch(`${API_BASE}/v2/availabilities/next?program=${encodeURIComponent(program)}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data?.date && data?.slot) {
        return { date: data.date, slot: data.slot, program: program };
      }
    }
  } catch {
    /* noop */
  }
  return null;
}


export default async function Page() {
  const nextOpen = await getNextOpenSlot("tour");

  const quickHref = nextOpen
    ? `/?prefill=${nextOpen.date}&slot=${nextOpen.slot}&program=${encodeURIComponent(nextOpen.program)}`
    : undefined;

  const nextOpenLabel = nextOpen
    ? new Date(nextOpen.date + "T00:00:00").toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })
    : null;

  return (
    <div className="min-h-[calc(100dvh)] bg-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">予約をはじめる</h1>
          <p className="mt-2 text-sm text-neutral-600">最短で予約するか、カレンダーから選ぶかをお選びください。</p>
        </div>

        <HubCardsClient
          quickHref={quickHref}
          nextOpenLabel={nextOpenLabel}
          calendarHref="/"
        />

        <div className="mt-8 text-xs text-neutral-500">
          <ul className="list-disc pl-5 space-y-1">
            <li>当月25日までは翌月の予約は非公開（フロントでもロック）。</li>
            <li>最短予約は <code>program</code> をクエリで渡せます（例: <code>?program=tour</code>）。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
