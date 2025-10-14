<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MarkBookedDone extends Command
{
    protected $signature = 'reservations:mark-booked-done';
    protected $description = '終了時刻(end_at)を過ぎた予約（booked）を done に遷移する';

    public function handle(): int
    {
        $now = now();

        // 基本: end_at が now より過去の booked を done へ
        $affected = DB::table('reservations')
            ->where('status', 'booked')
            ->whereNotNull('end_at')
            ->where('end_at', '<', $now)
            ->update([
                'status' => 'done',
                'updated_at' => $now,
            ]);

        // 念のためのフォールバック:
        // end_at が NULL（昔のデータ）で、日付が今日より前の booked も done へ
        $fallback = DB::table('reservations')
            ->where('status', 'booked')
            ->whereNull('end_at')
            ->whereDate('date', '<', $now->toDateString())
            ->update([
                'status' => 'done',
                'updated_at' => $now,
            ]);

        $this->info("Marked done: total={$affected}+fallback={$fallback}");
        return self::SUCCESS;
    }
}
