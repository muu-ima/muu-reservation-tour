<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CancelExpiredPending extends Command
{
    protected $signature = 'reservations:cancel-expired-pending';
    protected $description = '期限切れの仮予約(pending)をキャンセルする';

    public function handle(): int
    {
        $count = DB::table('reservations')
            ->where('status', 'pending')
            ->whereNotNull('verify_expires_at')
            ->where('verify_expires_at', '<', now())
            ->update([
                'status' => 'cancelled',
                'verify_token' => null,
                'verify_expires_at' => null,
                'updated_at' => now(),
            ]);

        $this->info("Cancelled {$count} expired pending reservations.");
        return self::SUCCESS;
    }
}
