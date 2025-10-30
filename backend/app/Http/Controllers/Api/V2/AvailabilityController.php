<?php

namespace App\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Models\AvailabilityOverride;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

class AvailabilityController extends Controller
{
    /**
     * GET /api/v2/availabilities/next?program=tour&debug=1&allowNextMonth=1
     */
    public function next(Request $request)
    {
        $debug     = (bool) $request->query('debug', false);
        $allowNext = (bool) $request->query('allowNextMonth', false);
        $program   = (string) $request->query('program', 'tour');

        // 25日ルール（JST）
        $nowJst         = Carbon::now('Asia/Tokyo');
        $lockNextMonth  = $nowJst->day <= 25;
        $nextMonthStart = $nowJst->copy()->addMonthNoOverflow()->startOfMonth();

        $days = $this->buildCompactDays($program, $nowJst->toDateString());

        // デバッグ理由の蓄積
        $reasons = [];

        foreach ($days as $d) {
            $date = Arr::get($d, 'date');
            if (!$date) {
                if ($debug) $reasons[] = ['date' => null, 'reason' => 'no-date'];
                continue;
            }

            // 25日ルール（allowNextMonth=1なら解除）
            if (
                $lockNextMonth && !$allowNext &&
                Carbon::parse($date, 'Asia/Tokyo')->greaterThanOrEqualTo($nextMonthStart)
            ) {
                if ($debug) $reasons[] = ['date' => $date, 'reason' => 'locked-next-month'];
                continue; // 跨ぐ
            }

            // === 状態取得（表現ゆれ吸収） ===
            $am = Arr::get($d, 'am');
            $pm = Arr::get($d, 'pm');
            $flags = (array) Arr::get($d, 'flags', []);

            $hasAMOpen = ($am === true || $am === 'open')
                || in_array('am', (array) Arr::get($d, 'slots', []), true)
                || in_array('am', (array) Arr::get($d, 'available', []), true);

            $hasPMOpen = ($pm === true || $pm === 'open')
                || in_array('pm', (array) Arr::get($d, 'slots', []), true)
                || in_array('pm', (array) Arr::get($d, 'available', []), true);

            // === 跨ぐべき条件（全部スキップ） ===
            $isClosedDay = Arr::get($d, 'closed') === true || $am === 'closed' || $pm === 'closed';
            $isStopped   = $am === 'stopped' || $pm === 'stopped'
                || Arr::get($d, 'stopped') === true || Arr::get($d, 'stop') === true
                || in_array('stopped', $flags, true);

            $isPending   = $am === 'pending' || $pm === 'pending'
                || in_array('pending', $flags, true)
                || Arr::get($d, 'amStatus') === 'pending' || Arr::get($d, 'pmStatus') === 'pending';

            $isBooked    = $am === 'booked' || $pm === 'booked'
                || in_array('am_booked', $flags, true) || in_array('pm_booked', $flags, true)
                || Arr::get($d, 'amStatus') === 'booked' || Arr::get($d, 'pmStatus') === 'booked';

            if ($isClosedDay) {
                if ($debug) $reasons[] = ['date' => $date, 'reason' => 'closed-skip'];
                continue;
            }
            if ($isStopped) {
                if ($debug) $reasons[] = ['date' => $date, 'reason' => 'stopped-skip'];
                continue;
            }
            if ($isPending) {
                if ($debug) $reasons[] = ['date' => $date, 'reason' => 'pending-skip'];
                continue;
            }
            if ($isBooked) {
                if ($debug) $reasons[] = ['date' => $date, 'reason' => 'booked-skip'];
                continue; // ← ここを break ではなく continue に
            }

            // === 採用条件：両方 open の日だけ ===
            if ($hasAMOpen && $hasPMOpen) {
                return response()->json([
                    'date'    => $date,
                    'slot'    => 'am',   // 既定は am（必要なら pm でも可）
                    'program' => $program,
                ]);
            }

            if ($debug) $reasons[] = ['date' => $date, 'reason' => 'not-both-open'];
        }


        // ← ここで next() をきちんと閉じるのが超重要！
        return response()->json([
            'error'  => 'No available slots found',
            'reason' => ($lockNextMonth && !$allowNext) ? 'maybe-locked-or-no-slot' : 'no-slot',
            'sample' => array_slice($days, 0, 7),
            'skips'  => $debug ? $reasons : [],
        ], 404);
    } // ← このカッコを忘れていると「Unexpected 'private'」になります

    /**
     * compact 相当の配列を生成（最短用の軽量版）
     * 返却要素例:
     *  ['date'=>'YYYY-MM-DD','am'=>true,'pm'=>false,'closed'=>false]
     */
    private function buildCompactDays(string $program, string $fromDate): array
    {
        $days = [];
        $span = 60;

        $todayJst = \Illuminate\Support\Carbon::now('Asia/Tokyo')->toDateString();
        // overrideMap を定義する
        $overrideMap = AvailabilityOverride::query()
            ->whereDate('date', '>=', $fromDate)
            ->pluck('open', 'date');

        // slot の大小文字ゆれ吸収
        $rows = DB::table('reservations')
            ->selectRaw("date, LOWER(slot) as slot, COUNT(*) as c")
            ->where('program', $program)
            ->whereDate('date', '>=', $fromDate)
            ->whereIn('status', ['booked', 'pending']) // 実DBに合わせて調整
            ->groupBy('date', DB::raw('LOWER(slot)'))
            ->get()
            ->groupBy('date');

        // 🔴 追加：その日に Pending が1件でもあるか（=その日は丸ごと不可）
        $pendingDates = DB::table('reservations')
            ->selectRaw('date, COUNT(*) as c')
            ->where('program', $program)
            ->whereDate('date', '>=', $fromDate)
            ->where('status', 'pending')
            ->groupBy('date')
            ->pluck('c', 'date'); // ['2025-10-24' => 1, ...]

        $holidaySet = collect([
            // 'YYYY-MM-DD',
            '2025-10-26',
            // 以降、必要に応じて追加
        ])->flip(); // ->has($d) で判定できるようにキー化


        for ($i = 0; $i <= $span; $i++) {
            $d = Carbon::parse($fromDate, 'Asia/Tokyo')->addDays($i)->toDateString();

            // デフォは営業日扱い（必要なら土日クローズ等をここに）
            $closed = $this->isClosedPolicy($d, $overrideMap, leadDays: 1);

            // ① 当日は停止（当日予約NGポリシー）
            if ($d === $todayJst) {
                $closed = true;
            }

            // ② 手動オーバーライド（open=false は休業）
            if ($overrideMap->has($d) && $overrideMap[$d] === false) {
                $closed = true;
            }

            // 🔴 Pending が1件でもあれば、その日は「全枠埋まり」扱い
            $wholeDayBusyByPending = (int) ($pendingDates[$d] ?? 0) > 0;

            $byDate = $rows->get($d, collect());
            // ここを OR にする
            $amBusy = $wholeDayBusyByPending || (int)($byDate->firstWhere('slot', 'am')->c ?? 0) > 0;
            $pmBusy = $wholeDayBusyByPending || (int)($byDate->firstWhere('slot', 'pm')->c ?? 0) > 0;
            $days[] = [
                'date'   => $d,
                'am'     => !$amBusy,
                'pm'     => !$pmBusy,
                'closed' => $closed,
            ];
        }

        return $days;
    }

    private function isClosedPolicy(string $date, Collection $overrideMap, int $leadDays = 1): bool
    {
        $c = Carbon::parse($date, 'Asia/Tokyo');
        $today = Carbon::now('Asia/Tokyo')->startOfDay();

        // リードタイム (例：当日予約NG -> LeadDays=1)
        if ($c->lt($today->copy()->addDays($leadDays))) {
            return true;
        }

        // 土日は休業
        if ($c->isSaturday() || $c->isSunday()) {
            $closed = true;
        } else {
            $closed = false;
        }

        // 手動オーバーライドを最終優先( open=false で強制休、openz=true で開店)
        if ($overrideMap->has($date)) {
            return $overrideMap[$date] === false ? true : false;
        }

        return $closed;
    }
}
