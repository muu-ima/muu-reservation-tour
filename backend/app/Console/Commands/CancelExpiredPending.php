<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class CancelExpiredPending extends Command
{
    protected $signature = 'reservations:cancel-expired-pending 
        {--minutes= : Minutes to wait before auto-cancel if verify_expires_at is NULL}';
    protected $description = '期限切れの仮予約(pending)を canceled にする（verify_expires_at優先。無ければ作成時刻からの猶予で判断）';

    public function handle(): int
    {
        $now = Carbon::now(); // config/app.php の timezone 準拠（JST推奨）
        $fallbackMinutes = (int)($this->option('minutes') ?? env('AUTO_CANCEL_MINUTES', 60));

        // 1) verify_expires_at を過ぎた pending をキャンセル
        $byVerify = DB::table('reservations')
            ->where('status', 'pending')
            ->whereNotNull('verify_expires_at')
            ->where('verify_expires_at', '<', $now)
            ->update([
                'status'             => 'canceled',  // ★ 米式に統一
                'verify_token'       => null,
                'verify_expires_at'  => null,
                'updated_at'         => $now,
            ]);

        // 2) verify_expires_at が無い pending は、作成からの猶予でキャンセル
        $byCreated = 0;
        if ($fallbackMinutes > 0) {
            $limit = (clone $now)->subMinutes($fallbackMinutes);
            $byCreated = DB::table('reservations')
                ->where('status', 'pending')
                ->whereNull('verify_expires_at')
                ->where('created_at', '<', $limit)
                ->update([
                    'status'       => 'canceled',
                    'verify_token' => null,
                    'updated_at'   => $now,
                ]);
        }

        $total = $byVerify + $byCreated;
        $this->info("Auto-canceled pending: total={$total} (by verify={$byVerify}, by created={$byCreated})");

        return self::SUCCESS;
    }
}
