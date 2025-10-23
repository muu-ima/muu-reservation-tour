<?php

namespace App\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class AvailabilityController extends Controller
{
       /**
     * GET /v2/availabilities/next
     * クエリ: ?program=tour など
     * 返却: { date: "YYYY-MM-DD", slot: "am"|"pm", program: "tour" }
     */

    public function next(Request $request)
    {
        // 1) 入力
        $program = (string) $request->query('program', 'tour');

        // 2) 25日ルール（JST基準）
        $nowJst = Carbon::now('Asia/Tokyo');
        $lockNextMonth = $nowJst->day <= 25;
        $nextMonthStart = $nowJst->copy()->addMonthNoOverflow()->startOfMonth();

         // 3) compact と同等の配列を取得して最短を算出
        //    - ここでは "reservations" テーブルから在庫を要約する実装例を示す。
        //    - もし既に compact ロジック（サービス/リポジトリ等）があるならそちらを呼び出して OK。
        $days = $this->buildCompactDays($program,$nowJst->toDateString());

        // 4) 先頭から走査して最短を返す
        foreach ($days as $d) {
            $date = Arr::get($d, 'date');
            if(!$date) continue;

            // 翌月ロック (当日25日までは翌月をスキップ)
            if ($lockNextMonth && Carbon::parse($date, 'Asia/Tokyo')->greaterThanOrEqualTo($nextMonthStart)) {
                continue;
            }

            if (Arr::get($d, 'closed') === true) continue;

            // am/pm の表現揺れに広く対応
            $hasAM = Arr::get($d, 'am') === true
                || in_array('am', Arr::get($d, 'slots', []), true)
                || in_array('am', Arr::get($d, 'available', []), true);

            $hasPM = Arr::get($d, 'pm') === true
                || in_array('pm', Arr::get($d, 'slots', []), true)
                || in_array('pm', Arr::get($d, 'available', []), true);
            
            // 数だけの返却 (count/availableCount) にも最終フォールバック
            $count = Arr::get($d, 'count') ?? Arr::get($d, 'availableCount');

            if ($hasAM) {
                return response()->json([
                    'date' => $date,
                    'slot' => 'am',
                    'program' => $program,
                ]);
            }
            if($hasPM) {
                return response()->json([
                     'date' => $date,
                    'slot' => 'pm', 
                    'program' => $program,
                ]);
            }
                     if (is_numeric($count) && (int)$count > 0) {
                return response()->json([
                    'date' => $date,
                    'slot' => 'am', // 仮にAMを割り当て（仕様に合わせて調整可）
                    'program' => $program,
                ]);
            }
         }

         // 見つからない
         return response()->json(['error' => 'No available slots found'], 404);
    }
        /**
     * compact 相当の配列を生成する例（最短用の軽量版）
     * 実データに合わせてこの中身だけ調整すればOK。
     *
     * 期待する戻り配列の1要素例:
     *   [
     *     'date' => '2025-10-28',
     *     'am'   => true,  // or 'slots' => ['am','pm'] など
     *     'pm'   => false,
     *     'closed' => false,
     *   ]
     */
    private function buildCompactDays(string $program, string $fromDate): array
    {
          // --- 実装パターン A: reservations テーブルから算出する場合 ---
        //  予約が入っていないam/pmを「空き」とみなす単純ロジック例。
        //  - テーブル構成（必要最低限）:
        //      reservations(id, program, date, slot, status)
        //  - status が "booked" or "pending" を埋まりとみなし、他は無視（cancelled等）
        //
        //  カレンダは今日以降60日を走査（必要に応じて延長/短縮）
        $days = [];
        $span = 60;

        // 予約を日付・時間帯ごとに集計
        $rows = DB::table('reservations')
        ->selectRaw("date, slot, COUNT(*) as c")
        ->where('program', $program)
        ->whereDate('date', '>=', $fromDate)
        ->whereIn('status', ['booked', 'pending']) // 埋まり扱い
        ->groupBy('date', 'slot')
        ->get()
        ->groupBy('date'); // date => [ {slot,c}, ... ]

        for ($i = 0; $i <= $span; $i++) {
            $d = Carbon::parse($fromDate, 'Asia/Tokyo')->addDays($i)->toDateString();

            // 土日停止などのポリシーがある場合はここで close=true を設定
            $closed = true; // 必要に応じて判定ロジックを入れる

            $byDate = $rows->get($d, collect());
            $amBusy = $byDate->firstWhere('slot', 'am')?->c > 0;
            $pmBusy = $byDate->firstWhere('slot', 'pm')?->c > 0;

                        $days[] = [
                'date'   => $d,
                'am'     => !$amBusy,
                'pm'     => !$pmBusy,
                'closed' => $closed,
            ];
        }
        return $days;
    }
}