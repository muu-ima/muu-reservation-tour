import HubCardsClient from "@/app/reserve/HubCardsClient";

type Slot = "am" | "pm";
type NextOpen = { date: string; slot: Slot; program: string };
// ...（getNextOpenSlot / isLockedBy25Rule などは今のまま）

// 最短候補をサーバー側で取得（/v2/availabilities/next）
async function getNextOpenSlot(
  program: string = "tour"
): Promise<NextOpen | null> {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE ??
    "https://muu-reservation-tour.onrender.com/api";

  try {
    const res = await fetch(
      `${API_BASE}/v2/availabilities/next?program=${encodeURIComponent(
        program
      )}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      date?: string;
      slot?: Slot;
      program?: string;
    };
    if (data?.date && data?.slot) {
      return { date: data.date, slot: data.slot, program: program ?? program };
    }
  } catch {
    /* noop */
  }
  return null;
}

export default async function Page() {
  const program = "tour";
  const nextOpen = await getNextOpenSlot(program);

  const calendarHref = "/calendar";
  const quickHref = nextOpen
    ? `${calendarHref}?prefill=${nextOpen.date}&slot=${
        nextOpen.slot
      }&program=${encodeURIComponent(nextOpen.program)}`
    : undefined;

  const nextOpenLabel = nextOpen
    ? new Date(`${nextOpen.date}T00:00:00`).toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : null;

  return (
    <div className="min-h-[calc(100dvh)] bg-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-[1.9rem] md:text-[2.4rem] font-medium tracking-[-0.015em] leading-[1.25] text-neutral-800">
            見学のご予約について
          </h1>

          <p className="mt-4 text-[0.95rem] text-neutral-700 leading-relaxed tracking-[0.01em]">
            見学のご予約は、2つの方法からお選びいただけます。
            <br />
            <span className="inline-block mt-2">
              「最短の開け日で予約」では、いちばん早くご案内できる日を
              自動でお知らせします。
            </span>
            <br />
            <span className="inline-block mt-1">
              「カレンダーから選ぶ」では、ご希望の日にちを見ながら、
              ゆっくりお選びいただけます。
            </span>
          </p>
        </div>

        {/* カードUI（クライアント側の動きは HubCardsClient に委譲） */}
        <HubCardsClient
          quickHref={quickHref} // 左：最短で予約
          nextOpenLabel={nextOpenLabel} // 左の補足表示（例: 10月31日(金)）
          calendarHref={calendarHref} // 右：カレンダーへ
        />
      </div>
    </div>
  );
}
