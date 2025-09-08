<?php

namespace App\Http\Controllers;

use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

class ReservationController extends Controller
{
    private int $jsonFlags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    /**
     * GET /api/reservations
     */
    public function index(Request $request)
    {
        // ひとまず全件返す（フロントで絞り込み）。必要になったらサーバー側フィルタを追加。
        $items = Reservation::query()
            ->orderBy('date')
            ->orderBy('start_at')
            ->get();

        return response()->json($items, 200, [], $this->jsonFlags);
    }

    /**
     * GET /api/reservations/{reservation}
     */
    public function show(Reservation $reservation)
    {
        return response()->json($reservation, 200, [], $this->jsonFlags);
    }

    /**
     * POST /api/reservations
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'date'    => ['required','date'],
            'program' => ['required', Rule::in(['tour','experience'])],
            'slot'    => ['required', Rule::in(['am','pm','full'])],
            'status'  => ['nullable', Rule::in(['booked','done','cancelled'])],
            'room'    => ['nullable','string','max:16'],

            // 氏名系（任意）
            'name'       => ['nullable','string','max:191'],
            'last_name'  => ['nullable','string','max:191'],
            'first_name' => ['nullable','string','max:191'],

            // 連絡先
            'email' => ['nullable','email','max:191'],
            'phone' => ['nullable','string','max:32'],

            // 任意メタ
            'contact'        => ['nullable','string','max:191'],
            'notebook_type'  => ['nullable','string','max:32'],
            'has_certificate'=> ['nullable','boolean'],
            'note'           => ['nullable','string','max:2000'],
        ]);

        // tour は full を禁止
        if (($data['program'] ?? null) === 'tour' && ($data['slot'] ?? null) === 'full') {
            return response()->json(['message' => 'tour は full を選べません'], Response::HTTP_UNPROCESSABLE_ENTITY, [], $this->jsonFlags);
        }

        // 既定値
        $data['status'] = $data['status'] ?? 'booked';
        $data['has_certificate'] = (bool)($data['has_certificate'] ?? false);

        // 氏名フォールバック（name が無ければ 姓+名 / それも無ければ 'ゲスト'）
        $data['name'] = $this->buildFallbackName($data);

        // JST日付+slot → UTCの start/end を自動算出
        [$startAt, $endAt] = $this->calcWindow($data['date'], $data['slot']);
        $data['start_at'] = $startAt;
        $data['end_at']   = $endAt;

        // ★ 同一 program 限定の時間帯重複を禁止（cancelled は無視）
        $this->assertNoProgramOverlap($data);

        $created = Reservation::create($data);
        return response()->json($created, 201, [], $this->jsonFlags);
    }

    /**
     * PATCH /api/reservations/{reservation}
     */
    public function update(Request $request, Reservation $reservation)
    {
        $data = $request->validate([
            'date'    => ['sometimes','date'],
            'program' => ['sometimes', Rule::in(['tour','experience'])],
            'slot'    => ['sometimes', Rule::in(['am','pm','full'])],
            'status'  => ['sometimes', Rule::in(['booked','done','cancelled'])],
            'room'    => ['sometimes','nullable','string','max:16'],

            'name'       => ['sometimes','nullable','string','max:191'],
            'last_name'  => ['sometimes','nullable','string','max:191'],
            'first_name' => ['sometimes','nullable','string','max:191'],

            'email' => ['sometimes','nullable','email','max:191'],
            'phone' => ['sometimes','nullable','string','max:32'],

            'contact'        => ['sometimes','nullable','string','max:191'],
            'notebook_type'  => ['sometimes','nullable','string','max:32'],
            'has_certificate'=> ['sometimes','nullable','boolean'],
            'note'           => ['sometimes','nullable','string','max:2000'],
        ]);

        // マージ後の値を確定
        $merged = array_merge($reservation->toArray(), $data);

        // tour は full を禁止
        if (($merged['program'] ?? 'tour') === 'tour' && ($merged['slot'] ?? 'am') === 'full') {
            return response()->json(['message' => 'tour は full を選べません'], Response::HTTP_UNPROCESSABLE_ENTITY, [], $this->jsonFlags);
        }

        // has_certificate の安全化
        if (array_key_exists('has_certificate', $data)) {
            $merged['has_certificate'] = (bool)$data['has_certificate'];
        }

        // name フォールバック（明示的に name が空にされた場合も拾う）
        if (!array_key_exists('name', $data) || $data['name'] === null || $data['name'] === '') {
            $merged['name'] = $this->buildFallbackName($merged);
        }

        // date/slot 更新時は start/end 再計算（未指定なら現状維持）
        $date = $merged['date'] ?? $reservation->date?->toDateString();
        $slot = $merged['slot'] ?? $reservation->slot;
        [$startAt, $endAt] = $this->calcWindow($date, $slot);
        $merged['start_at'] = $startAt;
        $merged['end_at']   = $endAt;

        // ★ 同一 program 限定の重複判定（自分は除外）
        $this->assertNoProgramOverlap($merged, $reservation->id);

        $reservation->fill($merged)->save();

        // 最新のモデルを返却
        $reservation->refresh();
        return response()->json($reservation, 200, [], $this->jsonFlags);
    }

    /**
     * DELETE /api/reservations/{reservation}
     */
    public function destroy(Reservation $reservation)
    {
        $reservation->delete();
        return response()->noContent(); // 204
    }

    /**
     * JST "YYYY-MM-DD" + slot → UTC start/end を返す
     * am: 10:00-12:00, pm: 13:00-15:00, full: 10:00-15:00 （必要に応じて調整）
     *
     * @return array{0: \Illuminate\Support\Carbon, 1: \Illuminate\Support\Carbon}
     */
    private function calcWindow(string $dateYmd, string $slot): array
    {
        $ranges = [
            'am'   => ['10:00:00', '12:00:00'],
            'pm'   => ['13:00:00', '15:00:00'],
            'full' => ['10:00:00', '15:00:00'],
        ];
        [$startHHMMSS, $endHHMMSS] = $ranges[$slot] ?? $ranges['am'];

        $startJst = Carbon::parse("{$dateYmd} {$startHHMMSS}", 'Asia/Tokyo');
        $endJst   = Carbon::parse("{$dateYmd} {$endHHMMSS}", 'Asia/Tokyo');

        return [$startJst->clone()->utc(), $endJst->clone()->utc()];
        // DB カラムが timestamp(UTC) 前提。アプリ側の casts もあわせておくこと。
    }

    /**
     * 同一 program 内の [start_at, end_at) 重複を禁止（cancelled は無視）
     *
     * @param array $data  少なくとも program, start_at, end_at, status を含む
     * @param int|null $ignoreId  自分自身を除外したいとき（更新時）
     */
    private function assertNoProgramOverlap(array $data, ?int $ignoreId = null): void
    {
        $q = Reservation::query()
            ->where('program', $data['program'])
            ->whereNotIn('status', ['cancelled'])
            // A.start < B.end && A.end > B.start で交差判定
            ->where('start_at', '<', $data['end_at'])
            ->where('end_at', '>', $data['start_at']);

        if ($ignoreId) {
            $q->where('id', '<>', $ignoreId);
        }

        if ($q->exists()) {
            abort(Response::HTTP_CONFLICT, '同一プログラム内で時間帯が重複しています。');
        }
    }

    /**
     * name が空の場合、姓+名 -> ゲスト の順でフォールバック
     */
    private function buildFallbackName(array $in): string
    {
        $name = trim((string)($in['name'] ?? ''));
        if ($name !== '') return $name;

        $ln = trim((string)($in['last_name'] ?? ''));
        $fn = trim((string)($in['first_name'] ?? ''));
        if ($ln !== '' || $fn !== '') {
            return $ln . $fn; // 和名連結（半角スペースを入れたい場合は "{$ln} {$fn}" に）
        }

        return 'ゲスト';
    }
}